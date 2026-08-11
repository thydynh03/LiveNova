'use client';

import type { VrmModelMeta } from '@livenova/shared';

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

/**
 * Bumped by anything that starts or ends a session, so an in-flight refresh can
 * tell that its result is stale.
 */
let sessionGeneration = 0;

/**
 * Bumped by logout only.
 *
 * An auth exchange has to distinguish "the user logged out while my request was
 * in flight" (discard the token) from "another login landed first" (also stale,
 * but not an error the caller should see as a cancellation). Watching
 * sessionGeneration for this made two overlapping logins cancel each other.
 */
let logoutGeneration = 0;

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

  // 204 = the BFF found no refresh cookie: no session to restore.
  if (res.status === 204) return { kind: 'expired' };

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

async function performAuthExchange(
  url: string,
  payload: Record<string, unknown>,
  defaultErrorMessage: string,
): Promise<string> {
  const initialLogoutGeneration = logoutGeneration;
  cancelInFlightRefresh();
  pendingLogins += 1;

  let res: Response;
  let data: { accessToken?: string; message?: string } | null;

  try {
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
    } catch {
      throw new NetworkError();
    }

    data = (await res.json().catch(() => null)) as typeof data;

    if (!res.ok || !data?.accessToken) {
      const rawMsg = (data as any)?.message;
      const msg = Array.isArray(rawMsg)
        ? rawMsg.join(', ')
        : (typeof rawMsg === 'string' ? rawMsg : null) ?? defaultErrorMessage;
      throw new ApiError(msg, res.status);
    }

    // Only discard the response if logout() occurred while the request was in flight.
    if (initialLogoutGeneration !== logoutGeneration) {
      throw new ApiError('Thao tác đã bị hủy', 401);
    }
  } finally {
    pendingLogins -= 1;
    if (pendingLogins === 0) cancelInFlightRefresh();
  }

  // A successful sign-in starts a new session, so the generation has to move.
  // Without this, a refresh that began before the login and resolves after it
  // still passes its own generation check and overwrites the fresh token with
  // the previous session's. The extraction of this helper dropped the bump.
  sessionGeneration += 1;
  accessToken = data.accessToken;
  return data.accessToken;
}

export async function login(
  email: string,
  password: string,
  rememberMe?: boolean,
  turnstileToken?: string,
): Promise<string> {
  // Forwarded verbatim by the BFF route, which does not inspect the body — the
  // token is checked by the API, the only place a caller cannot skip.
  return performAuthExchange(
    '/api/auth/login',
    { email, password, rememberMe, turnstileToken },
    'Đăng nhập thất bại',
  );
}

export async function register(
  email: string,
  password: string,
  displayName: string,
  turnstileToken?: string,
): Promise<{ pendingVerification: boolean; email: string }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, displayName, turnstileToken }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.message ?? 'Đăng ký thất bại', res.status);
  }
  return data;
}

export async function verifyOtp(email: string, code: string, type: 'REGISTER' | 'FORGOT_PASSWORD' = 'REGISTER'): Promise<string> {
  return performAuthExchange('/api/auth/verify-otp', { email, code, type }, 'Mã OTP không hợp lệ hoặc đã hết hạn');
}

export async function resendOtp(email: string, type: 'REGISTER' | 'FORGOT_PASSWORD' = 'REGISTER'): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/auth/resend-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, type }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.message ?? 'Gửi lại mã OTP thất bại', res.status);
  }
  return data;
}

