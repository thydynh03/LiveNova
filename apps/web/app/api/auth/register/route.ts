import { NextRequest, NextResponse } from 'next/server';
import {
  REFRESH_COOKIE,
  refreshCookieOptions,
  maxAgeFromExpiry,
  apiBaseUrl,
  isSameOrigin,
} from '../../../../lib/auth-cookie';

interface AuthPayload {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  user?: any;
  message?: string;
}

async function readJson(res: Response): Promise<AuthPayload> {
  const parsed = (await res.json().catch(() => null)) as AuthPayload | null;
  return parsed ?? {};
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: 'Yêu cầu không hợp lệ' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/auth/register`, {
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

  const data = await readJson(upstream);

  if (!upstream.ok) {
    return NextResponse.json(
      { message: data.message ?? 'Đăng ký thất bại' },
      { status: upstream.status },
    );
  }

  if (!data.accessToken || !data.refreshToken) {
    return NextResponse.json({ message: 'Phản hồi không hợp lệ' }, { status: 502 });
  }

  const response = NextResponse.json({
    accessToken: data.accessToken,
    expiresAt: data.expiresAt,
    user: data.user,
  });

  response.cookies.set(
    REFRESH_COOKIE,
    data.refreshToken,
    refreshCookieOptions(maxAgeFromExpiry(data.expiresAt)),
  );

  return response;
}
