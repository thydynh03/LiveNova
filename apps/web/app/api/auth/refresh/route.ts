import { NextRequest, NextResponse } from 'next/server';
import { REFRESH_COOKIE, refreshCookieOptions, apiBaseUrl } from '../../../../lib/auth-cookie';

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

/**
 * POST /api/auth/refresh
 *
 * Reads the httpOnly cookie, exchanges it upstream, and stores the *new*
 * refresh token — the API rotates on every use and revokes the whole family if
 * a consumed token is replayed, so failing to persist the successor would log
 * the user out on their next refresh.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json({ message: 'Chưa đăng nhập' }, { status: 401 });
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
    return NextResponse.json(
      { message: 'Không kết nối được máy chủ' },
      { status: 502 },
    );
  }

  const data = (await upstream.json().catch(() => ({}))) as {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string;
  };

  if (!upstream.ok || !data.accessToken || !data.refreshToken) {
    // Reuse detection upstream revokes every session in the family, so a failed
    // refresh means this browser must start over. Clear the stale cookie.
    const failed = NextResponse.json(
      { message: 'Phiên đăng nhập đã hết hạn' },
      { status: 401 },
    );
    failed.cookies.set(REFRESH_COOKIE, '', refreshCookieOptions(0));
    return failed;
  }

  const response = NextResponse.json({
    accessToken: data.accessToken,
    expiresAt: data.expiresAt,
  });

  response.cookies.set(
    REFRESH_COOKIE,
    data.refreshToken,
    refreshCookieOptions(THIRTY_DAYS_SECONDS),
  );

  return response;
}
