import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LiveEvent, LiveEventType } from '@livenova/shared';
import { randomInt } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
async function getTikTokConnectionClass() {
  const mod: any = await import('tiktok-live-connector');
  return mod.TikTokLiveConnection || mod.WebcastPushConnection || mod.default?.TikTokLiveConnection || mod.default?.WebcastPushConnection || mod.default;
}

/**
 * Picks a random element using a CSPRNG.
 *
 * `Math.floor(Math.random() * arr.length)` is what CodeQL flagged here
 * (js/insecure-randomness, CWE-338). Nothing this file generates is actually a
 * credential — these are placeholder names for simulated events — but the
 * alternative to fixing it is dismissing a High alert, and a security dashboard
 * that carries permanent noise trains everyone to skim past the next one, which
 * may be real. `randomInt` costs nothing here and keeps the primitive correct
 * if this mock code is ever copied somewhere it matters.
 */
function pick<T>(items: readonly T[]): T {
  // `randomInt(0)` throws, where the old expression quietly yielded index 0 and
  // therefore `undefined` — which the `: T` return type would have been lying
  // about. Every caller here passes a non-empty literal, so this only fires if
  // someone reuses the helper carelessly, and failing loudly is the right
  // outcome then.
  if (items.length === 0) {
    throw new Error('pick() requires a non-empty array');
  }
  return items[randomInt(items.length)];
}

/**
 * TikTok LIVE Event Ingest Service
 *
 * This service is the Abstraction Layer for receiving real-time events
 * from TikTok LIVE streams (comments, gifts, likes, follows, shares, joins).
 *
 * ⚠️  IMPORTANT — Q-01 BLOCKING QUESTION:
 * The actual data source (how we receive TikTok LIVE events) MUST be
 * decided before implementing the connect() method below.
 *
 * Options to evaluate:
 *   A. TikTok Official LIVE Platform API (partner programme)
 *   B. tiktok-live-connector (unofficial Node.js library)
 *   C. Custom WebSocket proxy via Node.js runtime
 *
 * Until Q-01 is resolved, this service emits SIMULATED events for
 * development and testing purposes only.
 */
