'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { forgotPassword } from '../../lib/api-client';
import { Icon } from '../../components/ui/Icon';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: 'var(--radius)',
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--background))',
  color: 'inherit',
  fontSize: '0.95rem',
  outline: 'none',
};

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await forgotPassword(email);
      setSubmitted(true);
      router.push(`/verify-otp?email=${encodeURIComponent(email)}&type=FORGOT_PASSWORD`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yêu cầu thất bại');
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
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '2.5rem',
          borderRadius: 'var(--radius)',
          border: '1px solid hsl(var(--border))',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Quên <span className="accent">mật khẩu</span>
        </h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Nhập email đăng ký của bạn để nhận hướng dẫn khôi phục mật khẩu.
        </p>

        {submitted ? (
          <div
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius)',
              background: 'hsl(var(--success) / 0.12)',
              border: '1px solid hsl(var(--success) / 0.35)',
              color: 'hsl(var(--success))',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              marginBottom: '1.5rem',
            }}
          >
            <p
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontWeight: 600,
                marginBottom: '0.5rem',
              }}
            >
              <Icon name="check" size={18} weight="bold" />
              Yêu cầu đã được tiếp nhận
            </p>
            <p style={{ fontSize: '0.85rem' }}>
              Nếu email <strong>{email}</strong> tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn khôi phục mật khẩu.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
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

            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="email" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500, fontSize: '0.9rem' }}>
                Địa chỉ Email đăng ký
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
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
              {loading ? 'Đang gửi...' : 'Gửi yêu cầu khôi phục'}
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
