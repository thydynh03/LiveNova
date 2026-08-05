'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

const ALLOWED_REDIRECTS = new Set([
  '/dashboard',
  '/rules',
  '/tts',
  '/billing',
  '/overlays',
]);

function LoginForm() {
  const { status, signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // FR-005 — the post-login destination comes from an allowlist. Echoing back
  // whatever `?next=` contains is how open redirects get built.
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
      await signIn(email, password);
      router.replace(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setSubmitting(false);
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
          maxWidth: '420px',
          padding: '2rem',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Đăng nhập <span className="text-gradient">LiveNova</span>
        </h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '1.5rem' }}>
          Quản lý luật quà tặng, overlay và giọng đọc cho buổi livestream.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 500 }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          <label
            htmlFor="password"
            style={{ display: 'block', margin: '1rem 0 0.35rem', fontWeight: 500 }}
          >
            Mật khẩu
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          {error && (
            <p role="alert" style={{ color: 'hsl(var(--destructive))', marginTop: '1rem' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              marginTop: '1.5rem',
              padding: '0.75rem',
              minHeight: '44px',
              borderRadius: 'var(--radius)',
              border: 'none',
              background: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>

        <p
          style={{
            marginTop: '1.5rem',
            fontSize: '0.85rem',
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          Đăng nhập bằng Facebook và Google chưa khả dụng — hai nhà cung cấp
          chưa được cấu hình phía máy chủ.
        </p>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.7rem 0.9rem',
  minHeight: '44px',
  borderRadius: 'var(--radius)',
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--background))',
  color: 'hsl(var(--foreground))',
  fontSize: '1rem',
};

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary during static prerender.
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}
