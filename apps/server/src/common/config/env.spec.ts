import { loadEnv, resetEnvCache } from './env';

/**
 * C-05 — the whole point of removing the `|| 'super-secret'` fallback is that a
 * misconfigured deploy must fail loudly. These tests hold that line.
 */
describe('loadEnv', () => {
  const original = { ...process.env };

  beforeEach(() => {
    resetEnvCache();
    process.env = { ...original };
  });

  afterAll(() => {
    process.env = original;
    resetEnvCache();
  });

  it('refuses to start without JWT_SECRET', () => {
    delete process.env.JWT_SECRET;
    expect(() => loadEnv()).toThrow(/JWT_SECRET/);
  });

  it('refuses to start without JWT_REFRESH_SECRET', () => {
    delete process.env.JWT_REFRESH_SECRET;
    expect(() => loadEnv()).toThrow(/JWT_REFRESH_SECRET/);
  });

  it('rejects a short secret', () => {
    process.env.JWT_SECRET = 'too-short';
    expect(() => loadEnv()).toThrow(/at least 32 characters/);
  });

  it('rejects identical access and refresh secrets', () => {
    const same = 'x'.repeat(40);
    process.env.JWT_SECRET = same;
    process.env.JWT_REFRESH_SECRET = same;
    expect(() => loadEnv()).toThrow(/must differ/);
  });

  it('rejects a wildcard CORS origin in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = '*';
    expect(() => loadEnv()).toThrow(/wildcard is rejected/);
  });

  it('rejects an empty CORS origin list in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ORIGIN;
    expect(() => loadEnv()).toThrow(/explicit origins/);
  });

  it('parses a comma-separated origin list', () => {
    process.env.CORS_ORIGIN = 'https://a.example, https://b.example';
    expect(loadEnv().corsOrigins).toEqual(['https://a.example', 'https://b.example']);
  });

  it('applies documented defaults for the metering knobs', () => {
    delete process.env.DAILY_FREE_CREDITS;
    delete process.env.TTS_CHARS_PER_CREDIT;
    const env = loadEnv();
    expect(env.dailyFreeCredits).toBe(100); // BR-01
    expect(env.ttsCharsPerCredit).toBe(200); // BR-03
  });

  it('rejects a non-numeric integer setting rather than silently using NaN', () => {
    process.env.DAILY_FREE_CREDITS = 'lots';
    expect(() => loadEnv()).toThrow(/must be an integer/);
  });
});
