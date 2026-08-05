import { NextRequest, NextResponse } from 'next/server';
import { REFRESH_COOKIE, refreshCookieOptions, apiBaseUrl } from '../../../../lib/auth-cookie';

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

/**
 * POST /api/auth/login
 *
 * Proxies to the NestJS API, then splits the response: the refresh token goes
 * into an httpOnly cookie the browser cannot read, and only the short-lived
 * access token reaches client JavaScript.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
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
    message?: string;
  };

  if (!upstream.ok) {
    // Pass the upstream status through, but never the upstream body verbatim —
    // it may carry internal detail the browser has no business seeing.
    return NextResponse.json(
      { message: data.message ?? 'Đăng nhập thất bại' },
      { status: upstream.status },
    );
  }

  if (!data.accessToken || !data.refreshToken) {
    return NextResponse.json({ message: 'Phản hồi không hợp lệ' }, { status: 502 });
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
