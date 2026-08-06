import React from 'react';
import Link from 'next/link';
import { Navbar } from '../../components/common/Navbar';
import { SITE_NAME } from '../../lib/site';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* id is the target of the skip link in the root layout. tabIndex={-1}
          makes it focusable programmatically so focus actually moves there —
          without it the skip link scrolls but leaves focus behind in the nav. */}
      <main id="main-content" tabIndex={-1} style={{ flex: 1 }}>
        {children}
      </main>

      <footer
        style={{
          padding: '2rem 1.5rem',
          borderTop: '1px solid hsl(var(--border))',
          background: 'hsl(var(--card))',
        }}
      >
        <div
          style={{
            maxWidth: '1000px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            fontSize: '0.9rem',
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          <p style={{ margin: 0 }} suppressHydrationWarning>
            © {new Date().getFullYear()} {SITE_NAME}
          </p>

          <nav aria-label="Liên kết chân trang">
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                gap: '1.25rem',
              }}
            >
              <li>
                <Link href="/login">Đăng nhập</Link>
              </li>
              <li>
                <Link href="/#tinh-nang">Tính năng</Link>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
