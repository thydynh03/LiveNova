'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../ui/Icon';

function isValidAvatarUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/')
  );
}

export function AvatarDropdown() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const displayName = user.displayName || user.email.split('@')[0] || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '9999px',
          outline: 'none',
          transition: 'transform 0.15s ease',
        }}
      >
        {isValidAvatarUrl(user.avatar) ? (
          <img
            src={user.avatar!}
            alt={displayName}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid hsl(var(--primary))',
            }}
          />
        ) : (
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, hsl(var(--primary)), #a855f7)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)',
            }}
          >
            {initial}
          </div>
        )}
      </button>

      {open && (
        <div
          className="glass"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: '240px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
            padding: '0.75rem',
            zIndex: 200,
            backdropFilter: 'blur(16px)',
            background: 'rgba(24, 24, 27, 0.85)',
          }}
        >
          {/* User Info Header */}
          <div
            style={{
              padding: '0.5rem 0.5rem 0.75rem',
              borderBottom: '1px solid var(--glass-border)',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={displayName}
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, hsl(var(--primary)), #a855f7)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {initial}
              </div>
            )}
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'hsl(var(--foreground))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.email}
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <Link
            href="/settings/profile"
            onClick={() => setOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.6rem 0.75rem',
              borderRadius: 'calc(var(--radius) - 2px)',
              fontSize: '0.9rem',
              color: 'hsl(var(--foreground))',
              textDecoration: 'none',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Icon name="user" size={16} />
            <span>Xem hồ sơ</span>
          </Link>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.6rem 0.75rem',
              borderRadius: 'calc(var(--radius) - 2px)',
              fontSize: '0.9rem',
              color: 'hsl(var(--destructive))',
              background: 'none',
              border: 'none',
              cursor: signingOut ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s ease',
              marginTop: '0.25rem',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Icon name="signOut" size={16} />
            <span>{signingOut ? 'Đang thoát...' : 'Đăng xuất'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
