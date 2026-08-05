'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="glass" style={{
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      borderBottom: '1px solid var(--glass-border)',
      padding: '1rem 2rem',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
          <span className="text-gradient">TK LIVE</span> Auto
        </Link>
        
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }} className="desktop-nav">
          <Link href="/dashboard" style={{ fontWeight: 500 }}>Dashboard</Link>
          <Link href="/rules" style={{ fontWeight: 500 }}>Rules</Link>
          <Link href="/tts" style={{ fontWeight: 500 }}>TTS</Link>
          <Link href="/overlays" style={{ fontWeight: 500 }}>Overlays</Link>
          <ThemeToggle />
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}>
            U
          </div>
        </div>
      </div>
    </nav>
  );
}
