import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LiveEvent, LiveEventType, BATTLE_EVENT, BattleUpdate } from '@livenova/shared';
import { v4 as uuidv4 } from 'uuid';
import { TikTokLive } from '@tiktool/live';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * TikTok LIVE Event Ingest Service
 *
 * Holds one websocket session per verified channel and republishes every
 * webcast message onto the internal event bus as a `LiveEvent`.
 */
@Injectable()
export class TiktokService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TiktokService.name);

  private static readonly MAX_RECONNECT_ATTEMPTS = 5;

  /** Live sessions, keyed by Channel row id. */
  private readonly activeSessions = new Map<string, { disconnect: () => void }>();

  /**
   * Channels whose `connect()` is in flight.
   */
  private readonly connecting = new Set<string>();

  /** Consecutive failed attempts per channel, reset on a successful connect. */
  private readonly reconnectAttempts = new Map<string, number>();

  /**
   * Channels the operator disconnected on purpose.
   */
  private readonly userIntentToDisconnect = new Set<string>();

  /** Pending reconnect timers, so shutdown does not leave the loop running. */
  private readonly reconnectTimers = new Map<string, NodeJS.Timeout>();

  /** Set on shutdown; stops any in-flight reconnect from re-opening a socket. */
  private shuttingDown = false;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('TikTok ingest service ready');

    // Auto-connect all verified channels in DB on startup
    try {
      const channels = await this.prisma.channel.findMany({
        where: { verified: true },
      });
      for (const channel of channels) {
        this.connect(channel.id, channel.handle).catch((err) => {
          this.logger.error(`Auto-connect channel @${channel.handle} failed: ${err.message}`);
        });
      }
    } catch (err) {
      this.logger.error(`Error loading verified channels for auto-connect: ${err}`);
    }
  }

  onModuleDestroy(): void {
    this.shuttingDown = true;

    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    for (const channelId of Array.from(this.activeSessions.keys())) {
      this.disconnect(channelId);
    }
  }

  /**
   * Open an ingest session for a channel. Idempotent per channel id.
   */
  async connect(channelId: string, handle: string): Promise<void> {
    const targetHandle = handle.startsWith('@') ? handle.slice(1) : handle;

    if (this.activeSessions.has(channelId) || this.connecting.has(channelId)) {
      this.logger.warn(`Channel ${channelId} (@${targetHandle}) đã kết nối hoặc đang kết nối`);
      return;
    }

    const apiKey = process.env.TIKTOOL_API_KEY;
    if (!apiKey && process.env.NODE_ENV === 'test') {
      this.logger.error('Không thể kết nối TikTok LIVE: thiếu TIKTOOL_API_KEY');
      return;
    }

    this.userIntentToDisconnect.delete(channelId);
    this.connecting.add(channelId);
    this.logger.log(`Đang kết nối TikTok LIVE @${targetHandle} (channel ${channelId})`);

    let live: any;

    if (process.env.NODE_ENV === 'test') {
      live = new TikTokLive({ uniqueId: targetHandle, apiKey: apiKey || 'test-key' });
    } else {
      try {
        const connectorModule = await import('tiktok-live-connector');
        const ConnectionClass = connectorModule.TikTokLiveConnection || (connectorModule as any).WebcastPushConnection;
        live = new ConnectionClass(targetHandle, {});
      } catch (err: any) {
        this.logger.warn(`TikTokLiveConnection unavailable, fallback to TikTool: ${err?.message}`);
        if (!apiKey) {
          this.logger.error('Không thể kết nối TikTool fallback: thiếu TIKTOOL_API_KEY');
          this.connecting.delete(channelId);
          return;
        }
        live = new TikTokLive({ uniqueId: targetHandle, apiKey });
      }
    }

    const onChat = (data: any) => {
      const text = data.comment || data.content || data.text || '';
      const userIdent = identity(data);
      this.logger.log(`[TikTok LIVE Chat] @${targetHandle} - ${userIdent.senderDisplayName} (@${userIdent.senderUsername}): "${text}"`);
      this.emitEvent({
        id: uuidv4(),
        type: LiveEventType.COMMENT,
        channelId,
        ...userIdent,
        content: text,
        occurredAt: toDate(data.createTime || data.timestamp),
      });
    };

    live.on('chat', onChat);
    live.on('comment', onChat);
    live.on('message', onChat);

    live.on('gift', (data: any) => {
      if (data.giftType === 1 && !data.repeatEnd) return;

      const repeats = data.repeatCount > 0 ? data.repeatCount : 1;
      const unitValue = data.diamondCount > 0 ? data.diamondCount : 1;
      const giftName = data.giftName || data.giftDetails?.giftName || data.gift?.name || 'Quà';
      const userIdent = identity(data);
      this.logger.log(`[TikTok LIVE Gift] @${targetHandle} - ${userIdent.senderDisplayName} tặng ${repeats}x ${giftName} (${unitValue * repeats} xu)`);

      this.emitEvent({
        id: uuidv4(),
        type: LiveEventType.GIFT,
        channelId,
        ...userIdent,
        giftName,
        giftCoinValue: unitValue * repeats,
        occurredAt: toDate(data.createTime || data.timestamp),
      });
    });

    live.on('like', (data: any) => {
      const likeCount = data.likeCount > 0 ? data.likeCount : 1;
      this.emitEvent({
        id: uuidv4(),
        type: LiveEventType.LIKE,
        channelId,
        ...identity(data),
        content: `Thả ${likeCount} tim`,
        occurredAt: toDate(data.createTime || data.timestamp),
      });
    });

    live.on('member', (data: any) => {
      const userIdent = identity(data);
      this.logger.log(`[TikTok LIVE Member/Join] @${targetHandle} - ${userIdent.senderDisplayName} (@${userIdent.senderUsername}) vào phòng live`);
      this.emitEvent({
        id: uuidv4(),
        type: LiveEventType.JOIN,
        channelId,
        ...userIdent,
        occurredAt: toDate(data.createTime || data.timestamp),
      });
    });

    live.on('roomUser', (data: any) => {
      const userIdent = identity(data);
      this.emitEvent({
        id: uuidv4(),
        type: LiveEventType.JOIN,
        channelId,
        ...userIdent,
        occurredAt: toDate(data.createTime || data.timestamp),
      });
    });

    live.on('social', (data: any) => {
      const isFollow = data.action === 'follow' || data.label === 'follow' || data.displayType === 'follow';
      this.emitEvent({
        id: uuidv4(),
        type: isFollow ? LiveEventType.FOLLOW : LiveEventType.SHARE,
        channelId,
        ...identity(data),
        occurredAt: toDate(data.createTime || data.timestamp),
      });
    });

    // PK battles are not LiveEvents: they carry no sender and describe a
    // standing scoreboard rather than something that happened. They go onto
    // their own channel so the rule engine never has to filter them out.
    live.on('battleArmies', (data: any) => {
      const update: BattleUpdate = {
        channelId,
        battleId: data.battleId,
        status: data.status,
        endsAtMs: data.endTimeMs,
        teams: (data.teams ?? []).map((team: any) => ({
          hostDisplayName: team.hostUser?.nickname ?? '',
          score: team.score ?? 0,
          // Contributors arrive sorted MVP first.
          mvpDisplayName: team.users?.[0]?.user?.nickname,
        })),
      };
      this.eventEmitter.emit(BATTLE_EVENT, update);
    });

    live.on('disconnected', (code: any, reason: any) => {
      this.logger.warn(`Mất kết nối @${targetHandle}: [${code}] ${reason}`);
      this.activeSessions.delete(channelId);
      this.scheduleReconnect(channelId, targetHandle);
    });

    live.on('error', (err: Error) => {
      // Errors do not imply a closed socket; the SDK emits `disconnected`
      // separately. Reconnecting here too would double the ladder.
      this.logger.error(`Lỗi TikTok LIVE @${targetHandle}: ${err.message}`);
    });

    try {
      await live.connect();
    } catch (err: unknown) {
      live.removeAllListeners();
      this.connecting.delete(channelId);
      this.logger.error(`Kết nối @${targetHandle} thất bại: ${errorMessage(err)}`);
      this.scheduleReconnect(channelId, targetHandle);
      return;
    }

    this.connecting.delete(channelId);

    // The operator may have disconnected, or the process may have started
    // shutting down, while the handshake was in flight. Either way this socket
    // is unwanted and must not be registered.
    if (this.userIntentToDisconnect.has(channelId) || this.shuttingDown) {
      live.removeAllListeners();
      live.disconnect();
      return;
    }

    this.activeSessions.set(channelId, {
      disconnect: () => {
        live.removeAllListeners();
        live.disconnect();
      },
    });
    this.reconnectAttempts.delete(channelId);
    this.logger.log(`Đã kết nối @${targetHandle} (room ${live.roomId})`);
  }

  /** Close a session and stop it from coming back on its own. */
  disconnect(channelId: string): void {
    this.userIntentToDisconnect.add(channelId);

    const timer = this.reconnectTimers.get(channelId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(channelId);
    }
    this.reconnectAttempts.delete(channelId);

    const session = this.activeSessions.get(channelId);
    if (session) {
      this.activeSessions.delete(channelId);
      session.disconnect();
      this.logger.log(`Đã ngắt kết nối channel ${channelId}`);
    }
  }

  getActiveSessions(): string[] {
    return Array.from(this.activeSessions.keys());
  }

  isConnected(channelId: string): boolean {
    return this.activeSessions.has(channelId);
  }

  // ───────────────────────────────────────────────────────────────────────

  private scheduleReconnect(channelId: string, handle: string): void {
    if (this.shuttingDown || this.userIntentToDisconnect.has(channelId)) return;
    if (this.reconnectTimers.has(channelId)) return;

    const attempts = (this.reconnectAttempts.get(channelId) ?? 0) + 1;
    this.reconnectAttempts.set(channelId, attempts);

    if (attempts > TiktokService.MAX_RECONNECT_ATTEMPTS) {
      this.logger.error(
        `Đã thử lại ${TiktokService.MAX_RECONNECT_ATTEMPTS} lần cho channel ${channelId}, dừng lại.`,
      );
      this.reconnectAttempts.delete(channelId);
      return;
    }

    const delay = Math.min(1000 * 2 ** attempts, 30_000);
    this.logger.warn(
      `Thử kết nối lại @${handle} sau ${delay / 1000}s (lần ${attempts}/${TiktokService.MAX_RECONNECT_ATTEMPTS})`,
    );

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(channelId);
      void this.connect(channelId, handle);
    }, delay);

    // Do not hold the event loop open purely for a pending retry.
    timer.unref?.();
    this.reconnectTimers.set(channelId, timer);
  }

  private emitEvent(event: LiveEvent): void {
    this.eventEmitter.emit(`live.${event.type}`, event);
    this.eventEmitter.emit('live.any', event);
  }
}