export async function forgotPassword(
  email: string,
  turnstileToken?: string,
): Promise<{ success: boolean; message?: string }> {
  return api.post<{ success: boolean; message?: string }>('/auth/forgot-password', {
    email,
    turnstileToken,
  });
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<{ success: boolean }> {
  return api.post<{ success: boolean }>('/auth/reset-password', { email, code, newPassword });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
  return api.post<{ success: boolean }>('/auth/change-password', { currentPassword, newPassword });
}

export async function updateProfile(data: { displayName?: string; avatar?: string; locale?: string; timezone?: string }): Promise<any> {
  return api.patch<any>('/users/me', data);
}

export async function uploadImage(file: File): Promise<{ url: string; publicId: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const token = getAccessToken();
  const res = await fetch(`${apiBase()}/upload/image`, {
    method: 'POST',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = Array.isArray(err?.message) ? err.message.join(', ') : (err?.message || 'Tải ảnh lên thất bại');
    throw new ApiError(message, res.status);
  }

  return res.json();
}

export async function uploadMedia(file: File): Promise<{ url: string; publicId: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const token = getAccessToken();
  const res = await fetch(`${apiBase()}/upload/media`, {
    method: 'POST',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = Array.isArray(err?.message) ? err.message.join(', ') : (err?.message || 'Tải tệp lên thất bại');
    throw new ApiError(message, res.status);
  }

  return res.json();
}

/**
 * Câu thay thế khi phản hồi lỗi không mang theo lời giải thích nào.
 *
 * Tình huống có thật đã xảy ra: máy chủ trả 503, giao diện hiện "Tải mô hình
 * VRM lên thất bại", và không ai — kể cả người viết ra nó — phân biệt được đây
 * là máy chủ đang khởi động lại sau một lần deploy, hay là máy chủ đã từ chối
 * vì thiếu cấu hình kho lưu trữ. Hai nguyên nhân đó cần hai hành động trái
 * ngược nhau: một cái là chờ, cái kia là đi sửa biến môi trường.
 *
 * Nên khi thân phản hồi im lặng, mã trạng thái phải tự nói.
 */
function describeUploadFailure(status: number): string {
  if (status === 503) {
    return (
      'Máy chủ hiện không nhận được tệp (503). Nếu vừa deploy lại thì đợi một phút rồi thử lại; ' +
      'nếu lỗi lặp lại, máy chủ API chưa cấu hình kho lưu trữ đám mây (CLOUDINARY_CLOUD_NAME, ' +
      'CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).'
    );
  }
  if (status === 413) {
    return 'Tệp quá lớn so với giới hạn máy chủ chấp nhận.';
  }
  if (status === 401 || status === 403) {
    return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi tải lên lần nữa.';
  }
  if (status >= 500) {
    return `Máy chủ gặp lỗi khi xử lý tệp (${status}). Hãy thử lại sau ít phút.`;
  }
  return `Tải mô hình VRM lên thất bại (${status}).`;
}

/**
 * Tải mô hình VRM cho nhân vật trên sân khấu.
 *
 * Máy chủ đọc giấy phép nhúng trong tệp và từ chối mô hình không cho phép
 * doanh nghiệp dùng thương mại, nên `message` trong lỗi 400 là câu giải thích
 * dành cho người dùng — hiển thị nguyên văn, đừng thay bằng câu chung chung.
 */
export async function uploadVrmModel(file: File): Promise<{
  url: string;
  publicId: string;
  bytes: number;
  meta: VrmModelMeta;
}> {
  const formData = new FormData();
  formData.append('file', file);

  const token = getAccessToken();
  const res = await fetch(`${apiBase()}/upload/vrm`, {
    method: 'POST',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const fromServer = Array.isArray(err?.message) ? err.message.join(', ') : err?.message;
    throw new ApiError(fromServer || describeUploadFailure(res.status), res.status);
  }

  return res.json();
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

/**
 * Free voice preview.
 *
 * This goes to the API rather than a Next route handler. A route handler that
 * called the speech provider directly would sit outside the API's auth guard,
 * length validation and per-route throttle — an unauthenticated endpoint
 * anyone could drive as a free speech proxy.
 */
export async function previewTts(req: {
  text: string;
  voice: string;
  pitch?: number;
  rate?: number;
}): Promise<{ url: string }> {
  return api.post<{ url: string }>('/tts/preview', req);
}

export async function logout(): Promise<void> {
  logoutGeneration += 1;
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
