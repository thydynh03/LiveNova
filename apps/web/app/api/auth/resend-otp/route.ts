import { NextRequest, NextResponse } from 'next/server';
import { apiBaseUrl, isSameOrigin } from '../../../../lib/auth-cookie';

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
    upstream = await fetch(`${apiBaseUrl()}/auth/resend-otp`, {
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

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    const msg = data?.message ?? data?.error?.message ?? 'Gửi lại mã OTP thất bại';
    return NextResponse.json({ message: msg }, { status: upstream.status });
  }

  return NextResponse.json(data);
}
