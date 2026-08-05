import { NextRequest, NextResponse } from 'next/server';
import { REFRESH_COOKIE, refreshCookieOptions, apiBaseUrl } from '../../../../lib/auth-cookie';

/**
 * POST /api/auth/logout
 *
 * Revokes the session upstream, then clears the cookie.
 *
 * The cookie is cleared unconditionally — leaving a credential in the browser
 * after the user asked to leave is the worse failure. But `revoked` reports
 * honestly whether the server-side session actually died, because returning
 * `{ success: true }` when the token is still live upstream tells the caller a
 * comforting lie: the refresh token remains usable by anyone who captured it.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  let revoked = true;

  if (refreshToken) {
    try {
      const upstream = await fetch(`${apiBaseUrl()}/auth/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
      revoked = upstream.ok;
    } catch {
      revoked = false;
    }
  }

  const response = NextResponse.json(
    {
      success: true,
      revoked,
      ...(revoked
        ? {}
        : {
            message:
              'Đã đăng xuất trên trình duyệt, nhưng máy chủ chưa xác nhận thu hồi phiên.',
          }),
    },
    // 202 signals "accepted locally, upstream unconfirmed" so a caller that
    // cares can retry or warn.
    { status: revoked ? 200 : 202 },
  );

  response.cookies.set(REFRESH_COOKIE, '', refreshCookieOptions(0));
  return response;
}
