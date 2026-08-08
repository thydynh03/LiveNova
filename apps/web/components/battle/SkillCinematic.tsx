'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * The full-screen moment a big gift buys.
 *
 * A dragon or a meteor is what somebody paid the most for, so it gets the
 * screen — but only for the actions worth interrupting for. A soldier arriving
 * every second must not dim a live broadcast.
 *
 * Video, not code. The artwork is a WebM with an alpha channel that an admin
 * uploads against a `fx_<action>` key; nobody edits a component to make the
 * dragon better. **VP9 with alpha specifically** — HEVC-with-alpha is Safari's
 * path and does not decode in the CEF browser OBS embeds, which is where this
 * actually runs.
 */

export interface CinematicRequest {
  /** Unique per dispatch, so the same gift is not replayed on reconnect. */
  id: string;
  actionKey: string;
  videoUrl: string;
  senderLabel?: string;
}

/** How long the screen dims before the video starts. */
const DIM_MS = 200;

/** Ceiling on how long one cinematic may hold the screen. */
const MAX_HOLD_MS = 6000;

export function SkillCinematic({
  request,
  onDone,
}: {
  request: CinematicRequest | null;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'dim' | 'playing'>('idle');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Clear on every change, or a second gift arriving mid-cinematic leaves the
    // first one's timers running and they end the new one early.
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (!request) {
      setPhase('idle');
      return;
    }

    // The beat before the spectacle. It costs nothing to render and it tells
    // the whole room somebody just spent heavily — which is the thing that
    // actually starts a donation race.
    setPhase('dim');

    timersRef.current.push(
      setTimeout(() => {
        setPhase('playing');
        void videoRef.current?.play().catch(() => {
          // Autoplay is fine in a Browser Source but blocked in a normal tab.
          // Failing here must not wedge the queue behind a video that will
          // never start.
          onDone();
        });
      }, DIM_MS),
    );

    // A truncated or corrupt file would otherwise hold the screen forever.
    timersRef.current.push(setTimeout(onDone, DIM_MS + MAX_HOLD_MS));

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [request, onDone]);

  if (!request || phase === 'idle') return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        pointerEvents: 'none',
        display: 'grid',
        placeItems: 'center',
        // Dims in, then stays behind the video rather than snapping off, so the
        // effect reads as one movement instead of two.
        background: `rgba(0,0,0,${phase === 'dim' ? 0.55 : 0.35})`,
        transition: `background ${DIM_MS}ms ease-out`,
      }}
    >
      <video
        ref={videoRef}
        src={request.videoUrl}
        muted
        playsInline
        onEnded={onDone}
        onError={onDone}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          opacity: phase === 'playing' ? 1 : 0,
          transition: 'opacity 120ms ease-out',
        }}
      />

      {request.senderLabel && phase === 'playing' && (
        <div
          style={{
            position: 'absolute',
            bottom: '12%',
            padding: '0.5rem 1.25rem',
            borderRadius: '999px',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '1.4rem',
            textShadow: '0 2px 8px rgba(0,0,0,0.9)',
            whiteSpace: 'nowrap',
          }}
        >
          {request.senderLabel}
        </div>
      )}
    </div>
  );
}
