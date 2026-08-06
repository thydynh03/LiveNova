'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useApi } from '../../../lib/use-api';
import { api } from '../../../lib/api-client';
import { LoadingState, ErrorState, EmptyState } from '../../../components/common/States';
import { Icon } from '../../../components/ui/Icon';
import type { Overlay } from '../../../lib/types';

/**
 * Only overlay types whose renderer actually consumes the token and live data.
 *
 * The other pages under /overlays still animate hard-coded demo values and
 * ignore the token entirely. Handing a streamer a URL for one of those would
 * put a fake, randomly-changing widget on their broadcast — worse than telling
 * them it is not ready.
 */
const LIVE_RENDERERS: Record<string, string> = {
  MEDIA: '/overlays/media',
  CHAT: '/overlays/chat',
};

const AWAITING_PRODUCER: Record<string, string> = {
  CHAT: 'Cần luật Chatbox (F04) mới có dữ liệu',
};

/** Types that exist in the API but have no working renderer yet. */
const PENDING_LABEL: Record<string, string> = {
  GOAL: 'Đang phát triển (F06)',
  PK_BAR: 'Đang phát triển (F08)',
  LEADERBOARD: 'Đang phát triển (F10)',
  ROOM_ENTRY: 'Đang phát triển (F18)',
  ALERTS: 'Đang phát triển',
};

export default function OverlaysPage() {
  const { data, loading, error, reload } = useApi<Overlay[]>('/overlays');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  /** Tokens rotated in this session, shown until the refetch catches up. */
  const [localTokens, setLocalTokens] = useState<Record<string, string>>({});
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  // Server data wins once it arrives. Keeping the local override indefinitely
  // meant a token rotated from another tab (or by anyone else) stayed hidden
  // behind a value this tab had cached, so the page would keep handing out a
  // URL the server had already revoked.
  useEffect(() => {
    if (data) setLocalTokens({});
  }, [data]);

  // Clearing the override on refetch is not enough on its own: without a reason
  // to refetch, a token rotated in another tab would stay stale on this screen
  // indefinitely. Revalidate when the tab becomes visible again — the moment a
  // user is most likely to come back and copy a URL.
  //
  // Only `visibilitychange`: returning to a tab fires `focus` as well, and
  // listening to both issued two identical GETs per switch.
  useEffect(() => {
    function revalidate() {
      if (document.visibilityState === 'visible') reload();
    }
    document.addEventListener('visibilitychange', revalidate);
    return () => document.removeEventListener('visibilitychange', revalidate);
  }, [reload]);

  function overlayUrl(overlay: Overlay): string | null {
    const path = LIVE_RENDERERS[overlay.type];
    if (!path) return null;
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const token = localTokens[overlay.id] ?? overlay.publicToken;
    return `${origin}${path}?token=${token}`;
  }

  async function copy(overlay: Overlay) {
    const url = overlayUrl(overlay);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(overlay.id);
      // Cancel the previous timer, or copying a second URL quickly would have
      // the first timeout clear the second one's confirmation.
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setActionError('Trình duyệt chặn truy cập clipboard — hãy sao chép thủ công.');
    }
  }

  async function rotate(overlay: Overlay) {
    setActionError(null);
    setRotatingId(overlay.id);
    try {
      const rotated = await api.post<{ id: string; publicToken: string }>(
        `/overlays/${overlay.id}/rotate-token`,
      );

      // Apply the new token immediately. `reload()` is async, and until it
      // landed the row still displayed — and copied — the token that was just
      // revoked, so pasting it into OBS produced a dead overlay.
      if (rotated?.publicToken) {
        setLocalTokens((prev) => ({ ...prev, [overlay.id]: rotated.publicToken }));
      }
      setCopiedId((current) => (current === overlay.id ? null : current));
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Xoay token thất bại');
    } finally {
      setRotatingId(null);
    }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Overlay</h1>
      <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '2rem' }}>
        Sao chép URL và dán vào <strong>Browser Source</strong> trong OBS. Ai có URL
        là xem được overlay — xoay token nếu bạn lỡ để lộ trên sóng.
      </p>

      {actionError && (
        <p role="alert" style={{ color: 'hsl(var(--destructive))', marginBottom: '1rem' }}>
          {actionError}
        </p>
      )}

      {/*
        The spinner is for the first load only. Showing it on every background
        revalidation replaced the whole list with a spinner each time the user
        switched back to the tab — jarring on a screen meant to stay open beside
        OBS. A revalidation keeps the current list on screen.
      */}
      {loading && !data && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState
          title="Chưa có overlay nào"
          description="Overlay là trang mà OBS mở để hiển thị hiệu ứng quà tặng, chatbox hoặc thanh mục tiêu."
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {data?.map((overlay) => {
          const url = overlayUrl(overlay);
          const pending = PENDING_LABEL[overlay.type] ?? 'Chưa hỗ trợ';

          return (
            <div
              key={overlay.id}
              className="glass"
              style={{
                padding: '1.25rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <strong style={{ fontSize: '1.1rem' }}>{overlay.type}</strong>
                  {!overlay.enabled && (
                    <span style={mutedNote}>(đang tắt)</span>
                  )}
                  {!url && <span style={mutedNote}>{pending}</span>}
                  {url && AWAITING_PRODUCER[overlay.type] && (
                    <span style={mutedNote}>{AWAITING_PRODUCER[overlay.type]}</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {url && (
                    <>
                      <button onClick={() => copy(overlay)} style={buttonStyle}>
                        <Icon name={copiedId === overlay.id ? 'check' : 'copy'} size={16} />
                        {copiedId === overlay.id ? 'Đã sao chép' : 'Sao chép URL'}
                      </button>

                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          ...buttonStyle,
                          textDecoration: 'none',
                          background: 'hsl(var(--primary) / 0.15)',
                          color: 'hsl(var(--primary))',
                          border: '1px solid hsl(var(--primary) / 0.4)',
                          fontWeight: 600,
                        }}
                      >
                        <Icon name="preview" size={16} />
                        Mở xem thử
                      </a>
                    </>
                  )}
                  <button
                    onClick={() => rotate(overlay)}
                    disabled={rotatingId === overlay.id}
                    style={buttonStyle}
                  >
                    <Icon name="rotate" size={16} />
                    {rotatingId === overlay.id ? 'Đang xoay…' : 'Xoay token'}
                  </button>
                </div>
              </div>

              {url ? (
                <code
                  style={{
                    display: 'block',
                    marginTop: '0.75rem',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius)',
                    background: 'hsl(var(--muted) / 0.4)',
                    fontSize: '0.8rem',
                    overflowX: 'auto',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {url}
                </code>
              ) : (
                <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>
                  Chưa có URL vì trang hiển thị của loại này chưa đọc dữ liệu thật.
                  Xoay token vẫn dùng được để thu hồi quyền truy cập.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const mutedNote: React.CSSProperties = {
  marginLeft: '0.5rem',
  fontSize: '0.75rem',
  color: 'hsl(var(--muted-foreground))',
};

const buttonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  minHeight: '44px',
  borderRadius: 'var(--radius)',
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  color: 'hsl(var(--foreground))',
  cursor: 'pointer',
  fontSize: '0.9rem',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.45rem',
};
