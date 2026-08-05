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

let accessToken: string | null = null;
let onUnauthenticated: (() => void) | null = null;

/** Single in-flight refresh, shared by every caller that hits a 401 at once. */
let refreshInFlight: Promise<string | null> | null = null;

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

async function requestNewAccessToken(): Promise<string | null> {
  // Collapse concurrent refreshes: the API rotates the refresh token on every
  // use and treats a replayed one as reuse, revoking the whole family. Firing
  // two refreshes at once would log the user out.
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { accessToken?: string };
      accessToken = data.accessToken ?? null;
      return accessToken;
    } catch {
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

  const res = await fetch(`${apiBase()}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !_retried) {
    const fresh = await requestNewAccessToken();
    if (fresh) {
      return apiFetch<T>(path, { ...options, _retried: true });
    }
    onUnauthenticated?.();
    throw new ApiError('Phiên đăng nhập đã hết hạn', 401);
  }

  if (!res.ok) {
    const problem = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
      type?: string;
    };
    const message = Array.isArray(problem.message)
      ? problem.message.join(', ')
      : (problem.message ?? `Yêu cầu thất bại (${res.status})`);
    throw new ApiError(message, res.status, problem.type);
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
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ email, password }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    accessToken?: string;
    message?: string;
  };

  if (!res.ok || !data.accessToken) {
    throw new ApiError(data.message ?? 'Đăng nhập thất bại', res.status);
  }

  accessToken = data.accessToken;
  return data.accessToken;
}

export async function logout(): Promise<void> {
  accessToken = null;
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(
    () => undefined,
  );
}

/** Called once on app start to restore a session from the refresh cookie. */
export async function restoreSession(): Promise<string | null> {
  return requestNewAccessToken();
}
