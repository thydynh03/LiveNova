'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../ui/Icon';
import { ThemeToggle } from './ThemeToggle';
import { AvatarDropdown } from './AvatarDropdown';
import { getNavItems } from '../../config/nav';
import { useApi } from '../../lib/use-api';
import { api } from '../../lib/api-client';

interface CreditBalance {
  balance: number;
  dailyFreeUsed: number;
  resetsAt: string | null;
}

interface SessionState {
  activeSessions: string[];
  count: number;
}

const formatCount = (n: number) => new Intl.NumberFormat('vi-VN').format(n);

/**
 * Destination search.
 *
 * The design put a search field in the header. Rather than leave it inert, it
 * jumps between screens — which is the only thing there is to search globally
 * today, since gifts and comments are per-session and not indexed anywhere.
 * Matching is diacritic-insensitive because nobody types "kịch bản" with tones
 * when they are in a hurry.
 */
const fold = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function DestinationSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => getNavItems(), []);
  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return [];
    return items.filter((i) => fold(i.label).includes(q)).slice(0, 6);
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const go = useCallback(
    (href: string) => {
      setQuery('');
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  return (
    <div ref={boxRef} style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
      <label className="sr-only" htmlFor="topbar-search">
        Tìm màn hình
      </label>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '0.75rem',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'hsl(var(--muted-foreground))',
          display: 'flex',
        }}
      >
        <Icon name="search" size={18} />
      </span>
      <input
        id="topbar-search"
        value={query}
        placeholder="Tìm nhanh…"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches[0]) go(matches[0].href);
          if (e.key === 'Escape') setOpen(false);
        }}
        style={{
          width: '100%',
          minHeight: '40px',
          padding: '0.5rem 0.75rem 0.5rem 2.25rem',
          borderRadius: 'var(--radius)',
          border: '1px solid hsl(var(--input))',
          background: 'hsl(var(--background))',
          color: 'inherit',
          font: 'inherit',
          fontSize: '0.9rem',
        }}
      />
      {open && matches.length > 0 && (
        <ul
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 200,
            listStyle: 'none',
            background: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
          }}
        >
          {matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => go(m.href)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'inherit',
                  textAlign: 'left',
                }}
              >
                {m.icon ? <Icon name={m.icon} size={18} /> : null}
                {m.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The emergency stop.
 *
 * It lives here, once, and nowhere else. The v2 comps drew it twice — in the
 * header and again in the dashboard hero — which is a safety problem, not a
 * layout one: two identically-red controls with different scopes means the one
 * you hit under pressure is a coin flip. Header wins because it has to be
 * reachable from every screen, not only from the dashboard.
 *
 * It is only rendered while something is actually live, so it is never a
 * decorative red rectangle sitting in the chrome.
 */
function EmergencyStop({
  sessions,
  onStopped,
}: {
  sessions: string[];
  onStopped: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sessions.length === 0) return null;

  const stop = async () => {
    setBusy(true);
    setError(null);
    try {
      await Promise.all(
        sessions.map((id) => api.delete(`/tiktok/channels/${id}/connect`)),
      );
      setConfirming(false);
      onStopped();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không dừng được, thử lại nhé');
    } finally {
      setBusy(false);
    }
  };

  if (!confirming) {
    return (
      <button
        type="button"
        className="btn btn-danger"
        style={{ minHeight: '40px', padding: '0.5rem 1rem' }}
        onClick={() => setConfirming(true)}
      >
        <Icon name="stop" size={18} weight="fill" />
        Dừng tất cả
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
        {error ?? 'Dừng toàn bộ tự động hoá?'}
      </span>
      <button
        type="button"
        className="btn btn-danger"
        style={{ minHeight: '40px', padding: '0.5rem 1rem' }}
        onClick={stop}
        disabled={busy}
      >
        {busy ? 'Đang dừng…' : 'Dừng'}
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ minHeight: '40px', padding: '0.5rem 0.875rem' }}
        onClick={() => setConfirming(false)}
        disabled={busy}
      >
        Huỷ
      </button>
    </div>
  );
}

export function TopBar() {
  const { data: credit } = useApi<CreditBalance>('/credits/balance');
  const { data: sessions, reload: reloadSessions } = useApi<SessionState>('/tiktok/sessions');

  const live = (sessions?.count ?? 0) > 0;

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid hsl(var(--border))',
        background: 'hsl(var(--card))',
      }}
    >
      <DestinationSearch />

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Credit is stated in the unit people actually think in — readings —
            not in an abstract token count. */}
        {credit ? (
          <span className="pill" title="Số lượt đọc còn lại trong tài khoản">
            <span className="mono">{formatCount(credit.balance)}</span> lượt đọc còn lại
          </span>
        ) : null}

        {live ? (
          <span className="pill pill-warn" style={{ color: 'hsl(var(--primary))' }}>
            <span className="live-dot" aria-hidden="true" />
            Đang live
          </span>
        ) : null}

        <EmergencyStop sessions={sessions?.activeSessions ?? []} onStopped={reloadSessions} />

        <ThemeToggle />

        <div suppressHydrationWarning style={{ display: 'flex', alignItems: 'center' }}>
          <AvatarDropdown />
        </div>
      </div>
    </header>
  );
}
