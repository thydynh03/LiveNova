'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';
import { AvatarDropdown } from './AvatarDropdown';
import { getNavItems } from '../../config/nav';
import { useAuth } from '../../context/AuthContext';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { status } = useAuth();

  // Links come from the registry — adding a feature never edits this file.
  const items = getNavItems();

  return (
    <nav
      className="glass"
      style={{
        position: 'sticky',
        top: 0,
        // Matches --z-sticky in globals.css; inline styles cannot read the var
        // here because React types zIndex as a number.
        zIndex: 100,
        borderBottom: '1px solid var(--glass-border)',
        padding: '1rem 2rem',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link href="/" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
          <span className="accent">Live</span>Nova
        </Link>

        <div
          style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}
          className="desktop-nav"
        >
          {items.map((item) => {
            const active =
              pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  fontWeight: active ? 700 : 500,
                  opacity: active ? 1 : 0.85,
                }}
              >
                {item.label}
              </Link>
            );
          })}

          <ThemeToggle />

          <div suppressHydrationWarning style={{ display: 'flex', alignItems: 'center' }}>
            {status === 'authenticated' && <AvatarDropdown />}
          </div>
        </div>

        <button
          type="button"
          aria-label="Menu điều hướng"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="mobile-nav-toggle"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.5rem',
          }}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>
    </nav>
  );
}
