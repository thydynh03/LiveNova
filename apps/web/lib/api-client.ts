'use client';

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

export class NetworkError extends Error {
  constructor(message = 'Không kết nối được máy chủ') {
    super(message);
    this.name = 'NetworkError';
  }
}

let accessToken: string | null = null;
let onUnauthenticated: (() => void) | null = null;
let refreshInFlight: Promise<string | null> | null = null;
let refreshAbort: AbortController | null = null;

function cancelInFlightRefresh(): void {
  refreshAbort?.abort();
  refreshAbort = null;
  refreshInFlight = null;
}

let pendingLogins = 0;
let sessionGeneration = 0;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

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
    return { kind: 'unavailable' };
  }

  if (res.ok) {
    const data = (await res.json().catch(() => null)) as { accessToken?: string } | null;
    if (data?.accessToken) return { kind: 'ok', token: data.accessToken };
    return { kind: 'unavailable' };
  }

  return res.status === 401 || res.status === 403
    ? { kind: 'expired' }
    : { kind: 'unavailable' };
}

async function requestNewAccessToken(): Promise<string | null> {
  if (pendingLogins > 0) return null;
  if (refreshInFlight) return refreshInFlight;

  const generation = sessionGeneration;
  const controller = new AbortController();
  refreshAbort = controller;

  const attempt = (async (): Promise<string | null> => {
    const outcome = await performRefresh(controller.signal);

    if (generation !== sessionGeneration) return null;

    if (outcome.kind === 'ok') {
      accessToken = outcome.token;
      return accessToken;
    }

    if (outcome.kind === 'expired') {
      accessToken = null;
      try {
        onUnauthenticated?.();
      } catch {
        // ignore
      }
    }
    return null;
  })();

  refreshInFlight = attempt;

  void attempt
    .finally(() => {
      if (refreshInFlight === attempt) refreshInFlight = null;
      if (refreshAbort === controller) refreshAbort = null;
    })
    .catch(() => undefined);

  return attempt;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
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

export async function login(email: string, password: string, rememberMe?: boolean): Promise<string> {
  sessionGeneration += 1;
  cancelInFlightRefresh();
  pendingLogins += 1;

  let res: Response;
  let data: { accessToken?: string; message?: string } | null;

  try {
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password, rememberMe }),
      });
    } catch {
      throw new NetworkError();
    }

    data = (await res.json().catch(() => null)) as typeof data;

    if (!res.ok || !data?.accessToken) {
      throw new ApiError(data?.message ?? 'Đăng nhập thất bại', res.status);
    }
  } finally {
    pendingLogins -= 1;
    if (pendingLogins === 0) cancelInFlightRefresh();
  }

  accessToken = data.accessToken;
  return data.accessToken;
}

export async function register(email: string, password: string, displayName: string): Promise<string> {
  sessionGeneration += 1;
  cancelInFlightRefresh();
  pendingLogins += 1;

  let res: Response;
  let data: { accessToken?: string; message?: string } | null;

  try {
    try {
      res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password, displayName }),
      });
    } catch {
      throw new NetworkError();
    }

    data = (await res.json().catch(() => null)) as typeof data;

    if (!res.ok || !data?.accessToken) {
      throw new ApiError(data?.message ?? 'Đăng ký thất bại', res.status);
    }
  } finally {
    pendingLogins -= 1;
    if (pendingLogins === 0) cancelInFlightRefresh();
  }

  accessToken = data.accessToken;
  return data.accessToken;
}

export async function forgotPassword(email: string): Promise<{ success: boolean; resetToken?: string }> {
  return api.post<{ success: boolean; resetToken?: string }>('/auth/forgot-password', { email });
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
  return api.post<{ success: boolean }>('/auth/reset-password', { token, newPassword });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
  return api.post<{ success: boolean }>('/auth/change-password', { currentPassword, newPassword });
}

export async function updateProfile(data: { displayName?: string; avatar?: string; locale?: string; timezone?: string }): Promise<any> {
  return api.patch<any>('/users/me', data);
}

export async function getProfile(): Promise<any> {
  return api.get<any>('/users/me');
}

export async function listSessions(): Promise<{ sessions: any[] }> {
  return api.get<{ sessions: any[] }>('/auth/sessions');
}

export async function revokeSession(sessionId: string): Promise<{ success: boolean }> {
  return api.delete<{ success: boolean }>(`/auth/sessions/${sessionId}`);
}

export async function logout(): Promise<void> {
  sessionGeneration += 1;
  accessToken = null;
  cancelInFlightRefresh();

  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(
    () => undefined,
  );
}

export async function restoreSession(): Promise<string | null> {
  return requestNewAccessToken();
}

export function currentSessionGeneration(): number {
  return sessionGeneration;
}
