/**
 * Regression tests for the auth races cubic found.
 *
 * Each of these failed before the fix in 943fc30; they exist so the same class
 * of bug cannot come back silently.
 */

const originalFetch = global.fetch;

type FetchMock = jest.Mock<Promise<Response>, [RequestInfo | URL, RequestInit?]>;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

/** Resolves only when released, so a request can be held mid-flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('api-client', () => {
  let fetchMock: FetchMock;
  let mod: typeof import('./api-client');

  beforeEach(async () => {
    jest.resetModules();
    fetchMock = jest.fn() as FetchMock;
    global.fetch = fetchMock as unknown as typeof fetch;
    // A fresh module instance per test: the access token and the session
    // generation live in module scope, so a shared instance would leak state
    // between cases and make the race tests meaningless.
    mod = await import('./api-client');
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('refresh failure handling', () => {
    it('ends the session when the refresh token is rejected', async () => {
      const onUnauth = jest.fn();
      mod.setUnauthenticatedHandler(onUnauth);
      fetchMock.mockResolvedValue(jsonResponse({ message: 'expired' }, 401));

      await mod.restoreSession();

      expect(onUnauth).toHaveBeenCalledTimes(1);
      expect(mod.getAccessToken()).toBeNull();
    });

    it('does NOT end the session when the API is merely unavailable', async () => {
      // A 503 used to sign every logged-in user out during a brief outage.
      const onUnauth = jest.fn();
      mod.setUnauthenticatedHandler(onUnauth);
      fetchMock.mockResolvedValue(jsonResponse({ message: 'down' }, 503));

      await mod.restoreSession();

      expect(onUnauth).not.toHaveBeenCalled();
    });

    it('does NOT end the session when the network throws', async () => {
      const onUnauth = jest.fn();
      mod.setUnauthenticatedHandler(onUnauth);
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      await mod.restoreSession();

      expect(onUnauth).not.toHaveBeenCalled();
    });
  });

  describe('concurrency', () => {
    it('collapses simultaneous refreshes into one upstream call', async () => {
      // Two refreshes would replay the same token and trip the API's reuse
      // detection, revoking the whole session family.
      const gate = deferred<Response>();
      fetchMock.mockReturnValue(gate.promise);

      const a = mod.restoreSession();
      const b = mod.restoreSession();

      gate.resolve(jsonResponse({ accessToken: 'fresh' }));
      await Promise.all([a, b]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('a refresh resolving after logout does not resurrect the session', async () => {
      const gate = deferred<Response>();
      fetchMock.mockImplementation((input) => {
        if (String(input).includes('/api/auth/refresh')) return gate.promise;
        return Promise.resolve(jsonResponse({ success: true }));
      });

      const refreshing = mod.restoreSession();
      await mod.logout();

      gate.resolve(jsonResponse({ accessToken: 'stale-but-valid' }));
      await refreshing;

      // The token was valid; it is simply no longer wanted.
      expect(mod.getAccessToken()).toBeNull();
    });
  });

  describe('login', () => {
    it('stores the access token and bumps the session generation', async () => {
      const before = mod.currentSessionGeneration();
      fetchMock.mockResolvedValue(jsonResponse({ accessToken: 'tok' }));

      await mod.login('a@b.c', 'password123');

      expect(mod.getAccessToken()).toBe('tok');
      expect(mod.currentSessionGeneration()).toBeGreaterThan(before);
    });

    it('surfaces the upstream message on failure', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ message: 'Sai mật khẩu' }, 401));

      await expect(mod.login('a@b.c', 'nope')).rejects.toThrow('Sai mật khẩu');
      expect(mod.getAccessToken()).toBeNull();
    });

    it('reports a network failure distinctly', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(mod.login('a@b.c', 'password123')).rejects.toBeInstanceOf(
        mod.NetworkError,
      );
    });

    it('tolerates a literal null JSON body', async () => {
      // `res.json()` yields null for a `null` body, which used to throw while
      // reading .accessToken and surface as an unhandled 500.
      fetchMock.mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => null,
      } as Response);

      await expect(mod.login('a@b.c', 'password123')).rejects.toBeInstanceOf(
        mod.ApiError,
      );
    });
  });
});
