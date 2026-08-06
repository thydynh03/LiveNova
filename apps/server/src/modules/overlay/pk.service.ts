import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  BATTLE_EVENT,
  BattleUpdate,
  PkState,
  PkSide,
  OverlayStateDispatch,
  OVERLAY_STATE_EVENT,
  OVERLAY_CHANGED_EVENT,
  OverlayChangedEvent,
} from '@livenova/shared';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Drives the PK_BAR overlay from real battle frames.
 *
 * The page used to add `Math.random() * 50` to both scores every two seconds.
 * A PK bar showing invented numbers is worse than no bar: the streamer and
 * their viewers make real decisions about who to gift based on which side is
 * behind.
 */
@Injectable()
export class PkService {
  private readonly logger = new Logger(PkService.name);

  /** userId → that user's enabled PK overlays. */
  private readonly overlaysByUser = new Map<string, string[]>();

  /**
   * Platform status codes that mean the round is over.
   *
   * The bar keeps the final scores on screen but stops its countdown, because
   * a timer still ticking after the result is in reads as a broken widget.
   */
  private static readonly FINISHED_STATUS = new Set([0, 3]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(OVERLAY_CHANGED_EVENT)
  invalidateUser({ userId }: OverlayChangedEvent): void {
    this.overlaysByUser.delete(userId);
  }

  @OnEvent(BATTLE_EVENT)
  async handleBattle(update: BattleUpdate): Promise<void> {
    // Multi-guest battles report more than two teams. Reducing them to two
    // would misstate the score, so the bar sits this one out rather than
    // showing a number that is wrong.
    if (!update?.teams || update.teams.length !== 2) {
      if (update?.teams && update.teams.length > 2) {
        this.logger.debug(
          `Battle ${update.battleId} has ${update.teams.length} teams; the two-sided bar cannot show it`,
        );
      }
      return;
    }

    try {
      const channel = await this.prisma.channel.findUnique({
        where: { id: update.channelId },
        select: { userId: true },
      });
      if (!channel) return;

      const overlayIds = await this.loadOverlays(channel.userId);
      if (overlayIds.length === 0) return;

      const state: PkState = {
        kind: 'pk',
        battleId: update.battleId,
        sides: [toSide(update.teams[0], 1), toSide(update.teams[1], 2)],
        endsAtMs: update.endsAtMs,
        active: !PkService.FINISHED_STATUS.has(update.status),
      };

      for (const overlayId of overlayIds) {
        const dispatch: OverlayStateDispatch = { userId: channel.userId, overlayId, state };
        this.eventEmitter.emit(OVERLAY_STATE_EVENT, dispatch);
      }
    } catch (err) {
      this.logger.error(
        `PK update failed for channel ${update.channelId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async loadOverlays(userId: string): Promise<string[]> {
    const cached = this.overlaysByUser.get(userId);
    if (cached) return cached;

    const overlays = await this.prisma.overlay.findMany({
      where: { userId, type: 'PK_BAR', enabled: true },
      select: { id: true },
    });

    const ids = overlays.map((o) => o.id);
    this.overlaysByUser.set(userId, ids);
    return ids;
  }
}

function toSide(
  team: { hostDisplayName: string; score: number; mvpDisplayName?: string },
  index: number,
): PkSide {
  return {
    // A host whose nickname the platform did not send still needs a label, or
    // the bar renders a blank side.
    hostDisplayName: team.hostDisplayName?.trim() || `Đội ${index}`,
    score: Number.isFinite(team.score) && team.score > 0 ? team.score : 0,
    mvpDisplayName: team.mvpDisplayName?.trim() || undefined,
  };
}
