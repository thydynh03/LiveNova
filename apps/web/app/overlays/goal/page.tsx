'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { GoalState, OverlayState, readGoalConfig } from '@livenova/shared';
import { useOverlaySocket } from '../../../lib/use-overlay-socket';

/**
 * Goal bar, driven by real gift traffic.
 *
 * This page used to increment a counter with `Math.random()` on a three-second
 * timer. Pasting that URL into OBS puts an invented number on a broadcast right
 * next to real donations, which is worse than showing nothing at all — so the
 * bar now stays at zero until the server says otherwise, and says so plainly.
 */

function GoalOverlayContent() {
  const token = useSearchParams().get('token');
  const [goal, setGoal] = useState<GoalState | null>(null);

  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
  }, []);

  const handleState = useCallback((state: OverlayState) => {
    if (state.kind === 'goal') setGoal(state);
  }, []);

  // This overlay renders no one-shot actions; only continuous state.
  const noop = useCallback(() => undefined, []);

  const { status, ready, rejectionCode } = useOverlaySocket(token, {
    onAction: noop,
    onState: handleState,
  });

  // Until the first gift arrives there is no state frame, so the target and
  // label come from the config that travelled with the handshake.
  const config = readGoalConfig(ready?.config);
  const target = goal?.target ?? config.target;
  const label = goal?.label ?? config.label;
  const current = goal?.current ?? 0;
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  const problem = !token
    ? 'Thiếu ?token= trong URL overlay'
    : status === 'rejected'
      ? `Token không hợp lệ (${rejectionCode ?? 'unknown'})`
      : status === 'reconnecting'
        ? 'Mất kết nối — đang thử lại…'
        : null;

  return (
    <div style={{ width: '100vw', padding: '2rem', display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          width: '400px',
          background: 'rgba(10, 15, 20, 0.72)',
          backdropFilter: 'blur(12px)',
          borderRadius: '16px',
          padding: '1rem',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '0.75rem',
            color: 'white',
            marginBottom: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{ textTransform: 'uppercase', fontSize: '0.85rem' }}>{label}</span>
          <span
            style={{ color: ACCENT, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
          >
            {current.toLocaleString('vi-VN')} / {target.toLocaleString('vi-VN')}
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-label={label}
          style={{
            width: '100%',
            height: '20px',
            background: 'rgba(0,0,0,0.5)',
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          <div
            style={{
              width: `${percentage}%`,
              height: '100%',
              background: ACCENT,
              // Eases toward the new value instead of jumping, so a large gift
              // reads as the bar filling rather than as a redraw.
              transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: `0 0 15px ${ACCENT}80`,
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                animation: 'shimmer 2s infinite',
              }}
            />
          </div>
        </div>

        {problem && (
          <div style={{ marginTop: '0.6rem', color: '#fca5a5', fontSize: '0.75rem' }}>
            {problem}
          </div>
        )}

        <style>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @media (prefers-reduced-motion: reduce) {
            [style*="shimmer"] { animation: none !important; }
          }
        `}</style>
      </div>
    </div>
  );
}

/** Literal, not a theme token: this composites over arbitrary video. */
const ACCENT = '#22d3ee';

export default function GoalOverlay() {
  return (
    <Suspense fallback={null}>
      <GoalOverlayContent />
    </Suspense>
  );
}
