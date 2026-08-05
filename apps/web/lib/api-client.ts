'use client';

/**
 * Browser-side API client.
 *
 * The access token lives in module memory only — never localStorage, never a
 * readable cookie. A page reload drops it and the client silently re-mints one
 * from the httpOnly refresh cookie via /api/auth/refresh.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Distinguishes "the server said no" from "the server said nothing". */
export class NetworkError extends Error {
  constructor(message = 'Không kết nối được máy chủ') {
    super(message);
    this.name = 'NetworkError';
  }
}

let accessToken: string | null = null;
let onUnauthenticated: (() => void) | null = null;

/** Single in-flight refresh, shared by every caller that hits a 401 at once. */
let refreshInFlight: Promise<string | null> | null = null;

/**
 * Lets a session change abort a refresh that is still on the wire.
 *
 * Dropping the promise reference is not enough. `/api/auth/refresh` rewrites the
 * httpOnly cookie from the route handler, so a late response would apply its
 * `Set-Cookie` no matter what the client did with the promise. On an account
 * switch that means the previous account's rotated token lands on top of the new
 * one, and the next refresh quietly mints an access token for the wrong user.
 *
 * Aborting stops the response from being processed at all. The trade-off: the
 * server may already have rotated, leaving this browser holding a consumed
 * token, whose next use trips reuse detection and revokes that family. Losing
 * the *old* session during a deliberate account switch is the acceptable side of
 * that trade; serving the wrong account's data is not.
 */
let refreshAbort: AbortController | null = null;

function cancelInFlightRefresh(): void {
  refreshAbort?.abort();
  refreshAbort = null;
  refreshInFlight = null;
}

/**
 * Bumped by logout (and any future session reset).
 *
 * Without it, signing out while a refresh is in flight lets the resolving
 * refresh write a valid token straight back into module memory — the user
 * believes they are signed out while the client keeps making authenticated
 * calls.
 */
let sessionGeneration = 0;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Registered by AuthProvider so a dead session can bounce the user to /login. */
export function setUnauthenticatedHandler(handler: (() => void) | null): void {
  onUnauthenticated = handler;
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';
}

type RefreshOutcome =
  | { kind: 'ok'; token: string }
  | { kind: 'expired' }
  | { kind: 'unavailable' };

async function performRefresh(signal: AbortSignal): Promise<RefreshOutcome> {
  let res: Response;
  try {
    res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
      signal,
    });
  } catch {
    // Includes AbortError. An aborted refresh is never an expired session.
    return { kind: 'unavailable' };
  }

  if (res.ok) {
    const data = (await res.json().catch(() => null)) as { accessToken?: string } | null;
    if (data?.accessToken) return { kind: 'ok', token: data.accessToken };
    return { kind: 'unavailable' };
  }

  // Only 401/403 means the credential itself is dead. A 5xx or 503 is the API
  // being briefly unavailable, and treating that as an expired session would
  // sign every user out during a short outage.
  return res.status === 401 || res.status === 403
    ? { kind: 'expired' }
    : { kind: 'unavailable' };
}

async function requestNewAccessToken(): Promise<string | null> {
  // Collapse concurrent refreshes: the API rotates the refresh token on every
  // use and treats a replayed one as reuse, revoking the whole family. Firing
  // two refreshes at once would log the user out.
  if (refreshInFlight) return refreshInFlight;

  const generation = sessionGeneration;
  const controller = new AbortController();
  refreshAbort = controller;

  const attempt = (async (): Promise<string | null> => {
    const outcome = await performRefresh(controller.signal);

    // A logout or login happened while this was in flight — its result is
    // stale and must not resurrect (or overwrite) the current session.
    if (generation !== sessionGeneration) return null;

    if (outcome.kind === 'ok') {
      accessToken = outcome.token;
      return accessToken;
    }

    if (outcome.kind === 'expired') {
      accessToken = null;
      onUnauthenticated?.();
    }
    return null;
  })();

  refreshInFlight = attempt;

  // Release the pointer only if it still refers to *this* attempt. Clearing it
  // unconditionally would let a settling old promise wipe the pointer for a
  // newer refresh, allowing two to run at once — the exact replay this
  // single-flight guard exists to prevent.
  void attempt.finally(() => {
    if (refreshInFlight === attempt) refreshInFlight = null;
    if (refreshAbort === controller) refreshAbort = null;
  });

  return attempt;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Internal: prevents an infinite refresh loop. */
  _retried?: boolean;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers, _retried, ...rest } = options;

  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      ...rest,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new NetworkError();
  }

  if (res.status === 401 && !_retried) {
    const fresh = await requestNewAccessToken();
    if (fresh) {
      return apiFetch<T>(path, { ...options, _retried: true });
    }
    // requestNewAccessToken already notified the auth provider if the session
    // was genuinely expired; this only reports the failed call.
    throw new ApiError('Phiên đăng nhập đã hết hạn', 401);
  }

  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as {
      message?: string | string[];
      type?: string;
    } | null;
    const raw = problem?.message;
    const message = Array.isArray(raw)
      ? raw.join(', ')
      : (raw ?? `Yêu cầu thất bại (${res.status})`);
    throw new ApiError(message, res.status, problem?.type);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

/** Exchanges credentials via the BFF route, which sets the httpOnly cookie. */
export async function login(email: string, password: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new NetworkError();
  }

  const data = (await res.json().catch(() => null)) as {
    accessToken?: string;
    message?: string;
  } | null;

  if (!res.ok || !data?.accessToken) {
    throw new ApiError(data?.message ?? 'Đăng nhập thất bại', res.status);
  }

  // A fresh sign-in supersedes anything already in flight — and the old refresh
  // must be aborted, not merely forgotten, so its Set-Cookie can never land on
  // top of the cookie this login just established.
  sessionGeneration += 1;
  cancelInFlightRefresh();
  accessToken = data.accessToken;
  return data.accessToken;
}

export async function logout(): Promise<void> {
  // Invalidate first: any refresh still running is now stale, and aborting it
  // stops a late response from rewriting the cookie we are about to clear.
  sessionGeneration += 1;
  accessToken = null;
  cancelInFlightRefresh();

  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(
    () => undefined,
  );
}

/** Called once on app start to restore a session from the refresh cookie. */
export async function restoreSession(): Promise<string | null> {
  return requestNewAccessToken();
}

/** Test/diagnostic helper. */
export function currentSessionGeneration(): number {
  return sessionGeneration;
}