@Injectable()
export class TiktokService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TiktokService.name);

  /** Active channel sessions: channelId → session instance */
  private readonly activeSessions = new Map<string, { disconnect: () => void } | NodeJS.Timeout>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  onModuleInit() {
    this.logger.log('TikTok Ingest Service initialized (simulation mode)');
    this.logger.warn(
      '⚠️  Q-01 UNRESOLVED: TikTok data source not configured. Running in mock mode.',
    );
  }

  onModuleDestroy() {
    // Clean up all active sessions on shutdown
    for (const [channelId] of this.activeSessions) {
      this.disconnect(channelId);
    }
  }

  /**
   * Connect to a TikTok LIVE channel and start receiving events.
   *
   * TODO (Q-01): Replace simulation below with real ingest implementation.
   * Example with tiktok-live-connector:
   *
   *   import { WebcastPushConnection } from 'tiktok-live-connector';
   *   const tiktokLive = new WebcastPushConnection(channelId);
   *   await tiktokLive.connect();
   *   tiktokLive.on('chat', (data) => this.handleRawEvent(channelId, data, LiveEventType.COMMENT));
   *   tiktokLive.on('gift', (data) => this.handleRawEvent(channelId, data, LiveEventType.GIFT));
   *   tiktokLive.on('like', (data) => this.handleRawEvent(channelId, data, LiveEventType.LIKE));
   *   tiktokLive.on('follow', (data) => this.handleRawEvent(channelId, data, LiveEventType.FOLLOW));
   *   tiktokLive.on('share', (data) => this.handleRawEvent(channelId, data, LiveEventType.SHARE));
   *   tiktokLive.on('roomUser', (data) => this.handleRawEvent(channelId, data, LiveEventType.JOIN));
   */
  async connect(channelId: string, platformChannelId?: string): Promise<void> {
    if (this.activeSessions.has(channelId)) {
      this.logger.warn(`Channel ${channelId} already connected`);
      return;
    }

    const targetHandle = platformChannelId || channelId;
    this.logger.log(`Connecting to TikTok LIVE stream for handle: @${targetHandle} (ChannelId: ${channelId})`);

    try {
      const TikTokConnectionClass = await getTikTokConnectionClass();
      const connection = new TikTokConnectionClass(targetHandle, {
        enableExtendedGiftInfo: true,
      });

      connection.on('chat', (data: any) => {
        const displayName = data.user?.nickname || data.nickname || data.user?.uniqueId || data.uniqueId || 'Khán giả';
        const username = data.user?.uniqueId || data.user?.displayId || data.uniqueId || 'user';
        const content = data.content || data.comment || '';

        this.emitEvent({
          id: uuidv4(),
          type: LiveEventType.COMMENT,
          channelId,
          senderUsername: username,
          senderDisplayName: displayName,
          content,
          occurredAt: new Date(),
        });
      });

      connection.on('gift', (data: any) => {
        if (data.giftType === 1 && data.repeatEnd === 0) {
          // Streak in progress
          return;
        }
        const displayName = data.user?.nickname || data.nickname || data.user?.uniqueId || data.uniqueId || 'Khán giả';
        const username = data.user?.uniqueId || data.user?.displayId || data.uniqueId || 'user';
        const giftName = data.gift?.giftName || data.giftDetails?.giftName || data.giftName || 'Quà';
        const giftCoinValue = data.gift?.diamondCount || data.diamondCount || data.repeatCount || 1;

        this.emitEvent({
          id: uuidv4(),
          type: LiveEventType.GIFT,
          channelId,
          senderUsername: username,
          senderDisplayName: displayName,
          giftName,
          giftCoinValue,
          occurredAt: new Date(),
        });
      });

      connection.on('like', (data: any) => {
        const displayName = data.user?.nickname || data.nickname || data.user?.uniqueId || data.uniqueId || 'Khán giả';
        const username = data.user?.uniqueId || data.user?.displayId || data.uniqueId || 'user';
        const likeCount = data.likeCount || data.totalLikeCount || 1;

        this.emitEvent({
          id: uuidv4(),
          type: LiveEventType.LIKE,
          channelId,
          senderUsername: username,
          senderDisplayName: displayName,
          content: `Thả ${likeCount} tim`,
          occurredAt: new Date(),
        });
      });

      connection.on('member', (data: any) => {
        const displayName = data.user?.nickname || data.nickname || data.user?.uniqueId || data.uniqueId || 'Khán giả';
        const username = data.user?.uniqueId || data.user?.displayId || data.uniqueId || 'user';

        this.emitEvent({
          id: uuidv4(),
          type: LiveEventType.JOIN,
          channelId,
          senderUsername: username,
          senderDisplayName: displayName,
          occurredAt: new Date(),
        });
      });

      connection.on('social', (data: any) => {
        const displayName = data.user?.nickname || data.nickname || data.user?.uniqueId || data.uniqueId || 'Khán giả';
        const username = data.user?.uniqueId || data.user?.displayId || data.uniqueId || 'user';
        const isFollow = data.common?.displayText?.key?.includes('follow') || data.label?.includes('follow');

        this.emitEvent({
          id: uuidv4(),
          type: isFollow ? LiveEventType.FOLLOW : LiveEventType.SHARE,
          channelId,
          senderUsername: username,
          senderDisplayName: displayName,
          occurredAt: new Date(),
        });
      });

      connection.on('streamEnd', () => {
        this.logger.warn(`TikTok LIVE stream ended for @${targetHandle}`);
      });

      connection.on('disconnected', () => {
        this.logger.warn(`Disconnected from TikTok LIVE stream for @${targetHandle}`);
      });

      connection.on('error', (err: any) => {
        this.logger.error(`TikTok LIVE Webcast error for @${targetHandle}: ${err?.message || err}`);
      });

      await connection.connect();
      this.activeSessions.set(channelId, { disconnect: () => connection.disconnect() });
      this.logger.log(`Successfully connected to REAL TikTok LIVE stream for @${targetHandle}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to connect to TikTok LIVE stream for @${targetHandle}: ${msg}`,
      );
    }
  }

  /**
   * Disconnect from a TikTok LIVE channel and stop receiving events.
   */
  async disconnect(channelId: string): Promise<void> {
    const session = this.activeSessions.get(channelId);
    if (session) {
      if ('disconnect' in session && typeof session.disconnect === 'function') {
        session.disconnect();
      } else if (typeof session === 'object' && session !== null && 'close' in session) {
        (session as { close: () => void }).close();
      } else if (typeof session === 'number' || typeof session === 'object') {
        clearInterval(session as unknown as NodeJS.Timeout);
      }
      this.activeSessions.delete(channelId);
      this.logger.log(`Channel ${channelId} disconnected`);
    }
  }

  /**
   * Get all currently active channel connections.
   */
  getActiveSessions(): string[] {
    return Array.from(this.activeSessions.keys());
  }

  /**
   * Check if a specific channel is currently connected.
   */
  isConnected(channelId: string): boolean {
    return this.activeSessions.has(channelId);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Emit a normalized LiveEvent to the internal event bus.
   * All consumers (RuleEngine, TTS, Overlay, WebSocket Gateway) listen here.
   */
  private emitEvent(event: LiveEvent): void {
    this.eventEmitter.emit(`live.${event.type}`, event);
    this.eventEmitter.emit('live.any', event);
    this.logger.debug(
      `Event emitted: [${event.type}] from ${event.senderDisplayName} on ${event.channelId}`,
    );
  }

  /**
   * Generates a random mock event for testing purposes.
   * TODO: Remove when real ingest is implemented (Q-01).
   */
  private generateMockEvent(channelId: string): LiveEvent {
    const types = [
      LiveEventType.COMMENT,
      LiveEventType.GIFT,
      LiveEventType.LIKE,
      LiveEventType.FOLLOW,
      LiveEventType.SHARE,
      LiveEventType.JOIN,
    ];
    const type = pick(types);
    const names = ['Nguyễn Văn A', 'Trần Thị B', 'Lê Văn C', 'Phạm D'];
    const comments = [
      'Chị ơi đọc tên em với!',
      'Hello mọi người 👋',
      'Stream hay quá ạ!',
      'Ủng hộ chị nhé!',
    ];
    const gifts = [
      { name: 'Hoa hồng', coinValue: 1 },
      { name: 'TikTok Universe', coinValue: 34999 },
      { name: 'Chúc mừng', coinValue: 100 },
      { name: 'Sư tử', coinValue: 29999 },
    ];

    const sender = pick(names);
    const gift = pick(gifts);

    return {
      id: uuidv4(),
      type,
      channelId,
      senderUsername: sender.toLowerCase().replace(/\s/g, '_'),
      senderDisplayName: sender,
      content: type === LiveEventType.COMMENT ? pick(comments) : undefined,
      giftName: type === LiveEventType.GIFT ? gift.name : undefined,
      giftCoinValue: type === LiveEventType.GIFT ? gift.coinValue : undefined,
      occurredAt: new Date(),
    };
  }
}
