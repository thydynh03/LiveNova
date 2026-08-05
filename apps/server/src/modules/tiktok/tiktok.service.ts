import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LiveEvent, LiveEventType } from '@tiktok-live/shared';
import { v4 as uuidv4 } from 'uuid';

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

  /** Active channel sessions: channelId → interval handle */
  private readonly activeSessions = new Map<string, NodeJS.Timeout>();

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
  async connect(channelId: string): Promise<void> {
    if (this.activeSessions.has(channelId)) {
      this.logger.warn(`Channel ${channelId} already connected`);
      return;
    }

    this.logger.log(`Connecting to channel: ${channelId} (simulation mode)`);

    // ─── SIMULATION MODE ───────────────────────────────────────────────
    // Emits random events every 2-5 seconds for development/testing.
    // REPLACE THIS BLOCK with real TikTok ingest when Q-01 is resolved.
    const interval = setInterval(
      () => {
        const event = this.generateMockEvent(channelId);
        this.emitEvent(event);
      },
      Math.random() * 3000 + 2000,
    );

    this.activeSessions.set(channelId, interval);
    this.logger.log(`Channel ${channelId} connected (mock mode)`);
  }

  /**
   * Disconnect from a TikTok LIVE channel and stop receiving events.
   */
  async disconnect(channelId: string): Promise<void> {
    const session = this.activeSessions.get(channelId);
    if (session) {
      clearInterval(session);
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
    const type = types[Math.floor(Math.random() * types.length)];
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

    const sender = names[Math.floor(Math.random() * names.length)];
    const gift = gifts[Math.floor(Math.random() * gifts.length)];

    return {
      id: uuidv4(),
      type,
      channelId,
      senderUsername: sender.toLowerCase().replace(/\s/g, '_'),
      senderDisplayName: sender,
      content: type === LiveEventType.COMMENT
        ? comments[Math.floor(Math.random() * comments.length)]
        : undefined,
      giftName: type === LiveEventType.GIFT ? gift.name : undefined,
      giftCoinValue: type === LiveEventType.GIFT ? gift.coinValue : undefined,
      occurredAt: new Date(),
    };
  }
}
