'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/ui/Icon';
import { TurnstileWidget, type TurnstileHandle } from '../../components/auth/TurnstileWidget';

const ALLOWED_REDIRECTS = new Set([
  '/dashboard',
  '/rules',
  '/tts',
  '/billing',
  '/overlays',
  '/battle/simulator',
  '/settings/profile',
  '/admin',
  '/admin/users',
  '/admin/templates',
  '/admin/audit',
]);

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: 'var(--radius)',
  border: '1px solid hsl(var(--input))',
  background: 'hsl(var(--background))',
  color: 'inherit',
  fontSize: '0.95rem',
  outline: 'none',
};

function LoginForm() {
  const { status, user, signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Held in state, not read from the DOM at submit time: the widget hands the
  // token to its callback and there is no input element to scrape.
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle | null>(null);

  const requested = searchParams.get('next');
  const defaultTarget = user?.role === 'ADMIN' ? '/admin' : '/dashboard';
  const destination = requested && ALLOWED_REDIRECTS.has(requested) ? requested : defaultTarget;

  useEffect(() => {
    // Safe to read `user` here: AuthContext only reports 'authenticated' once
    // the profile fetch has settled, so the role is known by this point.
    if (status === 'authenticated') {
      const target = user?.role === 'ADMIN' && (!requested || !requested.startsWith('/admin')) ? '/admin' : destination;
      router.replace(target);
    }
  }, [status, user, destination, requested, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password, rememberMe, turnstileToken ?? undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
      // The token was redeemed by the attempt that just failed. Without a fresh
      // challenge the next try is rejected as a duplicate, which reads as the
      // form refusing to let the user correct their password.
      turnstileRef.current?.reset();
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
        className="card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '2.5rem',
          borderRadius: 'var(--radius)',
          border: '1px solid hsl(var(--border))',
          boxShadow: 'var(--shadow-lg)',
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
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'hsl(var(--muted-foreground))',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={showPassword ? 'eyeSlash' : 'eye'} size={18} />
              </button>
            </div>
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

          <div style={{ marginBottom: '1rem' }}>
            <TurnstileWidget onToken={setTurnstileToken} handleRef={turnstileRef} />
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
