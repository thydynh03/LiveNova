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
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { WebcastPushConnection } = require('tiktok-live-connector');

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
      const connection = new WebcastPushConnection(targetHandle, {
        enableExtendedGiftInfo: true,
        requestOptions: {
          timeout: 10000,
        },
      });

      connection.on('chat', (data: { uniqueId?: string; nickname?: string; comment?: string }) => {
        this.emitEvent({
          id: uuidv4(),
          type: LiveEventType.COMMENT,
          channelId,
          senderUsername: data.uniqueId || data.nickname || 'anonymous',
          senderDisplayName: data.nickname || data.uniqueId || 'Anonymous',
          content: data.comment,
          occurredAt: new Date(),
        });
      });

      connection.on('gift', (data: { uniqueId?: string; nickname?: string; giftName?: string; diamondCount?: number; repeatCount?: number; giftType?: number; repeatEnd?: number }) => {
        if (data.giftType === 1 && data.repeatEnd === 0) {
          // Streak in progress, wait for end
          return;
        }
        this.emitEvent({
          id: uuidv4(),
          type: LiveEventType.GIFT,
          channelId,
          senderUsername: data.uniqueId || data.nickname || 'anonymous',
          senderDisplayName: data.nickname || data.uniqueId || 'Anonymous',
          giftName: data.giftName || 'Gift',
          giftCoinValue: data.diamondCount || data.repeatCount || 1,
          occurredAt: new Date(),
        });
      });

      connection.on('like', (data: { uniqueId?: string; nickname?: string; likeCount?: number }) => {
        this.emitEvent({
          id: uuidv4(),
          type: LiveEventType.LIKE,
          channelId,
          senderUsername: data.uniqueId || data.nickname || 'anonymous',
          senderDisplayName: data.nickname || data.uniqueId || 'Anonymous',
          content: `Thả ${data.likeCount || 1} tim`,
          occurredAt: new Date(),
        });
      });

      connection.on('member', (data: { uniqueId?: string; nickname?: string }) => {
        this.emitEvent({
          id: uuidv4(),
          type: LiveEventType.JOIN,
          channelId,
          senderUsername: data.uniqueId || data.nickname || 'anonymous',
          senderDisplayName: data.nickname || data.uniqueId || 'Anonymous',
          occurredAt: new Date(),
        });
      });

      connection.on('social', (data: { uniqueId?: string; nickname?: string; label?: string; displayType?: string }) => {
        const isFollow = data.label?.includes('follow') || data.displayType?.includes('follow');
        this.emitEvent({
          id: uuidv4(),
          type: isFollow ? LiveEventType.FOLLOW : LiveEventType.SHARE,
          channelId,
          senderUsername: data.uniqueId || data.nickname || 'anonymous',
          senderDisplayName: data.nickname || data.uniqueId || 'Anonymous',
          occurredAt: new Date(),
        });
      });

      connection.on('streamEnd', () => {
        this.logger.warn(`TikTok LIVE stream ended for @${targetHandle}`);
      });

      connection.on('disconnected', () => {
        this.logger.warn(`Disconnected from TikTok LIVE stream for @${targetHandle}`);
      });

      connection.on('error', (err: Error) => {
        this.logger.error(`TikTok LIVE Webcast error for @${targetHandle}: ${err?.message}`);
      });

      await connection.connect();
      this.activeSessions.set(channelId, { disconnect: () => connection.disconnect() });
      this.logger.log(`Successfully connected to live stream for @${targetHandle}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Could not connect to live Webcast stream for @${targetHandle} (${msg}). Starting fallback mode.`,
      );

      const interval = setInterval(
        () => {
          const event = this.generateMockEvent(channelId);
          this.emitEvent(event);
        },
        randomInt(3000, 6000),
      );

      this.activeSessions.set(channelId, { disconnect: () => clearInterval(interval) });
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
