import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  LiveEvent,
  Rule as SharedRule,
  RuleAction,
  RuleActionType,
  RuleCondition,
  RuleEvaluator,
  OverlayAction,
  OverlayDispatchEvent,
  OverlayEventContext,
  OVERLAY_DISPATCH_EVENT,
  clampMediaDuration,
} from '@livenova/shared';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * The runtime that turns a live event into an overlay action.
 *
 * This was the missing link in the MVP path. Every piece around it existed —
 * ingest emitted `live.any`, rules were stored and could be dry-run, and
 * OverlayGateway consumed `overlay.dispatch` — but nothing subscribed to the
 * first and emitted the second, so a real gift never reached a real overlay.
 */
@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  /**
   * One evaluator for the whole process.
   *
   * Cooldowns are keyed by rule id, which is globally unique, so a shared
   * instance is correct. A per-event evaluator would reset every cooldown on
   * every event and make `cooldownMs` do nothing at all.
   */
  private readonly evaluator = new RuleEvaluator();

  /** channelId → owning userId. Channel ownership effectively never changes. */
  private readonly channelOwners = new Map<string, string>();

  /** userId → enabled rules, invalidated on any write through RuleService. */
  private readonly ruleCache = new Map<string, { rules: SharedRule[]; loadedAt: number }>();

  private static readonly RULE_CACHE_TTL_MS = 30_000;

  /**
   * Action types this server can deliver on its own.
   *
   * OBS_COMMAND and GAME_INPUT are executed by the desktop bridge on the
   * streamer's machine and WEBHOOK needs outbound egress rules, so they are
   * logged rather than silently dropped — a rule that appears to fire but does
   * nothing is worse than one that reports it is unsupported.
   */
  private static readonly OVERLAY_ACTIONS: ReadonlySet<RuleActionType> = new Set([
    RuleActionType.MEDIA_POPUP,
    RuleActionType.EFFECT,
    RuleActionType.SOUND,
    RuleActionType.TTS_READ,
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Called by RuleService after any create/update/delete. */
  invalidateUser(userId: string): void {
    this.ruleCache.delete(userId);
  }

  @OnEvent('live.any')
  async handleLiveEvent(event: LiveEvent): Promise<void> {
    try {
      const userId = await this.resolveOwner(event.channelId);
      if (!userId) return;

      const rules = await this.loadRules(userId);
      if (rules.length === 0) return;

      const results = this.evaluator.evaluate(event, rules);

      for (const result of results) {
        for (const action of result.actions) {
          this.dispatch(userId, result.rule, action, event);
        }
      }
    } catch (err) {
      // An event-bus listener that throws takes down nothing but leaves no
      // trace, so failures here would be invisible during a live broadcast.
      this.logger.error(
        `Rule evaluation failed for channel ${event.channelId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private dispatch(
    userId: string,
    rule: SharedRule,
    action: RuleAction,
    event: LiveEvent,
  ): void {
    if (!RuleEngineService.OVERLAY_ACTIONS.has(action.type)) {
      this.logger.warn(
        `Rule "${rule.name}" requested ${action.type}, which no connected surface handles yet`,
      );
      return;
    }

    const overlayAction: OverlayAction = {
      id: uuidv4(),
      ruleId: rule.id,
      ruleName: rule.name,
      type: action.type,
      payload: this.normalisePayload(action),
      event: projectEvent(event),
      createdAt: new Date().toISOString(),
    };

    const dispatchEvent: OverlayDispatchEvent = { userId, action: overlayAction };
    this.eventEmitter.emit(OVERLAY_DISPATCH_EVENT, dispatchEvent);
  }

  /**
   * Enforce the limits the shared types promise are applied server-side.
   *
   * `durationMs` comes from user-authored rule JSON. Left unclamped, a typo of
   * 300000 pins a video over the broadcast for five minutes with no way to
   * dismiss it from the overlay.
   */
  private normalisePayload(action: RuleAction): Record<string, unknown> {
    if (action.type !== RuleActionType.MEDIA_POPUP) return action.payload;

    const raw = action.payload as { durationMs?: number };
    return { ...action.payload, durationMs: clampMediaDuration(raw.durationMs) };
  }

  private async resolveOwner(channelId: string): Promise<string | null> {
    const cached = this.channelOwners.get(channelId);
    if (cached) return cached;

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { userId: true },
    });
    if (!channel) return null;

    this.channelOwners.set(channelId, channel.userId);
    return channel.userId;
  }

  private async loadRules(userId: string): Promise<SharedRule[]> {
    const cached = this.ruleCache.get(userId);
    if (cached && Date.now() - cached.loadedAt < RuleEngineService.RULE_CACHE_TTL_MS) {
      return cached.rules;
    }

    // A busy stream produces hundreds of events a minute; hitting the database
    // for the rule set on each one would make the ingest path the bottleneck.
    const rows = await this.prisma.rule.findMany({
      where: { userId, enabled: true },
      orderBy: { priority: 'asc' },
    });

    const rules: SharedRule[] = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      name: row.name,
      enabled: row.enabled,
      priority: row.priority,
      conditions: row.conditions as unknown as RuleCondition,
      actions: row.actions as unknown as RuleAction[],
      continueMatching: row.continueMatching,
      cooldownMs: row.cooldownMs,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    this.ruleCache.set(userId, { rules, loadedAt: Date.now() });
    return rules;
  }
}

/**
 * Narrow a live event to what an overlay may render.
 *
 * The overlay page is served on a public token URL, so anything passed here is
 * effectively public. The raw LiveEvent carries the internal channel id and the
 * sender's platform username; neither belongs on a broadcast.
 */
function projectEvent(event: LiveEvent): OverlayEventContext {
  return {
    type: event.type,
    senderDisplayName: event.senderDisplayName,
    giftName: event.giftName,
    giftCoinValue: event.giftCoinValue,
    content: event.content,
  };
}
