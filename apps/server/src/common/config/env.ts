/**
 * C-05 — Fail-fast environment validation.
 *
 * There is deliberately NO fallback for any secret. A missing JWT secret used to
 * silently degrade to the literal string 'super-secret', which meant a
 * misconfigured deploy would happily sign forgeable tokens. Now the process
 * refuses to start.
 */

const MIN_SECRET_LENGTH = 32;

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `[env] Missing required environment variable: ${name}. ` +
        `Refusing to start. See .env.example.`,
    );
  }
  return value;
}

function requiredSecret(name: string): string {
  const value = required(name);
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `[env] ${name} must be at least ${MIN_SECRET_LENGTH} characters ` +
        `(got ${value.length}). Generate one with: openssl rand -base64 48`,
    );
  }
  return value;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`[env] ${name} must be an integer, got "${raw}"`);
  }
  return parsed;
}

function csv(name: string, fallback: string[] = []): string[] {
  const raw = process.env[name];
  if (!raw || raw.trim() === '') return fallback;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface AppEnv {
  nodeEnv: string;
  isProduction: boolean;
  port: number;

  jwtSecret: string;
  jwtRefreshSecret: string;
  accessTokenTtl: string;
  refreshTokenTtlDays: number;

  /** Exact origins allowed for HTTP CORS and the Socket.IO handshake. */
  corsOrigins: string[];

  /** BR-01 — configurable, not hard-coded. */
  dailyFreeCredits: number;
  /** BR-03 — characters covered by one credit. */
  ttsCharsPerCredit: number;
  /** FR-016 hard cap on a single synthesis request. */
  ttsMaxChars: number;
  /** DR-03 — TTS cache TTL in days. */
  ttsCacheTtlDays: number;
}

let cached: AppEnv | null = null;

export function loadEnv(): AppEnv {
  if (cached) return cached;

  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  const jwtSecret = requiredSecret('JWT_SECRET');
  const jwtRefreshSecret = requiredSecret('JWT_REFRESH_SECRET');

  // C-06 — using one secret for both token kinds lets an access token be replayed
  // as a refresh token. Keep them distinct.
  if (jwtSecret === jwtRefreshSecret) {
    throw new Error('[env] JWT_SECRET and JWT_REFRESH_SECRET must differ.');
  }

  const corsOrigins = csv('CORS_ORIGIN', isProduction ? [] : ['http://localhost:3000']);

  // M-06 — a wildcard origin combined with credentials is both invalid per the
  // CORS spec and unsafe. Never allow it to slip into production.
  if (isProduction && (corsOrigins.length === 0 || corsOrigins.includes('*'))) {
    throw new Error(
      '[env] CORS_ORIGIN must list explicit origins in production (wildcard is rejected).',
    );
  }

  cached = {
    nodeEnv,
    isProduction,
    port: optionalInt('PORT', 4001),
    jwtSecret,
    jwtRefreshSecret,
    accessTokenTtl: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshTokenTtlDays: optionalInt('JWT_REFRESH_EXPIRES_DAYS', 30),
    corsOrigins,
    dailyFreeCredits: optionalInt('DAILY_FREE_CREDITS', 100),
    ttsCharsPerCredit: optionalInt('TTS_CHARS_PER_CREDIT', 200),
    ttsMaxChars: optionalInt('TTS_MAX_CHARS', 500),
    ttsCacheTtlDays: optionalInt('TTS_CACHE_TTL_DAYS', 30),
  };

  return cached;
}

/** Test helper — clears the memoised environment. */
export function resetEnvCache(): void {
  cached = null;
}
