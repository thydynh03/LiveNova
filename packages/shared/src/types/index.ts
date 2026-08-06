// === Enums ===
export enum LiveEventType {
  COMMENT = 'comment',
  GIFT = 'gift',
  LIKE = 'like',
  FOLLOW = 'follow',
  SHARE = 'share',
  JOIN = 'join',
}

export enum CreditReason {
  DAILY_GRANT = 'daily_grant',
  TTS = 'tts',
  PURCHASE = 'purchase',
  REFUND = 'refund',
  ADMIN = 'admin',
}

export enum RuleActionType {
  /** MVP — gift triggers a video/image popup on the OBS overlay. */
  MEDIA_POPUP = 'media_popup',
  TTS_READ = 'tts_read',
  EFFECT = 'effect',
  SOUND = 'sound',
  OBS_COMMAND = 'obs_command',
  GAME_INPUT = 'game_input',
  WEBHOOK = 'webhook',
}

export enum OverlayType {
  /** MVP overlay: renders MEDIA_POPUP actions. */
  MEDIA = 'media',
  CHATBOX = 'chatbox',
  PK_BAR = 'pk_bar',
  GOAL = 'goal',
  LEADERBOARD = 'leaderboard',
  TOP_VIEWER = 'top_viewer',
  ROOM_ENTRY = 'room_entry',
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

// === Core Interfaces ===
export interface LiveEvent {
  id: string;
  type: LiveEventType;
  channelId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatar?: string;
  content?: string;          // comment text
  giftName?: string;
  giftCoinValue?: number;
  likeCount?: number;
  occurredAt: Date;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatar?: string;
  role: UserRole;
  locale: 'vi' | 'en';
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditBalance {
  userId: string;
  balance: number;           // CHECK >= 0
  version: number;           // optimistic lock
  updatedAt: Date;
}

export interface CreditLedgerEntry {
  id: string;
  userId: string;
  delta: number;             // != 0
  reason: CreditReason;
  description?: string;
  balanceAfter: number;
  createdAt: Date;
}

export interface Rule {
  id: string;
  userId: string;
  name: string;
  enabled: boolean;
  priority: number;          // lower = higher priority
  conditions: RuleCondition;
  actions: RuleAction[];
  continueMatching: boolean;
  cooldownMs: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleCondition {
  eventType?: LiveEventType[];
  giftName?: string;
  minCoinValue?: number;
  maxCoinValue?: number;
  keywords?: string[];
  senderUsername?: string;
}

export interface RuleAction {
  type: RuleActionType;
  payload: Record<string, unknown>;
}

export interface TtsRequest {
  text: string;
  voice: string;
  speed: number;             // 0.5 - 2.0
  pitch: number;
}

export interface TtsCacheEntry {
  cacheKey: string;          // sha256(text+voice+params)
  audioUrl: string;
  createdAt: Date;
  lastHitAt: Date;
  hitCount: number;
}

export interface Overlay {
  id: string;
  userId: string;
  type: OverlayType;
  publicToken: string;       // unique, random >= 256 bit
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface LiveSession {
  id: string;
  userId: string;
  channelId: string;
  startedAt: Date;
  endedAt?: Date;
  totalViewers: number;
  totalCoins: number;
  totalComments: number;
}

export interface Transaction {
  id: string;
  userId: string;
  idempotencyKey: string;    // unique
  amountMinor: number;       // stored in smallest unit (VND dong)
  creditAmount: number;
  status: TransactionStatus;
  provider: 'vnpay' | 'momo' | 'stripe';
  createdAt: Date;
}

// === WebSocket Protocol ===
export interface WsEventPayload {
  event: string;
  data: unknown;
  timestamp: number;
}

export interface LocalBridgeMessage {
  type: 'live_event' | 'tts_audio' | 'effect' | 'obs_command' | 'control';
  payload: unknown;
  sessionToken: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay action protocol (MVP: gift → media popup)
//
// The server is the only producer of these messages. Overlay pages are pure
// consumers: they authenticate with an overlay token and render whatever
// arrives. Nothing an overlay sends can create an action.
// ─────────────────────────────────────────────────────────────────────────────

export type MediaKind = 'video' | 'image';

export type MediaPosition =
  | 'center'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

/** Payload of a RuleActionType.MEDIA_POPUP action. */
export interface MediaPopupPayload {
  mediaType: MediaKind;
  /** Absolute https:// URL of the video or image asset. */
  url: string;
  /** How long the popup stays on screen. Clamped server-side. */
  durationMs: number;
  position?: MediaPosition;
  /** 0..1, videos only. */
  volume?: number;
  /** Optional caption rendered above the media. */
  caption?: string;
}

export const MEDIA_POPUP_LIMITS = {
  MIN_DURATION_MS: 500,
  MAX_DURATION_MS: 30_000,
  DEFAULT_DURATION_MS: 5_000,
  /** Overlay drops the oldest queued item beyond this depth. */
  MAX_QUEUE_LENGTH: 20,
} as const;

/** The subset of a LiveEvent an overlay is allowed to see and render. */
export interface OverlayEventContext {
  type: LiveEventType;
  senderDisplayName: string;
  senderAvatar?: string;
  giftName?: string;
  giftCoinValue?: number;
  content?: string;
}

/** Envelope pushed to overlay clients over the `/overlay` namespace. */
export interface OverlayAction {
  /** Unique per dispatch — overlays use it to de-duplicate on reconnect. */
  id: string;
  ruleId: string;
  ruleName: string;
  type: RuleActionType;
  payload: Record<string, unknown>;
  event: OverlayEventContext;
  /** ISO-8601. */
  createdAt: string;
}

/** Socket.IO event names, shared so client and server cannot drift. */
export const OVERLAY_SOCKET = {
  NAMESPACE: '/overlay',
  /** server → client */
  ACTION: 'overlay.action',
  READY: 'overlay.ready',
  ERROR: 'overlay.error',
  /**
   * Continuous state, as opposed to one-shot actions.
   *
   * A goal bar is not an event: it has a value that is simply true right now,
   * and a browser source that reconnects mid-broadcast has to be told where the
   * bar stands without replaying every gift that got it there.
   */
  STATE: 'overlay.state',
} as const;

export const EVENTS_SOCKET = {
  NAMESPACE: '/events',
  AUTHENTICATE: 'authenticate',
  SUBSCRIBE_CHANNEL: 'subscribe_channel',
  UNSUBSCRIBE_CHANNEL: 'unsubscribe_channel',
  LIVE_EVENT: 'live_event',
} as const;

export function clampMediaDuration(ms: number | undefined): number {
  const value = typeof ms === 'number' && Number.isFinite(ms)
    ? ms
    : MEDIA_POPUP_LIMITS.DEFAULT_DURATION_MS;
  return Math.min(
    Math.max(value, MEDIA_POPUP_LIMITS.MIN_DURATION_MS),
    MEDIA_POPUP_LIMITS.MAX_DURATION_MS,
  );
}

/**
 * Contract between the rule engine (Dev A) and the overlay gateway (Dev B).
 *
 * A emits `overlay.dispatch` on the internal NestJS event bus; B's gateway is
 * the only consumer. Neither side needs to know how the other works — this
 * type is the entire seam between them.
 */
export const OVERLAY_DISPATCH_EVENT = 'overlay.dispatch';

/** Config an overlay of type GOAL reads from its own Overlay row. */
export interface GoalConfig {
  /** Coins required to fill the bar. */
  target: number;
  label: string;
}

export const GOAL_DEFAULTS: GoalConfig = {
  target: 10_000,
  label: 'Mục tiêu hôm nay',
};

export function readGoalConfig(config: unknown): GoalConfig {
  const raw = (config ?? {}) as Partial<Record<keyof GoalConfig, unknown>>;
  const target = typeof raw.target === 'number' && raw.target > 0
    ? Math.floor(raw.target)
    : GOAL_DEFAULTS.target;
  const label = typeof raw.label === 'string' && raw.label.trim() !== ''
    ? raw.label.trim()
    : GOAL_DEFAULTS.label;
  return { target, label };
}

/** Payload of an OVERLAY_SOCKET.STATE frame for a GOAL overlay. */
export interface GoalState {
  kind: 'goal';
  /** Coins accumulated so far. */
  current: number;
  target: number;
  label: string;
}

/** One side of a PK battle. */
export interface PkSide {
  hostDisplayName: string;
  score: number;
  /** Highest single contributor on this side, if the platform reported one. */
  mvpDisplayName?: string;
}

/** Payload of an OVERLAY_SOCKET.STATE frame for a PK_BAR overlay. */
export interface PkState {
  kind: 'pk';
  battleId: string;
  /** Exactly two sides; a multi-guest battle is reduced to the two teams. */
  sides: [PkSide, PkSide];
  /**
   * Absolute end time in epoch milliseconds.
   *
   * The overlay counts down from this rather than from a seconds-remaining
   * figure: a browser source that reconnects thirty seconds later would
   * otherwise restart the clock from a stale number.
   */
  endsAtMs: number;
  /** False once the platform reports the round has finished. */
  active: boolean;
}

export type OverlayState = GoalState | PkState;

/**
 * Internal bus event carrying a PK battle scoreboard.
 *
 * Separate from `live.*` because a battle is not something a viewer did: it has
 * no sender, and it describes a standing score rather than an occurrence.
 */
export const BATTLE_EVENT = 'live.battle';

export interface BattleUpdate {
  channelId: string;
  battleId: string;
  /** Platform status code; a finished round stops being active. */
  status: number;
  endsAtMs: number;
  teams: { hostDisplayName: string; score: number; mvpDisplayName?: string }[];
}

/** Internal bus event name for continuous overlay state. */
export const OVERLAY_STATE_EVENT = 'overlay.state';

/**
 * Emitted whenever a user's overlays change.
 *
 * Several services cache "which overlay renders what" per user. Going through
 * the bus keeps them from having to inject one another, which would tie the
 * overlay module to the rule module in one direction and back again.
 */
export const OVERLAY_CHANGED_EVENT = 'overlay.changed';

export interface OverlayChangedEvent {
  userId: string;
}

export interface OverlayStateDispatch {
  userId: string;
  overlayId: string;
  state: OverlayState;
}

export interface OverlayDispatchEvent {
  /** Owner of the overlay(s) this action should reach. */
  userId: string;
  action: OverlayAction;
  /** Optional: restrict delivery to one overlay instead of all of the user's. */
  overlayId?: string;
}

export * from './auth';
export * from './user-profile';

