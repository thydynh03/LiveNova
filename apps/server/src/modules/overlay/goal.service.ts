import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  LiveEvent,
  LiveEventType,
  GoalState,
  OverlayStateDispatch,
  OVERLAY_STATE_EVENT,
  OVERLAY_CHANGED_EVENT,
  OverlayChangedEvent,
  readGoalConfig,
} from '@livenova/shared';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Drives the GOAL overlay from real gift traffic.
 *
 * The page previously incremented a counter with `Math.random()` every three
 * seconds. Handing a streamer that URL puts an invented number on their
 * broadcast, next to real donations — which is worse than showing nothing.
 *
 * KNOWN LIMITATION: progress is held in memory and starts from zero after a
 * restart. Live events are not persisted anywhere yet (the `LiveEvent` table
 * has no writer), so there is nothing to rebuild a running total from. Stated
 * here rather than hidden, because a streamer mid-goal would notice.
 */
@Injectable()
export class GoalService {
  private readonly logger = new Logger(GoalService.name);

  /** overlayId → coins accumulated for the current day. */
  private readonly progress = new Map<string, { coins: number; day: string }>();

  /** userId → that user's enabled GOAL overlays. */
  private readonly overlaysByUser = new Map<string, { id: string; config: unknown }[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(OVERLAY_CHANGED_EVENT)
  invalidateUser({ userId }: OverlayChangedEvent): void {
    this.overlaysByUser.delete(userId);
  }

  @OnEvent(`live.${LiveEventType.GIFT}`)
  async handleGift(event: LiveEvent): Promise<void> {
    const coins = event.giftCoinValue ?? 0;
    if (coins <= 0) return;

    try {
      const channel = await this.prisma.channel.findUnique({
        where: { id: event.channelId },
        select: { userId: true },
      });
      if (!channel) return;

      for (const overlay of await this.loadOverlays(channel.userId)) {
        const config = readGoalConfig(overlay.config);
        const current = this.accumulate(overlay.id, coins);

        const state: GoalState = {
          kind: 'goal',
          current,
          target: config.target,
          label: config.label,
        };

        const dispatch: OverlayStateDispatch = {
          userId: channel.userId,
          overlayId: overlay.id,
          state,
        };
        this.eventEmitter.emit(OVERLAY_STATE_EVENT, dispatch);
      }
    } catch (err) {
      this.logger.error(
        `Goal update failed for channel ${event.channelId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** Current value for an overlay, for a client that has just connected. */
  currentFor(overlayId: string): number {
    const entry = this.progress.get(overlayId);
    if (!entry || entry.day !== today()) return 0;
    return entry.coins;
  }

  private accumulate(overlayId: string, coins: number): number {
    const day = today();
    const entry = this.progress.get(overlayId);

    // A daily goal that never resets is a running total, which is not what the
    // label says. The day is compared on every gift rather than on a timer, so
    // no scheduler has to stay correct across a restart.
    if (!entry || entry.day !== day) {
      this.progress.set(overlayId, { coins, day });
      return coins;
    }

    entry.coins += coins;
    return entry.coins;
  }

  private async loadOverlays(userId: string) {
    const cached = this.overlaysByUser.get(userId);
    if (cached) return cached;

    const overlays = await this.prisma.overlay.findMany({
      where: { userId, type: 'GOAL', enabled: true },
      select: { id: true, config: true },
    });

    this.overlaysByUser.set(userId, overlays);
    return overlays;
  }
}

/** Local calendar day. A goal resets when the streamer's day does. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
