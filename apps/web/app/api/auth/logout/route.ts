import { NextRequest, NextResponse } from 'next/server';
import { REFRESH_COOKIE, refreshCookieOptions, apiBaseUrl } from '../../../../lib/auth-cookie';

/**
 * POST /api/auth/logout
 *
 * Revokes the session upstream, then clears the cookie. The cookie is cleared
 * even when the upstream call fails — otherwise a network blip would leave the
 * browser holding a credential it believes is gone.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    try {
      await fetch(`${apiBaseUrl()}/auth/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
    } catch {
      // Ignored on purpose — see the note above.
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(REFRESH_COOKIE, '', refreshCookieOptions(0));
  return response;
}
