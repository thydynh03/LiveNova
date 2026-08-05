'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '../../components/common/Navbar';
import { usePathname } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/rules', label: 'Rules' },
    { href: '/tts-config', label: 'TTS Config' },
    { href: '/overlays-config', label: 'Overlays' },
    { href: '/billing', label: 'Billing' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ display: 'flex', flex: 1 }}>
        <aside style={{
          width: '250px',
          borderRight: '1px solid hsl(var(--border))',
          padding: '2rem 1rem',
          background: 'hsl(var(--card))'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {links.map((l) => (
              <Link key={l.href} href={l.href} style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius)',
                background: pathname === l.href ? 'hsl(var(--primary) / 0.1)' : 'transparent',
                color: pathname === l.href ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                fontWeight: pathname === l.href ? 600 : 400,
                transition: 'background 0.2s',
              }}>
                {l.label}
              </Link>
            ))}
          </div>
        </aside>
        <main style={{ flex: 1, padding: '2rem', background: 'hsl(var(--background))' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
