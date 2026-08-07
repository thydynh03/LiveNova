'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Icon, type IconName } from '../../components/ui/Icon';
import { LoadingState } from '../../components/common/States';

/**
 * Administration shell.
 *
 * The check here is a courtesy, not a control. Every `/admin/*` endpoint is
 * guarded server-side by `RolesGuard`, which reads the role from the database
 * on each request. Hiding the UI from a non-admin only saves them a confusing
 * screen full of failed requests — it is not what keeps them out.
 */

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: '/admin/users', label: 'Người dùng', icon: 'user' },
  { href: '/admin/templates', label: 'Mẫu', icon: 'spark' },
  { href: '/admin/audit', label: 'Nhật ký', icon: 'queue' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  if (status === 'loading') {
    return <LoadingState />;
  }

  if (user && user.role !== 'ADMIN') {
    return (
      <main style={{ padding: '3rem 1.5rem', maxWidth: '520px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Khu vực quản trị
        </h1>
        <p style={{ color: 'hsl(var(--muted-foreground))' }}>
          Tài khoản của bạn không có quyền vào đây.
        </p>
        <Link href="/dashboard" className="btn btn-secondary" style={{ marginTop: '1.25rem' }}>
          <Icon name="back" size={16} />
          Về trang chính
        </Link>
      </main>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          paddingBottom: '1rem',
          marginBottom: '1.5rem',
          borderBottom: '1px solid hsl(var(--border))',
        }}
      >
        <strong style={{ fontSize: '1.1rem' }}>Quản trị LiveNova</strong>

        <nav style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname?.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  minHeight: '40px',
                  padding: '0.4rem 0.8rem',
                  borderRadius: 'var(--radius)',
                  fontWeight: active ? 700 : 500,
                  background: active ? 'hsl(var(--secondary))' : 'transparent',
                }}
              >
                <Icon name={link.icon} size={16} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <Link href="/dashboard" className="btn btn-secondary" style={{ marginLeft: 'auto' }}>
          Thoát quản trị
        </Link>
      </header>

      {children}
    </div>
  );
}
