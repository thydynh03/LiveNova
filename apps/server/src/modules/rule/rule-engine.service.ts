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
  OVERLAY_CHANGED_EVENT,
  OverlayChangedEvent,
  GAME_INPUT_EVENT,
  GameInputDispatch,
  clampMediaDuration,
  readEffectPayload,
  readGameInput,
  BATTLE_ACTION_DISPATCH,
  BattleActionDispatchEvent,
} from '@livenova/shared';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { TtsService } from '../tts/tts.service';

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

  /** Delivered to the desktop bridge through the dashboard, not to an overlay. Or to internal game engines. */
  private static readonly RELAYED_ACTIONS: ReadonlySet<RuleActionType> = new Set([
    RuleActionType.GAME_INPUT,
    RuleActionType.GAME_BATTLE_ACTION,
  ]);

  /** userId → the overlay that renders alerts, or null if they have none. */
  private readonly alertOverlays = new Map<string, string | null>();

  /** userId → the overlay that renders stage effects, or null if they have none. */
  private readonly stageOverlays = new Map<string, string | null>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly ttsService: TtsService,
  ) {}

  /** Called by RuleService after any create/update/delete. */
  invalidateUser(userId: string): void {
    this.ruleCache.delete(userId);
    this.alertOverlays.delete(userId);
    this.stageOverlays.delete(userId);
  }

  /**
   * A streamer who adds their alerts overlay after the engine has already
   * looked and cached "none" would otherwise keep getting nothing.
   */
  @OnEvent(OVERLAY_CHANGED_EVENT)
  onOverlaysChanged({ userId }: OverlayChangedEvent): void {
    this.alertOverlays.delete(userId);
    this.stageOverlays.delete(userId);
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
          await this.dispatch(userId, result.rule, action, event);
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

  private async dispatch(
    userId: string,
    rule: SharedRule,
    action: RuleAction,
    event: LiveEvent,
  ): Promise<void> {
    if (
      !RuleEngineService.OVERLAY_ACTIONS.has(action.type) &&
      !RuleEngineService.RELAYED_ACTIONS.has(action.type)
    ) {
      this.logger.warn(
        `Rule "${rule.name}" requested ${action.type}, which no connected surface handles yet`,
      );
      return;
    }

    // Key presses do not go to an overlay at all: they leave over the signed-in
    // dashboard socket, because an overlay's credential is a public token that
    // gets pasted into OBS and is routinely visible on stream.
    if (action.type === RuleActionType.GAME_INPUT) {
      this.dispatchGameInput(userId, rule, action);
      return;
    }

    // Battle actions are dispatched to the BattleService to process team targeting and log the event.
    if (action.type === RuleActionType.GAME_BATTLE_ACTION) {
      this.dispatchGameBattleAction(userId, rule, action, event);
      return;
    }

    let payload = this.normalisePayload(action, event);

    // Runs after normalisePayload so the caption is interpolated before it is
    // truncated. An EFFECT with no recognisable `kind` has nothing to draw, and
    // dropping it here keeps a typo in the rule editor from reaching every
    // browser source on every matching gift.
    if (action.type === RuleActionType.EFFECT) {
      const effect = readEffectPayload(payload);
      if (!effect) {
        this.logger.warn(
          `Rule "${rule.name}" has an effect action with no usable kind; skipping`,
        );
        return;
      }
      payload = effect as unknown as Record<string, unknown>;
    }

    if (action.type === RuleActionType.TTS_READ) {
      const speech = await this.synthesise(userId, rule, payload);
      if (!speech) return;
      payload = speech;
    }

    const overlayAction: OverlayAction = {
      id: uuidv4(),
      ruleId: rule.id,
      ruleName: rule.name,
      type: action.type,
      payload,
      event: projectEvent(event),
      createdAt: new Date().toISOString(),
    };

    // Targeted at one overlay rather than broadcast to the user's room. A
    // streamer with both a chat and an alerts source open would otherwise get
    // the same line spoken twice, once from each browser source.
    const overlayId = await this.resolveOverlayFor(userId, action.type);
    if (!overlayId) {
      this.logger.warn(
        `Rule "${rule.name}" matched but user ${userId} has no enabled overlay to render it`,
      );
      return;
    }

    const dispatchEvent: OverlayDispatchEvent = { userId, action: overlayAction, overlayId };
    this.eventEmitter.emit(OVERLAY_DISPATCH_EVENT, dispatchEvent);
  }

  /**
   * Relay a key press toward the streamer's machine.
   *
   * Nothing is executed here — the server cannot reach a keyboard. The bridge
   * on the streamer's machine owns the allowlist, the hold clamp, the per-key
   * cooldown, the per-minute ceiling and the emergency stop, and re-checks all
   * of them. The validation below only stops a rule that could never work from
   * crossing the network on every matching gift.
   */
  private dispatchGameInput(userId: string, rule: SharedRule, action: RuleAction): void {
    const input = readGameInput(action.payload);
    if (!input) {
      this.logger.warn(`Rule "${rule.name}" has a game input action with no usable key code`);
      return;
    }

    const dispatch: GameInputDispatch = {
      userId,
      command: { id: uuidv4(), ruleName: rule.name, ...input },
    };
    this.eventEmitter.emit(GAME_INPUT_EVENT, dispatch);
  }

  /**
   * Relay a game battle action to the BattleService.
   */
  private dispatchGameBattleAction(userId: string, rule: SharedRule, action: RuleAction, event: LiveEvent): void {
    const dispatch: BattleActionDispatchEvent = {
      userId,
      action,
      event,
    };
    this.eventEmitter.emit(BATTLE_ACTION_DISPATCH, dispatch);
  }

  /**
   * Turn the rule's text into audio before the action leaves the server.
   *
   * The overlay is authenticated by a public token alone, so it cannot call the
   * metered TTS endpoint itself — it has no access token and no identity to
   * bill. Synthesising here keeps the credit ledger on the side of the wire
   * that knows who the user is, and hands the browser source a URL it only has
   * to play.
   */
  private async synthesise(
    userId: string,
    rule: SharedRule,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const text = typeof payload.text === 'string' ? payload.text.trim() : '';
    if (text === '') {
      this.logger.warn(`Rule "${rule.name}" has a TTS action with no text`);
      return null;
    }

    const settings = await this.prisma.ttsSettings.findUnique({ where: { userId } });

    try {
      const result = await this.ttsService.synthesize(
        {
          text,
          voice: settings?.voiceId ?? 'vi-VN-Wavenet-A',
          rate: settings?.rate ?? 1,
          pitch: settings?.pitch ?? 0,
        },
        userId,
      );
      return { ...payload, text, audioUrl: result.url, volume: settings?.volume ?? 1 };
    } catch (err) {
      // Running out of credits mid-broadcast is an expected state, not a fault.
      // It must not take the rest of the rule's actions down with it.
      this.logger.warn(
        `TTS for rule "${rule.name}" skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /**
   * Pick the browser source that should render this action.
   *
   * EFFECT actions belong on the stage overlay, which is a separate OBS source
   * sized to the whole canvas — an alert popup is usually a small corner box,
   * so smoke and confetti rendered there would be clipped to it. Users who have
   * not added a stage overlay yet still get the effect, on their alerts source,
   * rather than nothing at all.
   */
  private async resolveOverlayFor(
    userId: string,
    actionType: RuleActionType,
  ): Promise<string | null> {
    if (actionType === RuleActionType.EFFECT) {
      const stage = await this.resolveStageOverlay(userId);
      if (stage) return stage;
    }
    return this.resolveAlertOverlay(userId);
  }

  /**
   * Unlike the alerts lookup this caches a negative result, because it has a
   * fallback and must not re-query on every single event for the many users who
   * will never add a stage overlay. `OVERLAY_CHANGED_EVENT` clears the entry the
   * moment one is created.
   */
  private async resolveStageOverlay(userId: string): Promise<string | null> {
    const cached = this.stageOverlays.get(userId);
    if (cached !== undefined) return cached;

    const overlay = await this.prisma.overlay.findFirst({
      where: { userId, type: 'STAGE', enabled: true },
      select: { id: true },
    });

    const id = overlay?.id ?? null;
    this.stageOverlays.set(userId, id);
    return id;
  }

  private async resolveAlertOverlay(userId: string): Promise<string | null> {
    if (this.alertOverlays.has(userId)) {
      const cached = this.alertOverlays.get(userId);
      if (cached) return cached;
    }

    let overlay = await this.prisma.overlay.findFirst({
      where: { userId, type: 'MEDIA' },
      select: { id: true },
    });

    if (!overlay) {
      // Auto-create default MEDIA and CHAT overlays for user if not created yet
      await this.prisma.overlay
        .createMany({
          data: [
            {
              userId,
              type: 'MEDIA',
              publicToken: uuidv4().replace(/-/g, ''),
              config: {},
            },
            {
              userId,
              type: 'CHAT',
              publicToken: uuidv4().replace(/-/g, ''),
              config: {},
            },
          ],
        })
        .catch(() => undefined);

      overlay = await this.prisma.overlay.findFirst({
        where: { userId, type: 'MEDIA' },
        select: { id: true },
      });
    }

    if (overlay) {
      this.alertOverlays.set(userId, overlay.id);
      return overlay.id;
    }

    return null;
  }

  /**
   * Enforce the limits the shared types promise are applied server-side.
   *
   * `durationMs` comes from user-authored rule JSON. Left unclamped, a typo of
   * 300000 pins a video over the broadcast for five minutes with no way to
   * dismiss it from the overlay.
   */
  private normalisePayload(action: RuleAction, event: LiveEvent): Record<string, unknown> {
    const payload = { ...action.payload };

    // {sender}/{gift}/{coins} are substituted here, not only in the browser.
    // The media overlay does its own substitution for captions, but speech is
    // synthesised on the server — an uninterpolated template would be read out
    // loud, literally, as "dấu ngoặc sender".
    for (const key of ['text', 'caption'] as const) {
      if (typeof payload[key] === 'string') {
        payload[key] = interpolate(payload[key] as string, event);
      }
    }

    if (action.type === RuleActionType.MEDIA_POPUP) {
      const raw = payload as { durationMs?: number };
      payload.durationMs = clampMediaDuration(raw.durationMs);
    }

    return payload;
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
 * Fill the placeholders a rule author can use in captions and speech.
 *
 * Unknown placeholders are left alone rather than blanked: seeing `{gifts}` on
 * screen tells the streamer they made a typo, where an empty gap does not.
 */
function interpolate(template: string, event: LiveEvent): string {
  return template
    .replace(/\{sender\}/g, event.senderDisplayName || 'Người xem')
    .replace(/\{gift\}/g, event.giftName || 'món quà')
    .replace(/\{coins\}/g, String(event.giftCoinValue ?? 0))
    .replace(/\{content\}/g, event.content || '');
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
