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
  TTS_READ = 'tts_read',
  EFFECT = 'effect',
  SOUND = 'sound',
  OBS_COMMAND = 'obs_command',
  GAME_INPUT = 'game_input',
  WEBHOOK = 'webhook',
}

export enum OverlayType {
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