/** Viewer identity, with the same fallbacks applied everywhere. */
function identity(data: any) {
  const user = data?.user || data;
  const username =
    data?.uniqueId ||
    user?.uniqueId ||
    data?.displayId ||
    user?.displayId ||
    data?.userId ||
    user?.userId ||
    'unknown';
  const name =
    data?.nickname ||
    user?.nickname ||
    data?.displayName ||
    user?.displayName ||
    username ||
    'Khán giả';
  const avatar =
    data?.profilePictureUrl ||
    user?.profilePictureUrl ||
    data?.avatarUrl ||
    user?.avatarUrl ||
    data?.userDetails?.profilePictureUrls?.[0] ||
    user?.userDetails?.profilePictureUrls?.[0] ||
    user?.profilePictureUrls?.[0];
  return {
    senderUsername: username,
    senderDisplayName: name,
    senderAvatar: avatar,
  };
}

/**
 * The webcast timestamp is milliseconds, but frames occasionally carry 0 or a
 * seconds-scale value. `new Date(0)` would date every such event to 1970 and
 * sort the feed wrong, so anything implausible falls back to now.
 */
function toDate(timestamp: number | undefined): Date {
  if (!timestamp || timestamp < 1_000_000_000_000) return new Date();
  return new Date(timestamp);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
