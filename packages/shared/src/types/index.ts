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
  /**
   * A rule asked for a key press on the streamer's machine.
   *
   * This rides the authenticated dashboard socket rather than the overlay one.
   * An overlay authenticates with a public token that gets pasted into OBS and
   * is routinely visible on stream; anything that can move the streamer's
   * keyboard must never travel on a credential like that.
   */
  GAME_INPUT: 'game_input',
} as const;

/**
 * A key press for the desktop Local Bridge to perform.
 *
 * The server does not execute this — it cannot reach the streamer's keyboard.
 * It relays the request to the signed-in dashboard, which forwards it to the
 * bridge running on the same machine. Every safety limit is enforced there,
 * because that is the only side that can guarantee it.
 */
export interface GameInputCommand {
  /** Unique per dispatch, so the bridge can ignore a repeat after a reconnect. */
  id: string;
  ruleName: string;
  /** Win32 virtual-key code. */
  vkCode: number;
  holdMs: number;
  cooldownMs: number;
}

/** Internal bus event carrying a GameInputCommand to the dashboard gateway. */
export const GAME_INPUT_EVENT = 'game.input';

export interface GameInputDispatch {
  userId: string;
  command: GameInputCommand;
}

/**
 * Read a GAME_INPUT action payload written by a rule author.
 *
 * Returns null when the payload cannot describe a key press at all. The bridge
 * re-checks everything against its own allowlist, but a rule that can never
 * work should not be relayed across the network on every matching gift.
 */
export function readGameInput(payload: unknown): Omit<GameInputCommand, 'id' | 'ruleName'> | null {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const vkCode = typeof raw.vkCode === 'number' ? Math.floor(raw.vkCode) : NaN;

  // Win32 virtual-key codes are a single byte.
  if (!Number.isFinite(vkCode) || vkCode < 1 || vkCode > 0xff) return null;

  const holdMs = typeof raw.holdMs === 'number' && raw.holdMs > 0 ? Math.floor(raw.holdMs) : 50;
  const cooldownMs =
    typeof raw.cooldownMs === 'number' && raw.cooldownMs > 0 ? Math.floor(raw.cooldownMs) : 1000;

  return { vkCode, holdMs, cooldownMs };
}

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

/** One side of a multi-team interactive battle. */
export interface BattleTeamState {
  key: string;
  name: string;
  color: string;
  score: number;
  energy: number;
  castleHp: number;
  maxHp: number;
  giftNames: string[];
  castleAsset?: string;
  avatarUrl?: string;
  quote?: string;
  motto?: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  soldierCount?: number;
}

/** Top donor contributor to a team in the battle. */
export interface BattleDonor {
  username: string;
  nickname: string;
  avatarUrl?: string;
  teamKey: string;
  totalScore: number;
}

/** Live combat event triggered during the battle. */
export interface BattleEventLog {
  id: string;
  teamKey: string;
  sender: string;
  actionKey: string;
  giftName?: string;
  giftCount?: number;
  powerAdded: number;
  quote?: string;
  targetTeamKey?: string;
  timestamp: number;
}

export interface BattleMapPreset {
  id: string;
  name: string;
  thumbnail: string;
  description: string;
  category: 'fantasy' | 'elemental' | 'cartoon' | 'vector';
  backgroundUrl: string;
}

export const BATTLE_MAP_PRESETS: BattleMapPreset[] = [
  {
    id: 'fantasy_kingdoms',
    name: 'Vương Quốc Huyền Ảo (AI Gen)',
    thumbnail: '/maps/map_kingdom_fantasy.jpg',
    backgroundUrl: '/maps/map_kingdom_fantasy.jpg',
    category: 'fantasy',
    description: 'Chiến trường 4 lâu đài thần thoại với sông thập tự pha lê và đài ấn chú trung tâm.',
  },
  {
    id: 'lava_frost',
    name: 'Dung Nham & Băng Tuyết (AI Gen)',
    thumbnail: '/maps/map_lava_frost.jpg',
    backgroundUrl: '/maps/map_lava_frost.jpg',
    category: 'elemental',
    description: 'Cuộc chiến 4 nguyên tố: Núi lửa, Băng hà, Sa mạc sấm sét và Rừng cổ thụ.',
  },
  {
    id: 'classic_kingdoms',
    name: 'Đại Chiến 4 Vương Quốc (Classic Cartoon)',
    thumbnail: '/maps/map_kingdom_classic.png',
    backgroundUrl: '/maps/map_kingdom_classic.png',
    category: 'cartoon',
    description: 'Phong cách vẽ tay hoạt hình 2.5D sống động đặc trưng của các streamer TikTok hàng đầu.',
  },
  {
    id: 'vector_runic_river',
    name: 'Sông Runic Tối Giản (Vector 60FPS)',
    thumbnail: '/maps/map_kingdom_fantasy.jpg',
    backgroundUrl: '',
    category: 'vector',
    description: 'Đồ họa vector SVG siêu nhẹ, độ phân giải sắc nét 4K không tốn băng thông.',
  },
];

/** Continuous state for a GAME_BATTLE overlay. */
export interface BattleState {
  kind: 'battle';
  battleId: string;
  templateId?: string;
  mapTheme?: string;
  renderEngine?: '2d' | '3d';
  title?: string;
  teams: BattleTeamState[];
  topDonors: BattleDonor[];
  recentEvents: BattleEventLog[];
  winnerTeamKey?: string | null;
  endsAtMs: number;
  active: boolean;
  assets?: Record<string, string>;
}

