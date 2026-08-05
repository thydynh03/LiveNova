import 'server-only';

/**
 * Refresh-token cookie — server-side only.
 *
 * The NestJS API returns the refresh token in the response body. If the browser
 * stored that itself (localStorage, sessionStorage, a JS-readable cookie), any
 * XSS would hand an attacker a long-lived credential — which is exactly audit
 * finding §13.2 on the product we benchmarked against.
 *
 * So the Next.js route handlers act as a Backend-for-Frontend: they hold the
 * refresh token in an httpOnly cookie the page's JavaScript cannot read, and
 * only ever hand the short-lived access token to the client, in memory.
 */
export const REFRESH_COOKIE = 'ln_rt';

export function refreshCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/auth',
    maxAge: maxAgeSeconds,
  };
}

/** Base URL of the NestJS API as seen from the Next server (not the browser). */
export function apiBaseUrl(): string {
  return (
    process.env.SERVER_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:4001'
  );
}
