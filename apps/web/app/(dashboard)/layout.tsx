'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '../../components/common/Sidebar';
import { TopBar } from '../../components/common/TopBar';
import { LoadingState } from '../../components/common/States';
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

  // Navigation moved out of the header and into the sidebar. It used to appear
  // in both, which meant every destination was on screen twice with different
  // styling — and the header copy was the one that scrolled away.
  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar />
        {/* Target of the skip link in the root layout. tabIndex={-1} lets
            focus actually land here instead of staying in the sidebar. */}
        <main
          id="main-content"
          tabIndex={-1}
          style={{
            flex: 1,
            padding: '1.75rem 2rem 3rem',
            background: 'hsl(var(--background))',
          }}
        >
          <div style={{ maxWidth: '1180px', margin: '0 auto' }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
