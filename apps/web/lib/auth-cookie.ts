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

/** Fallback lifetime when the API does not report one. */
export const DEFAULT_REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

export function refreshCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/auth',
    maxAge: maxAgeSeconds,
  };
}

/**
 * Cookie lifetime derived from the API's own expiry, so the browser and the
 * server stop trusting the session at the same moment. A hard-coded 30 days
 * would outlive a shorter server-side TTL and leave the user holding a cookie
 * that no longer works.
 */
export function maxAgeFromExpiry(expiresAt: string | undefined): number {
  if (!expiresAt) return DEFAULT_REFRESH_MAX_AGE;

  const expiry = Date.parse(expiresAt);
  if (Number.isNaN(expiry)) return DEFAULT_REFRESH_MAX_AGE;

  const seconds = Math.floor((expiry - Date.now()) / 1000);
  // Reject nonsense (already expired, or absurdly far out) rather than trusting
  // it: this value comes off the wire.
  if (seconds <= 0) return 0;
  return Math.min(seconds, DEFAULT_REFRESH_MAX_AGE * 12);
}

/**
 * Base URL of the NestJS API as seen from the Next.js server.
 *
 * This must NOT fall back to NEXT_PUBLIC_API_URL. That variable holds the URL
 * the *browser* uses; inside a container `localhost:4001` is the web container
 * itself, not the API. Docker Compose sets SERVER_API_URL to the service name.
 */
export function apiBaseUrl(): string {
  const explicit = process.env.SERVER_API_URL;
  if (explicit) return explicit;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[auth] SERVER_API_URL is required in production — it is the internal ' +
        'address of the API, which is not the same as NEXT_PUBLIC_API_URL.',
    );
  }

  return 'http://localhost:4001';
}

/**
 * Login CSRF guard.
 *
 * Without this, a cross-site form post can drive /api/auth/login with
 * attacker-controlled credentials and plant a refresh cookie, so the victim
 * silently ends up in the attacker's account. SameSite=Lax does not help: it
 * permits top-level cross-site POSTs from a form submission.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');

  // A same-origin fetch always sends Origin. A missing one means the request did
  // not come from our page.
  if (!origin) return false;

  const allowed = new Set<string>();
  const host = request.headers.get('host');
  if (host) {
    allowed.add(`https://${host}`);
    if (process.env.NODE_ENV !== 'production') allowed.add(`http://${host}`);
  }
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) allowed.add(configured.replace(/\/$/, ''));

  return allowed.has(origin.replace(/\/$/, ''));
}
