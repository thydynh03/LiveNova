import { NextRequest, NextResponse } from 'next/server';
import {
  REFRESH_COOKIE,
  refreshCookieOptions,
  maxAgeFromExpiry,
  apiBaseUrl,
  isSameOrigin,
} from '../../../../lib/auth-cookie';

interface VerifyOtpPayload {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  user?: any;
  message?: string;
}

async function readJson(res: Response): Promise<VerifyOtpPayload> {
  const parsed = (await res.json().catch(() => null)) as VerifyOtpPayload | null;
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
    upstream = await fetch(`${apiBaseUrl()}/auth/verify-otp`, {
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
    const rawError = data as any;
    const msg =
      (typeof rawError?.message === 'string' ? rawError.message : null) ??
      (Array.isArray(rawError?.message) ? rawError.message.join(', ') : null) ??
      (typeof rawError?.error === 'string' ? rawError.error : null) ??
      (typeof rawError?.error?.message === 'string' ? rawError.error.message : null) ??
      'Mã OTP không hợp lệ hoặc đã hết hạn';

    return NextResponse.json({ message: msg }, { status: upstream.status });
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
