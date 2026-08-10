'use client';

import React, { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  OverlayAction,
  RuleActionType,
  StageEffectKind,
  STAGE_EFFECT_LIMITS,
  readEffectPayload,
} from '@livenova/shared';
import { useOverlaySocket } from '../../../lib/use-overlay-socket';
import { EffectLayer, ActiveEffect } from '../../../components/overlays/EffectLayer';

function StageOverlayContent() {
  const token = useSearchParams().get('token');
  const [effects, setEffects] = useState<ActiveEffect[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Transparent background for OBS chromakey
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const handleAction = useCallback((action: OverlayAction) => {
    if (action.type !== RuleActionType.EFFECT) return;

    // Re-read rather than cast. The server clamps everything before dispatch,
    // but this page also renders replayed actions after a reconnect, and an
    // overlay that trusts its input is one bad row away from a frozen source.
    const payload = readEffectPayload(action.payload);
    if (!payload) return;

    const item: ActiveEffect = {
      id: action.id,
      payload,
      startedAt: performance.now(),
    };

    setEffects((current) => {
      // Drop the oldest rather than queue: an effect that was triggered ten
      // seconds ago no longer relates to anything happening on stream.
      const kept = current.slice(-(STAGE_EFFECT_LIMITS.MAX_CONCURRENT - 1));
      return [...kept, item];
    });

    window.setTimeout(() => {
      setEffects((current) => current.filter((e) => e.id !== item.id));
    }, payload.durationMs);
  }, []);

  const { status, rejectionCode } = useOverlaySocket(token, { onAction: handleAction });

  const statusMessage = !token
    ? 'Thiếu ?token= trong URL overlay'
    : status === 'connecting'
    ? 'Đang kết nối…'
    : status === 'reconnecting'
    ? 'Mất kết nối — đang thử lại…'
    : status === 'rejected'
    ? `Token không hợp lệ (${rejectionCode ?? 'unknown'})`
    : null;

  const shake = useMemo(
    () => effects.find((e) => e.payload.kind === StageEffectKind.SHAKE),
    [effects],
  );

  // Amplitude is capped so a rule author cannot make the whole broadcast
  // unwatchable, and disabled outright under reduced motion.
  const shakeAmplitude = shake && !reducedMotion
    ? Math.min(12, 2 + shake.payload.intensity * 10)
    : 0;

  const captions = effects.filter((e) => e.payload.caption);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <style>{`
        @keyframes ln-shake {
          0%, 100% { transform: translate3d(0, 0, 0); }
          20%  { transform: translate3d(calc(var(--ln-amp) * -1px), calc(var(--ln-amp) * 0.6px), 0); }
          40%  { transform: translate3d(calc(var(--ln-amp) * 0.8px), calc(var(--ln-amp) * -0.7px), 0); }
          60%  { transform: translate3d(calc(var(--ln-amp) * -0.6px), calc(var(--ln-amp) * -0.4px), 0); }
          80%  { transform: translate3d(calc(var(--ln-amp) * 0.5px), calc(var(--ln-amp) * 0.5px), 0); }
        }
        @keyframes ln-caption-in {
          from { opacity: 0; transform: translate3d(0, 12px, 0); }
          to   { opacity: 1; transform: translate3d(0, 0, 0); }
        }
      `}</style>

      {statusMessage && (
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            zIndex: 10,
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.75)',
            color: '#fff',
            fontFamily: 'sans-serif',
            fontSize: '0.85rem',
          }}
        >
          {statusMessage}
        </div>
      )}

      <div
        data-testid="stage-shake-root"
        style={
          {
            position: 'absolute',
            inset: 0,
            '--ln-amp': shakeAmplitude,
            animation: shakeAmplitude > 0 ? 'ln-shake 420ms ease-in-out infinite' : undefined,
            willChange: shakeAmplitude > 0 ? 'transform' : undefined,
            pointerEvents: 'none',
          } as React.CSSProperties
        }
      >
        <EffectLayer effects={effects} reducedMotion={reducedMotion} />

        {captions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: '8%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              pointerEvents: 'none',
            }}
          >
            {captions.map((effect) => (
              <div
                key={effect.id}
                style={{
                  padding: '0.6rem 1.4rem',
                  borderRadius: '999px',
                  background: 'rgba(0,0,0,0.55)',
                  color: '#fff',
                  fontFamily: 'system-ui, sans-serif',
                  fontSize: '2rem',
                  fontWeight: 700,
                  textShadow: '0 2px 12px rgba(0,0,0,0.8)',
                  animation: 'ln-caption-in 240ms ease-out both',
                }}
              >
                {/*
                  A React text node, never innerHTML. Captions interpolate
                  {sender}, so this string can contain a viewer-controlled
                  display name — the audited reference implementation built the
                  same thing by string-concatenating HTML and shipped a stored
                  XSS as a result.
                */}
                {effect.payload.caption}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StageOverlayPage() {
  return (
    <Suspense fallback={null}>
      <StageOverlayContent />
    </Suspense>
  );
}
