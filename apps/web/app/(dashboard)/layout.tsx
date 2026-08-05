'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Navbar } from '../../components/common/Navbar';
import { LoadingState } from '../../components/common/States';
import { getNavItems } from '../../config/nav';
import { useAuth } from '../../context/AuthContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === 'anonymous') {
      const next = encodeURIComponent(pathname ?? '/dashboard');
      router.replace(`/login?next=${next}`);
    }
  }, [status, pathname, router]);

  if (status !== 'authenticated') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <LoadingState
          label={status === 'loading' ? 'Đang kiểm tra phiên…' : 'Chuyển tới đăng nhập…'}
        />
      </div>
    );
  }

  // Sidebar reads the same registry as the navbar. It used to hard-code
  // /tts-config and /overlays-config, neither of which exists — two guaranteed
  // 404s sitting in the main navigation.
  const links = getNavItems();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ display: 'flex', flex: 1 }}>
        <aside
          style={{
            width: '250px',
            borderRight: '1px solid hsl(var(--border))',
            padding: '2rem 1rem',
            background: 'hsl(var(--card))',
          }}
        >
          <nav aria-label="Điều hướng chính">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {links.map((l) => {
                const active = pathname === l.href || pathname?.startsWith(`${l.href}/`);
                return (
                  <Link
                    key={l.id}
                    href={l.href}
                    aria-current={active ? 'page' : undefined}
                    style={{
                      padding: '0.75rem 1rem',
                      minHeight: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 'var(--radius)',
                      background: active ? 'hsl(var(--primary) / 0.1)' : 'transparent',
                      color: active ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                      fontWeight: active ? 600 : 400,
                      transition: 'background 0.2s',
                    }}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </aside>
        <main style={{ flex: 1, padding: '2rem', background: 'hsl(var(--background))' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
