/**
 * Environment for unit tests.
 *
 * loadEnv() deliberately refuses to start without real secrets (C-05), so tests
 * must provide them explicitly rather than relying on a fallback — which is the
 * whole point of removing the fallback.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-jwt-secret-value-that-is-long-enough-32';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-value-that-differs-32';
process.env.CORS_ORIGIN ??= 'http://localhost:3000';
process.env.DAILY_FREE_CREDITS ??= '100';
process.env.TTS_CHARS_PER_CREDIT ??= '200';
process.env.TTS_MAX_CHARS ??= '500';
process.env.TTS_CACHE_TTL_DAYS ??= '30';
