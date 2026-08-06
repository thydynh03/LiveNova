'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';

const ALLOWED_REDIRECTS = new Set([
  '/dashboard',
  '/rules',
  '/tts',
  '/billing',
  '/overlays',
  '/settings/profile',
]);

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

function LoginForm() {
  const { status, signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requested = searchParams.get('next');
  const destination = requested && ALLOWED_REDIRECTS.has(requested) ? requested : '/dashboard';

  useEffect(() => {
    if (status === 'authenticated') router.replace(destination);
  }, [status, destination, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password, rememberMe);
      router.replace(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
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
          maxWidth: '420px',
          padding: '2.5rem',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        }}
      >
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Đăng nhập <span className="accent">LiveNova</span>
        </h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Quản lý kịch bản tự động, overlay và TTS cho livestream của bạn.
        </p>

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

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="email" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500, fontSize: '0.9rem' }}>
              Địa chỉ Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label htmlFor="password" style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                Mật khẩu
              </label>
              <Link
                href="/forgot-password"
                style={{ fontSize: '0.825rem', color: 'hsl(var(--primary))', textDecoration: 'none' }}
              >
                Quên mật khẩu?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ width: '1rem', height: '1rem', accentColor: 'hsl(var(--primary))', cursor: 'pointer' }}
            />
            <label htmlFor="rememberMe" style={{ marginLeft: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
              Ghi nhớ đăng nhập (Duy trì 30 ngày)
            </label>
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
              transition: 'all 0.2s ease',
            }}
          >
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
          Chưa có tài khoản?{' '}
          <Link href="/register" style={{ color: 'hsl(var(--primary))', fontWeight: 600, textDecoration: 'none' }}>
            Đăng ký ngay
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Đang tải...</div>}>
      <LoginForm />
    </React.Suspense>
  );
}
