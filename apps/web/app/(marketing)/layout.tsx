import React from 'react';
import { Navbar } from '../../components/common/Navbar';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main style={{ flex: 1 }}>{children}</main>
      <footer style={{
        padding: '2rem',
        textAlign: 'center',
        borderTop: '1px solid hsl(var(--border))',
        background: 'hsl(var(--card))'
      }}>
        <p>&copy; {new Date().getFullYear()} TikTok LIVE Auto. All rights reserved.</p>
      </footer>
    </div>
  );
}
