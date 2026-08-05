export const SYSTEM_LIMITS = {
  MAX_COMMENT_LENGTH: 200,
  MAX_QUEUE_SIZE: 20,
  DUPLICATE_COMMENT_WINDOW_MS: 30_000,
  GAME_INPUT_COOLDOWN_MS: 3_000,
  TTS_PREVIEW_RATE_LIMIT: 10, // per minute
  OVERLAY_TOKEN_BYTES: 32,
  MIN_PASSWORD_LENGTH: 8,
  MAX_TTS_SPEED: 2.0,
  MIN_TTS_SPEED: 0.5,
  LOW_CREDIT_THRESHOLD: 0.2, // 20%
  DEFAULT_DAILY_QUOTA: 100,
  MAX_TTS_CHARS_PER_CREDIT: 200,
  LOCAL_BRIDGE_PORT: 4000,
  LOCAL_BRIDGE_HOST: '127.0.0.1',
} as const;

export const DEFAULT_VOICES = [
  { id: 'vi-VN-Standard-A', name: 'Nữ 1 (Standard)', gender: 'female', locale: 'vi-VN' },
  { id: 'vi-VN-Standard-B', name: 'Nam 1 (Standard)', gender: 'male', locale: 'vi-VN' },
  { id: 'vi-VN-Wavenet-A', name: 'Nữ 2 (Wavenet)', gender: 'female', locale: 'vi-VN' },
  { id: 'vi-VN-Wavenet-B', name: 'Nam 2 (Wavenet)', gender: 'male', locale: 'vi-VN' },
] as const;

export const ERROR_CODES = {
  INSUFFICIENT_CREDIT: 'E_CREDIT_INSUFFICIENT',
  ACCOUNT_NOT_WHITELISTED: 'E_NOT_WHITELISTED',
  CHANNEL_ALREADY_LINKED: 'E_CHANNEL_LINKED',
  REGISTRATION_CLOSED: 'E_REGISTRATION_CLOSED',
  FOLLOWER_THRESHOLD: 'E_MIN_FOLLOWERS',
  INVALID_CATEGORY: 'E_INVALID_CATEGORY',
  TTS_PROVIDER_ERROR: 'E_TTS_PROVIDER',
  RATE_LIMITED: 'E_RATE_LIMITED',
  INVALID_OVERLAY_TOKEN: 'E_INVALID_TOKEN',
} as const;
