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

async function performRefresh(): Promise<RefreshOutcome> {
  let res: Response;
  try {
    res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'same-origin',
    });
  } catch {
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

  refreshInFlight = (async () => {
    try {
      const outcome = await performRefresh();

      // A logout (or another reset) happened while this was in flight — its
      // result is stale and must not resurrect the session.
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
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
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

  // A fresh sign-in supersedes anything already in flight.
  sessionGeneration += 1;
  accessToken = data.accessToken;
  return data.accessToken;
}

export async function logout(): Promise<void> {
  // Invalidate first: any refresh still running is now stale and will not be
  // allowed to write its result back.
  sessionGeneration += 1;
  accessToken = null;
  refreshInFlight = null;

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
