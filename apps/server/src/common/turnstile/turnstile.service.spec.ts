import { ForbiddenException } from '@nestjs/common';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  let service: TurnstileService;
  const originalFetch = global.fetch;

  const mockFetch = (impl: () => Promise<unknown>) => {
    global.fetch = jest.fn(impl) as unknown as typeof fetch;
  };

  const jsonResponse = (body: unknown, ok = true, status = 200) =>
    Promise.resolve({ ok, status, json: () => Promise.resolve(body) });

  beforeEach(() => {
    process.env.TURNSTILE_SECRET = 'test-secret';
    service = new TurnstileService();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.TURNSTILE_SECRET;
    jest.restoreAllMocks();
  });

  it('lets a verified token through', async () => {
    mockFetch(() => jsonResponse({ success: true }));
    await expect(service.assertHuman('good-token', '1.2.3.4')).resolves.toBeUndefined();
  });

  it('sends the secret, the token and the caller address in the documented shape', async () => {
    const spy = jest.fn(() => jsonResponse({ success: true }));
    mockFetch(spy);

    await service.assertHuman('tok', '203.0.113.7');

    const [url, init] = (spy as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('secret')).toBe('test-secret');
    expect(body.get('response')).toBe('tok');
    expect(body.get('remoteip')).toBe('203.0.113.7');
  });

  it('omits remoteip rather than sending an empty one', async () => {
    const spy = jest.fn(() => jsonResponse({ success: true }));
    mockFetch(spy);

    await service.assertHuman('tok', undefined);

    const [, init] = (spy as jest.Mock).mock.calls[0] as [string, RequestInit];
    // An empty string is not "no value" to Cloudflare; it is an invalid one.
    expect(new URLSearchParams(init.body as string).has('remoteip')).toBe(false);
  });

  it('rejects when Cloudflare says the token is not valid', async () => {
    mockFetch(() => jsonResponse({ success: false, 'error-codes': ['invalid-input-response'] }));
    await expect(service.assertHuman('bad', '1.2.3.4')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a request that carries no token at all', async () => {
    const spy = jest.fn(() => jsonResponse({ success: true }));
    mockFetch(spy);

    await expect(service.assertHuman(undefined)).rejects.toBeInstanceOf(ForbiddenException);
    // And does not spend a round trip asking Cloudflare about nothing.
    expect(spy).not.toHaveBeenCalled();
  });

  it('fails closed when siteverify is unreachable', async () => {
    mockFetch(() => Promise.reject(new Error('ECONNREFUSED')));
    // Failing open here would remove the protection at precisely the moment
    // somebody is motivated to attack the verification path itself.
    await expect(service.assertHuman('tok', '1.2.3.4')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fails closed on a non-2xx from siteverify', async () => {
    mockFetch(() => jsonResponse({}, false, 502));
    await expect(service.assertHuman('tok')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fails closed when the body is not JSON', async () => {
    mockFetch(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new Error('not json')) }),
    );
    await expect(service.assertHuman('tok')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not treat a truthy non-true success as a pass', async () => {
    mockFetch(() => jsonResponse({ success: 'true' }));
    // A string is not a boolean. Loose comparison here would accept a malformed
    // or spoofed body that never came from a real verification.
    await expect(service.assertHuman('tok')).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('when no secret is configured', () => {
    beforeEach(() => {
      delete process.env.TURNSTILE_SECRET;
      service = new TurnstileService();
    });

    it('reports itself disabled and waves requests through', async () => {
      const spy = jest.fn(() => jsonResponse({ success: true }));
      mockFetch(spy);

      // Absence of configuration is not a verification failure. `loadEnv`
      // refuses to boot production without the secret, so reaching this branch
      // means a developer machine or the test suite — where demanding a real
      // Cloudflare challenge would make the login form unusable offline.
      expect(service.isEnabled()).toBe(false);
      await expect(service.assertHuman(undefined)).resolves.toBeUndefined();
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
