'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { getPrimaryNavItems, getBottomNavItems, type NavItem } from '../../config/nav';

/**
 * Sidebar navigation.
 *
 * Icon *and* label, never icon-only. A collapsed rail saves 180px and costs
 * every non-technical user a guessing game about which glyph is which; the
 * people using this open the app a few times a week, not all day, so they never
 * build that muscle memory.
 *
 * The accent colour appears here on exactly one item — the active one. That is
 * half of its entire licence in the product (the other half is the single
 * primary action per screen).
 */
function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.625rem 0.875rem',
        minHeight: '44px',
        borderRadius: 'var(--radius)',
        background: active ? 'hsl(var(--accent-surface))' : 'transparent',
        color: active ? 'hsl(var(--primary-hover))' : 'hsl(var(--muted-foreground))',
        fontWeight: active ? 600 : 500,
        transition: 'background 0.15s ease, color 0.15s ease',
      }}
    >
      {item.icon ? (
        <Icon name={item.icon} size={20} weight={active ? 'fill' : 'regular'} />
      ) : null}
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || Boolean(pathname?.startsWith(`${href}/`));

  return (
    <aside
      style={{
        width: '236px',
        flex: 'none',
        borderRight: '1px solid hsl(var(--border))',
        background: 'hsl(var(--card))',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.25rem 0.75rem',
        gap: '1.5rem',
      }}
    >
      <Link
        href="/dashboard"
        style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0 0.5rem' }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 'var(--radius-sm)',
            background: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            fontWeight: 800,
          }}
        >
          L
        </span>
        <span style={{ display: 'grid', lineHeight: 1.25 }}>
          <span style={{ fontWeight: 700 }}>LiveNova</span>
          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
            Trợ lý livestream
          </span>
        </span>
      </Link>

      <nav aria-label="Điều hướng chính" style={{ flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {getPrimaryNavItems().map((item) => (
            <NavLink key={item.id} item={item} active={isActive(item.href)} />
          ))}
        </div>
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {getBottomNavItems().map((item) => (
          <NavLink key={item.id} item={item} active={isActive(item.href)} />
        ))}
      </div>
    </aside>
  );
}
