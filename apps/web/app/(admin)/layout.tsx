'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/ui/Icon';
import { LoadingState } from '../../components/common/States';
import { ADMIN_NAV_CATEGORIES, ADMIN_NAV_ITEMS } from '../../config/nav/admin.nav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === 'anonymous') router.replace('/login?next=/admin');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'hsl(var(--background))' }}>
        <LoadingState label="Đang xác thực quyền Quản trị viên…" />
      </div>
    );
  }

  // A session with no profile means the `/users/me` call failed. The role is
  // unknown, so the safe reading is "not an administrator" — the previous
  // condition required `user` to be truthy and fell through to rendering the
  // full admin console when it was null.
  if (!user || user.role !== 'ADMIN') {
    return (
      <main style={{ padding: '4rem 1.5rem', maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'hsl(var(--destructive) / 0.1)',
            color: 'hsl(var(--destructive))',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 1.5rem',
            fontSize: '1.75rem',
          }}
        >
          <Icon name="lock" size={28} />
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem', color: 'hsl(var(--foreground))' }}>
          Khu Vực Quản Trị Hệ Thống
        </h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.6, marginBottom: '2rem' }}>
          {user ? (
            <>
              Tài khoản <strong>{user.email}</strong> không thuộc nhóm Quản trị viên (Role: ADMIN). Bạn chỉ có quyền truy cập vào bảng điều khiển Streamer thông thường.
            </>
          ) : (
            <>Không đọc được hồ sơ tài khoản nên chưa xác minh được quyền Quản trị viên. Thử tải lại trang.</>
          )}
        </p>
        <Link href="/dashboard" className="btn btn-primary" style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
          <Icon name="back" size={18} />
          <span>Về Dashboard Streamer</span>
        </Link>
      </main>
    );
  }

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin' || pathname === '/admin/dashboard';
    }
    return pathname === href || Boolean(pathname?.startsWith(`${href}/`));
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        background: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
      }}
    >
      {/* ── LEFT ADMIN SIDEBAR PANEL ────────────────────────────────────────── */}
      <aside
        style={{
          width: '260px',
          flex: 'none',
          borderRight: '1px solid hsl(var(--border))',
          background: 'hsl(var(--card))',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem 0.85rem',
          gap: '1.25rem',
        }}
      >
        {/* Logo & Brand Identity */}
        <Link
          href="/admin"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.5rem 0.6rem',
            borderRadius: 'var(--radius)',
            background: 'hsl(var(--secondary) / 0.5)',
            border: '1px solid hsl(var(--border))',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '1.1rem',
              boxShadow: '0 0 16px rgba(236, 72, 153, 0.4)',
            }}
          >
            <Icon name="spark" size={20} weight="fill" />
          </div>
          <div style={{ display: 'grid', lineHeight: 1.2 }}>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.02em' }}>LiveNova Admin</span>
            <span style={{ fontSize: '0.7rem', color: 'hsl(var(--primary))', fontWeight: 600 }}>
              Trung tâm Điều Hành SaaS
            </span>
          </div>
        </Link>

        {/* Navigation Categories & Links */}
        <nav aria-label="Menu Quản trị" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {ADMIN_NAV_CATEGORIES.map((cat) => {
            const items = ADMIN_NAV_ITEMS.filter((item) => item.category === cat.id);
            if (items.length === 0) return null;

            return (
              <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: 'hsl(var(--muted-foreground))',
                    padding: '0 0.6rem',
                    textTransform: 'uppercase',
                  }}
                >
                  {cat.label}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  {items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.6rem 0.75rem',
                          minHeight: '40px',
                          borderRadius: 'var(--radius)',
                          background: active ? 'hsl(var(--primary) / 0.12)' : 'transparent',
                          color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                          fontWeight: active ? 700 : 500,
                          fontSize: '0.875rem',
                          transition: 'all 0.15s ease',
                          border: active ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid transparent',
                        }}
                      >
                        <Icon name={item.icon} size={18} weight={active ? 'fill' : 'regular'} />
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {item.badge && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              padding: '0.15rem 0.4rem',
                              borderRadius: '999px',
                              background: 'hsl(var(--primary))',
                              color: 'hsl(var(--primary-foreground))',
                            }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer info & Exit to Streamer view */}
        <div
          style={{
            borderTop: '1px solid hsl(var(--border))',
            paddingTop: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.4rem 0.5rem',
              borderRadius: 'var(--radius-sm)',
              background: 'hsl(var(--secondary) / 0.4)',
              fontSize: '0.75rem',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px #10b981',
              }}
            />
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>Hệ thống:</span>
            <span style={{ fontWeight: 700, color: '#10b981' }}>100% Sẵn sàng</span>
          </div>

          <Link
            href="/dashboard"
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              width: '100%',
              fontSize: '0.825rem',
            }}
          >
            <Icon name="device" size={16} />
            <span>Về App Streamer</span>
          </Link>
        </div>
      </aside>

      {/* ── MAIN ADMIN VIEW CONTAINER ────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <header
          style={{
            height: '60px',
            borderBottom: '1px solid hsl(var(--border))',
            background: 'hsl(var(--card))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 2rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>Quản trị</span>
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>/</span>
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              {pathname === '/admin' || pathname === '/admin/dashboard'
                ? 'Dashboard Tổng Quan & Báo Cáo Kinh Doanh'
                : pathname?.includes('/users')
                ? 'Quản Lý Streamers & Tài Khoản'
                : pathname?.includes('/templates')
                ? 'Kho Mẫu & Widgets Tương Tác'
                : pathname?.includes('/audit')
                ? 'Nhật Ký Quản Trị Hệ Thống'
                : 'Bảng Điều Khiển'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link
              href="/battle/simulator"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                padding: '0.4rem 0.8rem',
                borderRadius: 'var(--radius)',
                background: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(139,92,246,0.15))',
                border: '1px solid rgba(236,72,153,0.3)',
                color: 'hsl(var(--primary))',
              }}
            >
              <Icon name="versus" size={16} />
              <span>Sân Đấu 4 Vương Quốc</span>
            </Link>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '999px',
                background: 'hsl(var(--secondary))',
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              <Icon name="user" size={16} />
              <span>{user?.email}</span>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main
          style={{
            flex: 1,
            padding: '2rem',
            overflowY: 'auto',
            background: 'hsl(var(--background))',
          }}
        >
          <div style={{ maxWidth: '1440px', margin: '0 auto' }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
