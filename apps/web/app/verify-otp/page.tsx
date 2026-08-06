'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { resendOtp } from '../../lib/api-client';
import { Icon } from '../../components/ui/Icon';

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const type = (searchParams.get('type') || 'REGISTER') as 'REGISTER' | 'FORGOT_PASSWORD';

  const { confirmOtp } = useAuth();
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  function handleChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    const fullCode = newOtp.join('');
    if (fullCode.length === 6 && !newOtp.includes('')) {
      handleVerify(fullCode);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setOtp(digits);
      digits.forEach((digit, i) => {
        if (inputRefs.current[i]) {
          inputRefs.current[i]!.value = digit;
        }
      });
      handleVerify(pastedData);
    }
  }

  async function handleVerify(codeToVerify?: string) {
    const code = codeToVerify || otp.join('');
    if (code.length < 6) {
      setError('Vui lòng nhập đủ 6 chữ số OTP');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      if (type === 'FORGOT_PASSWORD') {
        router.push(`/reset-password?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`);
      } else {
        await confirmOtp(email, code, 'REGISTER');
        router.replace('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xác thực OTP thất bại');
      setOtp(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!canResend) return;

    setError(null);
    setInfo(null);
    setCanResend(false);
    setResendTimer(60);

    try {
      await resendOtp(email, type);
      setInfo('Mã OTP mới đã được gửi thành công!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi lại OTP thất bại');
      setCanResend(true);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '2.5rem',
          borderRadius: 'var(--radius)',
          border: '1px solid hsl(var(--border))',
          boxShadow: 'var(--shadow-lg)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'hsl(var(--primary) / 0.15)',
            color: 'hsl(var(--primary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
          }}
        >
          <Icon name="check" size={28} />
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Xác thực mã <span className="accent">OTP</span>
        </h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '1.75rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Vui lòng nhập mã OTP 6 chữ số đã được gửi tới email <br />
          <strong style={{ color: 'hsl(var(--foreground))' }}>{email || 'của bạn'}</strong>
        </p>

        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius)',
              background: 'hsl(var(--destructive) / 0.08)',
              border: '1px solid hsl(var(--destructive) / 0.3)',
              color: 'hsl(var(--destructive))',
              fontSize: '0.875rem',
              marginBottom: '1.25rem',
            }}
          >
            {error}
          </div>
        )}

        {info && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius)',
              background: 'hsl(var(--success) / 0.15)',
              border: '1px solid hsl(var(--success) / 0.3)',
              color: 'hsl(var(--success))',
              fontSize: '0.875rem',
              marginBottom: '1.25rem',
            }}
          >
            {info}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleVerify(); }}>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1.75rem' }}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                style={{
                  width: '48px',
                  height: '56px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--background))',
                  color: 'inherit',
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                }}
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '0.85rem',
              borderRadius: 'var(--radius)',
              background: 'hsl(var(--primary))',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              marginBottom: '1.25rem',
            }}
          >
            {submitting ? 'Đang xác thực...' : 'Xác thực OTP'}
          </button>
        </form>

        <div style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
          Chưa nhận được mã?{' '}
          {canResend ? (
            <button
              type="button"
              onClick={handleResend}
              style={{
                background: 'none',
                border: 'none',
                color: 'hsl(var(--primary))',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              Gửi lại ngay
            </button>
          ) : (
            <span>
              Gửi lại sau <strong>{resendTimer}s</strong>
            </span>
          )}
        </div>

        <div style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}>
          <Link href="/login" style={{ color: 'hsl(var(--muted-foreground))', textDecoration: 'none' }}>
            ← Quay lại đăng nhập
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function VerifyOtpPage() {
  return (
    <React.Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Đang tải...</div>}>
      <VerifyOtpForm />
    </React.Suspense>
  );
}
