'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { resetPassword } from '../../lib/api-client';
import { Icon } from '../../components/ui/Icon';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--glass-border)',
  background: 'rgba(255, 255, 255, 0.05)',
  color: 'inherit',
  fontSize: '0.95rem',
  outline: 'none',
};

const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)/;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const rawToken = searchParams.get('token');
    if (rawToken) {
      setToken(rawToken);
      // Immediately clear the sensitive token from the URL bar to prevent leakage via browser history or Referer headers
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else if (!token) {
      setError('Mã khôi phục mật khẩu không khả dụng hoặc đã hết hạn.');
    }
  }, [searchParams, token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Mã khôi phục mật khẩu không khả dụng.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp');
      return;
    }

    if (newPassword.length < 8) {
      setError('Mật khẩu mới tối thiểu 8 ký tự');
      return;
    }

    if (!PASSWORD_COMPLEXITY_REGEX.test(newPassword)) {
      setError('Mật khẩu mới phải chứa ít nhất 1 chữ cái và 1 chữ số');
      return;
    }

    setLoading(true);

    try {
      await resetPassword(token, newPassword);
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đặt lại mật khẩu thất bại');
    } finally {
      setLoading(false);
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
        className="glass"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '2.5rem',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        }}
      >
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Đặt lại <span className="accent">mật khẩu</span>
        </h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Tạo mật khẩu mới cho tài khoản LiveNova của bạn.
        </p>

        {success ? (
          <div
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius)',
              background: 'hsl(var(--success) / 0.12)',
              border: '1px solid hsl(var(--success) / 0.35)',
              color: 'hsl(var(--success))',
              fontSize: '0.9rem',
              textAlign: 'center',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                justifyContent: 'center',
              }}
            >
              <Icon name="check" size={18} weight="bold" />
              Mật khẩu đã đổi. Đang chuyển tới trang đăng nhập.
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius)',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'hsl(var(--destructive))',
                  fontSize: '0.875rem',
                  marginBottom: '1.25rem',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="newPassword" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500, fontSize: '0.9rem' }}>
                Mật khẩu mới (Tối thiểu 8 ký tự, gồm chữ và số)
              </label>
              <input
                id="newPassword"
                type="password"
                required
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="confirmPassword" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500, fontSize: '0.9rem' }}>
                Nhập lại mật khẩu mới
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              style={{
                width: '100%',
                padding: '0.85rem',
                borderRadius: 'var(--radius)',
                background: 'hsl(var(--primary))',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.875rem' }}>
          <Link
            href="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'hsl(var(--primary))',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            <Icon name="back" size={16} />
            Quay lại đăng nhập
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Đang tải...</div>}>
      <ResetPasswordForm />
    </React.Suspense>
  );
}
