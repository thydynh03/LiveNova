'use client';

import React, { useState } from 'react';
import { useApi } from '../../lib/use-api';
import { api } from '../../lib/api-client';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/States';

interface Overlay {
  id: string;
  type: string;
  publicToken: string;
  enabled: boolean;
}

/** Maps an overlay type to the page that renders it. */
const RENDER_PATH: Record<string, string> = {
  MEDIA: '/overlays/media',
  CHAT: '/overlays/chat',
  GOAL: '/overlays/goal',
  PK_BAR: '/overlays/pk',
};

export default function OverlaysPage() {
  const { data, loading, error, reload } = useApi<Overlay[]>('/overlays');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function overlayUrl(overlay: Overlay): string {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const path = RENDER_PATH[overlay.type] ?? '/overlays/media';
    return `${origin}${path}?token=${overlay.publicToken}`;
  }

  async function copy(overlay: Overlay) {
    try {
      await navigator.clipboard.writeText(overlayUrl(overlay));
      setCopiedId(overlay.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setActionError('Trình duyệt chặn truy cập clipboard — hãy sao chép thủ công.');
    }
  }

  async function rotate(overlay: Overlay) {
    setActionError(null);
    setRotatingId(overlay.id);
    try {
      await api.post(`/overlays/${overlay.id}/rotate-token`);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Xoay token thất bại');
    } finally {
      setRotatingId(null);
    }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
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

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState
          title="Chưa có overlay nào"
          description="Overlay là trang mà OBS mở để hiển thị hiệu ứng quà tặng, chatbox hoặc thanh mục tiêu."
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {data?.map((overlay) => (
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
                  <span
                    style={{
                      marginLeft: '0.5rem',
                      fontSize: '0.75rem',
                      color: 'hsl(var(--muted-foreground))',
                    }}
                  >
                    (đang tắt)
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => copy(overlay)} style={buttonStyle}>
                  {copiedId === overlay.id ? 'Đã sao chép ✓' : 'Sao chép URL'}
                </button>
                <button
                  onClick={() => rotate(overlay)}
                  disabled={rotatingId === overlay.id}
                  style={buttonStyle}
                >
                  {rotatingId === overlay.id ? 'Đang xoay…' : 'Xoay token'}
                </button>
              </div>
            </div>

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
              {overlayUrl(overlay)}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  minHeight: '44px',
  borderRadius: 'var(--radius)',
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  color: 'hsl(var(--foreground))',
  cursor: 'pointer',
  fontSize: '0.9rem',
};
