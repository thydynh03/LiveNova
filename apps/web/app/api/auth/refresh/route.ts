import { NextRequest, NextResponse } from 'next/server';
import {
  REFRESH_COOKIE,
  refreshCookieOptions,
  maxAgeFromExpiry,
  apiBaseUrl,
} from '../../../../lib/auth-cookie';

interface AuthPayload {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
}

async function readJson(res: Response): Promise<AuthPayload> {
  const parsed = (await res.json().catch(() => null)) as AuthPayload | null;
  return parsed ?? {};
}

/**
 * POST /api/auth/refresh
 *
 * Reads the httpOnly cookie, exchanges it upstream, and stores the *new*
 * refresh token — the API rotates on every use and revokes the whole family if
 * a consumed token is replayed, so failing to persist the successor would log
 * the user out on their next refresh.
 *
 * KNOWN LIMITATION: two browser tabs can refresh concurrently with the same
 * cookie, and the API will read the second one as a replay and revoke the
 * family. The client-side single-flight guard is per-tab and cannot see across
 * tabs. Fixing this properly needs a short idempotency window on the API side
 * (Dev A owns modules/auth) — tracked rather than papered over here.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  // No cookie is "never signed in", not a failure. Answering 401 made every
  // anonymous visitor's first paint log a console error (Lighthouse best
  // practices flags it); 204 says the same thing without the red text.
  if (!refreshToken) {
    return new NextResponse(null, { status: 204 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
  } catch {
    // A network blip is not a dead session. Keep the cookie so the next attempt
    // can succeed; clearing it here would log the user out over a hiccup.
    return NextResponse.json(
      { message: 'Không kết nối được máy chủ' },
      { status: 503 },
    );
  }

  const data = await readJson(upstream);

  if (upstream.ok && data.accessToken && data.refreshToken) {
    const response = NextResponse.json({
      accessToken: data.accessToken,
      expiresAt: data.expiresAt,
    });
    response.cookies.set(
      REFRESH_COOKIE,
      data.refreshToken,
      refreshCookieOptions(maxAgeFromExpiry(data.expiresAt)),
    );
    return response;
  }

  // Only a definitive rejection means the credential is gone. A 5xx is the API
  // having a bad day, and discarding a still-valid refresh token over it would
  // turn a brief outage into a forced logout for every signed-in user.
  const tokenRejected = upstream.status === 401 || upstream.status === 403;

  const failed = NextResponse.json(
    {
      message: tokenRejected
        ? 'Phiên đăng nhập đã hết hạn'
        : 'Máy chủ tạm thời không phản hồi',
    },
    { status: tokenRejected ? 401 : 503 },
  );

  if (tokenRejected) {
    failed.cookies.set(REFRESH_COOKIE, '', refreshCookieOptions(0));
  }

  return failed;
}
