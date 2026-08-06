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

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    const rawError = data as any;
    const msg =
      (typeof rawError?.message === 'string' ? rawError.message : null) ??
      (Array.isArray(rawError?.message) ? rawError.message.join(', ') : null) ??
      (typeof rawError?.error === 'string' ? rawError.error : null) ??
      (typeof rawError?.error?.message === 'string' ? rawError.error.message : null) ??
      (Array.isArray(rawError?.error?.message) ? rawError.error.message.join(', ') : null) ??
      'Đăng ký thất bại';

    return NextResponse.json({ message: msg }, { status: upstream.status });
  }

  return NextResponse.json(data);
}
