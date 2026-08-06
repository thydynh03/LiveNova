'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { OverlayState, PkState } from '@livenova/shared';
import { useOverlaySocket } from '../../../lib/use-overlay-socket';

/**
 * PK bar, driven by real battle frames.
 *
 * This page used to add `Math.random() * 50` to both scores every two seconds.
 * A PK bar showing invented numbers is worse than no bar at all: viewers decide
 * who to gift based on which side is behind.
 */

/** Literal colours: this composites over arbitrary video. */
const LEFT = '#22d3ee';
const RIGHT = '#f43f5e';

function useCountdown(endsAtMs: number | undefined, active: boolean) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!endsAtMs || !active) {
      setRemaining(0);
      return;
    }

    // Counted from an absolute end time rather than a seconds-remaining figure,
    // so a browser source that reconnects mid-round does not restart the clock
    // from a stale number.
    const tick = () => setRemaining(Math.max(0, Math.round((endsAtMs - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAtMs, active]);

  return remaining;
}

function PkOverlayContent() {
  const token = useSearchParams().get('token');
  const [pk, setPk] = useState<PkState | null>(null);

  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
  }, []);

  const handleState = useCallback((state: OverlayState) => {
    if (state.kind === 'pk') setPk(state);
  }, []);

  const noop = useCallback(() => undefined, []);
  const { status, rejectionCode } = useOverlaySocket(token, {
    onAction: noop,
    onState: handleState,
  });

  const remaining = useCountdown(pk?.endsAtMs, pk?.active ?? false);

  const problem = !token
    ? 'Thiếu ?token= trong URL overlay'
    : status === 'rejected'
      ? `Token không hợp lệ (${rejectionCode ?? 'unknown'})`
      : null;

  // Nothing is drawn between battles. An empty bar sitting on the broadcast
  // would imply a round is running when none is.
  if (!pk) {
    return problem ? (
      <div style={{ padding: '2rem', color: '#fca5a5', fontFamily: 'system-ui, sans-serif' }}>
        {problem}
      </div>
    ) : null;
  }

  const [left, right] = pk.sides;
  const total = left.score + right.score;
  const leftPct = total > 0 ? (left.score / total) * 100 : 50;

  return (
    <div style={{ width: '100vw', padding: '2rem', display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          width: '600px',
          background: 'rgba(10, 15, 20, 0.6)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          padding: '1rem 1.25rem',
          border: '1px solid rgba(255,255,255,0.12)',
          fontFamily: 'system-ui, sans-serif',
          color: 'white',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '1rem',
            marginBottom: '0.6rem',
          }}
        >
          <Side side={left} color={LEFT} align="left" />
          <div
            style={{
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 700,
              fontSize: '0.9rem',
              opacity: pk.active ? 1 : 0.6,
              whiteSpace: 'nowrap',
            }}
          >
            {pk.active ? formatClock(remaining) : 'Kết thúc'}
          </div>
          <Side side={right} color={RIGHT} align="right" />
        </div>

        <div
          style={{
            display: 'flex',
            height: '18px',
            borderRadius: '9px',
            overflow: 'hidden',
            background: 'rgba(0,0,0,0.5)',
          }}
        >
          <div
            style={{
              width: `${leftPct}%`,
              background: LEFT,
              transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
          <div style={{ flex: 1, background: RIGHT }} />
        </div>
      </div>
    </div>
  );
}

function Side({
  side,
  color,
  align,
}: {
  side: PkState['sides'][number];
  color: string;
  align: 'left' | 'right';
}) {
  return (
    <div style={{ textAlign: align, minWidth: 0, flex: 1 }}>
      <div
        style={{
          fontWeight: 700,
          fontSize: '0.95rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {side.hostDisplayName}
      </div>
      <div style={{ color, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        {side.score.toLocaleString('vi-VN')}
      </div>
      {side.mvpDisplayName && (
        <div
          style={{
            fontSize: '0.7rem',
            opacity: 0.7,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          MVP {side.mvpDisplayName}
        </div>
      )}
    </div>
  );
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PkOverlay() {
  return (
    <Suspense fallback={null}>
      <PkOverlayContent />
    </Suspense>
  );
}
