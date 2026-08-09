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

  /**
   * Public origin of the web app, used to build absolute URLs for bundled
   * assets referenced by rule presets.
   *
   * Derived from the first configured CORS origin rather than a separate
   * variable, because that origin is already required to be the real public
   * address of the front end and a second knob would only let the two drift.
   */
  publicWebUrl: string;

  /**
   * Redis connection string, or null for single-instance mode.
   *
   * Null is a legitimate configuration — a solo streamer running one process
   * needs no coordination and should not be forced to run Redis. But it is only
   * legitimate for **one** process. With it unset, two replicas each keep their
   * own copy of every live battle, each run their own one-second energy tick on
   * it, and each flush their divergent scores over the other's every two
   * seconds; meanwhile a Socket.IO room broadcast never leaves the instance that
   * emitted it, so an overlay attached to the other replica goes dark forever
   * without a single error being logged.
   *
   * Production therefore has to say out loud that it is single-instance, via
   * `ALLOW_SINGLE_INSTANCE=true`, rather than arriving at it by forgetting to
   * set a variable.
   */
  redisUrl: string | null;

  /** Set when production deliberately runs one process with no Redis. */
  allowSingleInstance: boolean;

  /**
   * Identifies this process in the ownership leases it takes on battles.
   *
   * Defaults to a random value per boot. A restarted process must not inherit
   * its own previous lease, because the state that lease protected died with
   * it — it has to wait out the TTL and rebuild from the database like any
   * other claimant.
   */
  instanceId: string;
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

  const redisUrl = process.env.REDIS_URL?.trim() || null;
  const allowSingleInstance = process.env.ALLOW_SINGLE_INSTANCE === 'true';

  // Refusing to start is the only reliable way to surface this. The failure it
  // prevents is silent by nature: nothing throws, nothing logs, the overlay
  // simply stops updating for whichever half of the audience is attached to the
  // wrong replica.
  if (isProduction && !redisUrl && !allowSingleInstance) {
    throw new Error(
      '[env] REDIS_URL is required in production, or set ALLOW_SINGLE_INSTANCE=true ' +
        'to confirm this deployment really does run exactly one process. Two processes ' +
        'without Redis will double-count energy, overwrite each other\'s scores, and ' +
        'leave overlays connected to the other instance frozen with no error.',
    );
  }

  cached = {
    nodeEnv,
    isProduction,
    redisUrl,
    allowSingleInstance,
    instanceId:
      process.env.INSTANCE_ID?.trim() ||
      `${process.pid}-${Math.random().toString(36).slice(2, 10)}`,
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
    publicWebUrl: (process.env.PUBLIC_WEB_URL ?? corsOrigins[0] ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    ),
  };

  return cached;
}

/** Test helper — clears the memoised environment. */
export function resetEnvCache(): void {
  cached = null;
}