export type OverlayState = GoalState | PkState | BattleState;

/**
 * Asset keys the battle renderer looks for.
 *
 * Named here so the admin editor, the seed and the renderer agree. A key the
 * template does not supply falls back to a built-in drawing rather than leaving
 * a hole on the broadcast.
 */
/**
 * How a troop sprite sheet is laid out.
 *
 * Frames run left to right in a single row, each frame square. The count is
 * derived from `width / height` rather than declared in config: an artist who
 * exports a different number of frames should not have to remember to update a
 * JSON field, and a mismatch there would show as a sheet that animates wrong
 * with nothing pointing at why.
 */
export const SPRITE_SHEET = {
  /** Frames per second the walk cycle plays at. */
  FPS: 8,
  /** Sheets wider than this many frames are almost certainly not a sheet. */
  MAX_FRAMES: 24,
} as const;

/** Castle artwork tiers, picked by remaining hit points. */
export const CASTLE_DAMAGE_TIERS = [
  { suffix: '', minHpPercent: 0.66 },
  { suffix: '_damaged', minHpPercent: 0.33 },
  { suffix: '_ruined', minHpPercent: 0 },
] as const;

/**
 * Asset key for a castle at its current health.
 *
 * Falls back through the tiers so a template that only supplies the intact
 * artwork still renders — a missing damaged sprite must not blank the castle
 * at the exact moment it is being attacked.
 */
export function castleAssetKey(
  teamKey: string,
  hp: number,
  maxHp: number,
  assets: Record<string, string> | undefined,
): string | undefined {
  if (!assets) return undefined;
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 1;

  const tier = CASTLE_DAMAGE_TIERS.find((t) => ratio >= t.minHpPercent) ?? CASTLE_DAMAGE_TIERS[2];
  const ordered = [tier, ...CASTLE_DAMAGE_TIERS.filter((t) => t !== tier)];

  for (const candidate of ordered) {
    const key = `castle_${teamKey}${candidate.suffix}`;
    if (assets[key]) return assets[key];
  }
  return undefined;
}

/**
 * Artwork shipped with the app, used when a template supplies none.
 *
 * Defaults to the AI-generated 6-frame running sprite sheets for 4 kingdoms.
 */
export const BATTLE_DEFAULT_ASSETS: Record<string, string> = {
  // Re-cut from the generated art, not regenerated.
  //
  // The four AI images were good drawings in unusable layouts: the dog came
  // back as a captioned contact sheet with cell borders printed into it, the
  // bear as a two-row grid of seven poses, the capybara as a 3x2 grid. Only the
  // cat was a single row. Rather than throw away the artwork, each sheet was
  // measured — figures located, printed borders erased, stray fragments
  // dropped — and re-laid into six square cells on one row. `walk_*.png`
  // are those outputs; the originals are in git history.
  //
  // The hand-drawn SVG strips under /battle remain the fallback for a template
  // that ships no sprite of its own.
  sprite_troop_cat: '/sprites/walk_cat.png',
  sprite_troop_dog: '/sprites/walk_dog.png',
  sprite_troop_bear: '/sprites/walk_bear.png',
  sprite_troop_capy: '/sprites/walk_capy.png',

  castle_cat: '/battle/castle_cat.svg',
  castle_cat_damaged: '/battle/castle_cat_damaged.svg',
  castle_cat_ruined: '/battle/castle_cat_ruined.svg',

  castle_dog: '/battle/castle_dog.svg',
  castle_dog_damaged: '/battle/castle_dog_damaged.svg',
  castle_dog_ruined: '/battle/castle_dog_ruined.svg',

  castle_bear: '/battle/castle_bear.svg',
  castle_bear_damaged: '/battle/castle_bear_damaged.svg',
  castle_bear_ruined: '/battle/castle_bear_ruined.svg',

  castle_capy: '/battle/castle_capy.svg',
  castle_capy_damaged: '/battle/castle_capy_damaged.svg',
  castle_capy_ruined: '/battle/castle_capy_ruined.svg',
};

/**
 * Template media laid over the built-in defaults.
 *
 * Merged on the client rather than baked into the state the server sends: the
 * defaults are static files this app owns, and sending sixteen known paths over
 * a socket on every state frame would be paying for nothing.
 */
export function resolveBattleAssets(
  templateAssets: Record<string, string> | undefined,
): Record<string, string> {
  return { ...BATTLE_DEFAULT_ASSETS, ...(templateAssets ?? {}) };
}

/** Sprite sheet for a kingdom's foot soldiers, if the template supplies one. */
export function troopSpriteUrl(
  teamKey: string,
  assets: Record<string, string> | undefined,
): string | undefined {
  return assets?.[`sprite_troop_${teamKey}`];
}

export const BATTLE_ASSET_KEYS = {
  MAP_BACKGROUND: 'map_background',
  /** `castle_<teamKey>`, optionally suffixed `_damaged` / `_ruined`. */
  CASTLE_PREFIX: 'castle_',
  /** `fx_<actionKey>` — the WebM-with-alpha cinematic for a big skill. */
  FX_PREFIX: 'fx_',
  /** `sprite_troop_<teamKey>` — horizontal walk-cycle sheet. */
  TROOP_SPRITE_PREFIX: 'sprite_troop_',
} as const;

/**
 * Which actions are worth interrupting the screen for.
 *
 * A soldier arriving every second must not dim the broadcast; a dragon should.
 */
export const CINEMATIC_ACTIONS: readonly string[] = ['dragon', 'cannon', 'meteor'];

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

