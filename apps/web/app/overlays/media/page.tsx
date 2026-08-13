'use client';

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  Suspense,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { OverlayAction, RuleActionType, MediaPopupPayload } from '@livenova/shared';
import { useOverlaySocket } from '../../../lib/use-overlay-socket';
import { useSpeechQueue } from '../../../lib/use-speech-queue';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MediaPopupItem {
  id: string;
  mediaType: 'video' | 'image' | 'blackout' | 'flashbang';
  url: string;
  volume: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Audio synthesizers
// ---------------------------------------------------------------------------

function playTVStaticSound(durationMs = 5000) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const bufferSize = ctx.sampleRate * (durationMs / 1000);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.75 + (Math.sin(i * 0.05) > 0 ? 0.1 : -0.1);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.9;
    noise.connect(filter);
    filter.connect(ctx.destination);
    noise.start();
    setTimeout(() => { try { noise.stop(); ctx.close(); } catch (e) { void e; } }, durationMs);
  } catch (e) { void e; }
}

function playCSGOFlashbangSound(durationMs = 5000) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const durSec = durationMs / 1000;
    // Explosion bang
    const bangBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const bangData = bangBuffer.getChannelData(0);
    for (let i = 0; i < bangData.length; i++) {
      bangData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.07));
    }
    const bangSource = ctx.createBufferSource();
    bangSource.buffer = bangBuffer;
    const bangGain = ctx.createGain();
    bangGain.gain.setValueAtTime(1.0, now);
    bangGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    bangSource.connect(bangGain);
    bangGain.connect(ctx.destination);
    bangSource.start(now);
    const kickOsc = ctx.createOscillator();
    kickOsc.type = 'sine';
    kickOsc.frequency.setValueAtTime(160, now);
    kickOsc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
    const kickGain = ctx.createGain();
    kickGain.gain.setValueAtTime(0.95, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    kickOsc.connect(kickGain);
    kickGain.connect(ctx.destination);
    kickOsc.start(now);
    kickOsc.stop(now + 0.3);
    const ringOsc = ctx.createOscillator();
    ringOsc.type = 'sine';
    ringOsc.frequency.setValueAtTime(4200, now);
    const ringGain = ctx.createGain();
    ringGain.gain.setValueAtTime(0.5, now + 0.05);
    ringGain.gain.exponentialRampToValueAtTime(0.0001, now + durSec);
    ringOsc.connect(ringGain);
    ringGain.connect(ctx.destination);
    ringOsc.start(now + 0.05);
    ringOsc.stop(now + durSec);
    setTimeout(() => { try { ctx.close(); } catch (e) { void e; } }, durationMs + 200);
  } catch (e) { void e; }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** CSS crossfade duration — short enough to feel snappy */
const FADE_MS = 180;

// ---------------------------------------------------------------------------
// Main overlay component
// ---------------------------------------------------------------------------

function MediaOverlayContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const customDefaultVideoFromQuery = searchParams.get('defaultVideo');
  const fitParam = searchParams.get('fit');

  const objectFitMode: 'cover' | 'contain' | 'fill' =
    fitParam === 'contain' ? 'contain' : fitParam === 'fill' ? 'fill' : 'cover';

  // ---------------------------------------------------------------------------
  // State — only what the renderer needs
  // ---------------------------------------------------------------------------
  const [overlayDefaultVideo, setOverlayDefaultVideo] = useState<string | null>(null);
  /** The item currently being rendered (drives which layers are shown) */
  const [current, setCurrent] = useState<MediaPopupItem | null>(null);
  /** Controls the opacity 0→1 crossfade */
  const [popupVisible, setPopupVisible] = useState(false);

  // ---------------------------------------------------------------------------
  // Refs — mutable state that must NOT trigger re-renders
  // ---------------------------------------------------------------------------
  /** Pending items to be played sequentially */
  const queueRef = useRef<MediaPopupItem[]>([]);
  /** True while an item is being shown (prevents concurrent plays) */
  const busyRef = useRef(false);
  /** Handle for the hide-after-duration timer */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Handle for the fade-out → cleanup timer */
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Always-in-DOM video elements so the browser keeps the decoder warm */
  const defaultVideoRef = useRef<HTMLVideoElement>(null);
  const popupVideoRef = useRef<HTMLVideoElement>(null);
  /** Hidden off-screen element used to preload the next video in queue */
  const preloadVideoRef = useRef<HTMLVideoElement>(null);

  /**
   * processNext is stored in a ref so every timer callback always calls the
   * LATEST version of the function — this is the canonical React pattern to
   * avoid stale-closure bugs in nested setTimeouts.
   */
  const processNextRef = useRef<() => void>(() => {});

  // ---------------------------------------------------------------------------
  // User config fetch
  // ---------------------------------------------------------------------------
  const defaultVideoUrl = overlayDefaultVideo || customDefaultVideoFromQuery || '/DogDefault.mp4';

  useEffect(() => {
    if (!token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
    fetch(`${apiUrl}/public/overlays/${token}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.config?.defaultVideo) setOverlayDefaultVideo(data.config.defaultVideo); })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
  }, []);

  // ---------------------------------------------------------------------------
  // Queue processor — defined inline (not memoised) so it always captures
  // the latest state setters, but called exclusively via processNextRef so
  // recursive invocations are also fresh.
  // ---------------------------------------------------------------------------
  processNextRef.current = () => {
    // Guard: one item at a time
    if (busyRef.current) return;
    if (queueRef.current.length === 0) return;

    const item = queueRef.current.shift()!;
    busyRef.current = true;

    // Clear any lingering timers from a previous item (safety net)
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }

    // Trigger audio side-effects immediately
    if (item.mediaType === 'blackout') playTVStaticSound(item.durationMs);
    if (item.mediaType === 'flashbang') playCSGOFlashbangSound(item.durationMs);

    // For video: set src NOW so the decoder starts buffering before the
    // element becomes visible — eliminates the first-frame black flash.
    if (item.mediaType === 'video' && popupVideoRef.current) {
      const el = popupVideoRef.current;
      el.pause();
      el.src = item.url;
      el.volume = item.volume;
      el.currentTime = 0;
      el.load(); // kick off buffering
    }

    // Update the rendered item (sync — sets which layer CSS class is active)
    setCurrent(item);

    // Fade in: two rAF passes ensure the browser has committed the new src
    // attribute to the GPU before we change opacity, eliminating the flash.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPopupVisible(true);
        if (item.mediaType === 'video' && popupVideoRef.current) {
          popupVideoRef.current.play().catch(() => {
            if (popupVideoRef.current) {
              popupVideoRef.current.muted = true;
              popupVideoRef.current.play().catch(() => {});
            }
          });
        }

        // Preload next video in queue while this one plays
        const next = queueRef.current[0];
        if (next?.mediaType === 'video' && preloadVideoRef.current) {
          preloadVideoRef.current.src = next.url;
          preloadVideoRef.current.load();
        }
      });
    });

    // Schedule hide — start counting from NOW (item.durationMs after drain)
    timerRef.current = setTimeout(() => {
      // Ensure default idle video decoder is active and playing before opacity transition begins
      if (defaultVideoRef.current) {
        defaultVideoRef.current.play().catch(() => {});
      }

      // Fade the popup layer out
      setPopupVisible(false);

      // After the CSS transition completes, clean up and dequeue the next item
      fadeTimerRef.current = setTimeout(() => {
        setCurrent(null);
        if (popupVideoRef.current) {
          popupVideoRef.current.pause();
        }
        // Release the busy lock and immediately try to play the next item
        busyRef.current = false;
        // Call via ref — always the latest version, no stale closure possible
        processNextRef.current();
      }, FADE_MS + 30);
    }, item.durationMs);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Speech queue
  // ---------------------------------------------------------------------------
  const { enqueue: speak, status: speechStatus } = useSpeechQueue();

  // ---------------------------------------------------------------------------
  // WebSocket action handler
  // ---------------------------------------------------------------------------
  const handleAction = useCallback((action: OverlayAction) => {
    if (action.type === RuleActionType.TTS_READ) {
      const audioUrl = (action.payload as { audioUrl?: unknown }).audioUrl;
      if (typeof audioUrl === 'string' && audioUrl !== '') {
        const rawVolume = (action.payload as { volume?: unknown }).volume;
        speak({ id: action.id, audioUrl, volume: typeof rawVolume === 'number' ? rawVolume : 1 });
      }
      return;
    }

    if (action.type !== RuleActionType.MEDIA_POPUP) return;

    const payload = action.payload as unknown as MediaPopupPayload & { caption?: string };
    const isBlackout = (payload.mediaType as string) === 'blackout' || payload.url === 'blackout';
    const isFlashbang = (payload.mediaType as string) === 'flashbang' || payload.url === 'flashbang';
    const isVideoUrl =
      !isBlackout && !isFlashbang &&
      (payload.url?.endsWith('.mp4') || payload.url?.endsWith('.webm') || payload.mediaType === 'video');

    const item: MediaPopupItem = {
      id: action.id,
      mediaType: isBlackout ? 'blackout' : isFlashbang ? 'flashbang' : isVideoUrl ? 'video' : 'image',
      url: payload.url || '/DogDonate.mp4',
      volume: payload.volume ?? 0.8,
      durationMs: payload.durationMs || 5000,
    };

    // Enqueue — processNext will play it as soon as the current item finishes
    queueRef.current.push(item);

    // Try to start immediately (no-op if busyRef is true)
    processNextRef.current();
  }, [speak]); // speak is the only external dep; processNextRef is always fresh

  // ---------------------------------------------------------------------------
  // WebSocket connection
  // ---------------------------------------------------------------------------
  const { status, rejectionCode } = useOverlaySocket(token, { onAction: handleAction });

  const statusMessage =
    speechStatus === 'blocked'
      ? 'Trình duyệt chặn tự phát âm thanh — mở URL này trong OBS Browser Source'
      : !token
      ? 'Thiếu ?token= trong URL overlay'
      : status === 'connecting'
      ? 'Đang kết nối…'
      : status === 'reconnecting'
      ? 'Mất kết nối — đang thử lại…'
      : status === 'rejected'
      ? `Token không hợp lệ (${rejectionCode ?? 'unknown'})`
      : null;

  // Derive booleans for the render — avoids repeated ternary chains
  const isVideo = current?.mediaType === 'video';
  const isImage = current?.mediaType === 'image';
  const isBlackout = current?.mediaType === 'blackout';
  const isFlashbang = current?.mediaType === 'flashbang';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        background: 'transparent',
      }}
    >
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* All layers share the same base rules */
        .ol-layer {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          /* GPU-composited hardware acceleration — zero layout cost, tear-free crossfade */
          transform: translateZ(0);
          will-change: opacity, transform;
          transition: opacity ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Video / image fill */
        .ol-video, .ol-img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: ${objectFitMode};
        }
      `}</style>

      {/* Status badge */}
      {statusMessage && (
        <div style={{
          position: 'absolute', top: '1rem', left: '1rem', zIndex: 200,
          padding: '0.5rem 0.75rem', borderRadius: '8px',
          background: 'rgba(0,0,0,0.75)', color: '#fff',
          fontFamily: 'sans-serif', fontSize: '0.85rem',
          pointerEvents: 'none',
        }}>
          {statusMessage}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* LAYER 0 — default idle video                                        */}
      {/* Always in DOM. Fades to opacity 0 while a popup is showing so the  */}
      {/* video keeps playing underneath and snaps back when the popup ends.  */}
      {/* ------------------------------------------------------------------ */}
      <div className="ol-layer" style={{ opacity: popupVisible ? 0 : 1, zIndex: 1 }}>
        <video
          ref={defaultVideoRef}
          src={defaultVideoUrl}
          autoPlay
          loop
          muted
          playsInline
          className="ol-video"
          onLoadedData={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* LAYER 1 — donate reaction video                                     */}
      {/* Always in DOM. src is changed imperatively via popupVideoRef to     */}
      {/* avoid React unmounting the element (which resets the decoder).      */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="ol-layer"
        style={{
          opacity: popupVisible && isVideo ? 1 : 0,
          zIndex: 2,
          // Prevent invisible layer from intercepting pointer events
          pointerEvents: popupVisible && isVideo ? 'auto' : 'none',
        }}
      >
        <video ref={popupVideoRef} playsInline className="ol-video" />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* LAYER 2 — image popup                                              */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="ol-layer"
        style={{
          opacity: popupVisible && isImage ? 1 : 0,
          zIndex: 2,
          pointerEvents: popupVisible && isImage ? 'auto' : 'none',
        }}
      >
        {isImage && current?.url && (
          <img
            src={current.url}
            alt="Popup effect"
            className="ol-img"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://media.giphy.com/media/3o7TKrEzvLbsVAud8I/giphy.gif';
            }}
          />
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* LAYER 3 — blackout (Broken TV Screen)                              */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="ol-layer"
        style={{
          opacity: popupVisible && isBlackout ? 1 : 0,
          zIndex: 999999,
          backgroundImage: 'url(/uploads/broken-screen.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#000',
          pointerEvents: popupVisible && isBlackout ? 'auto' : 'none',
        }}
      />

      {/* ------------------------------------------------------------------ */}
      {/* LAYER 4 — flashbang white                                          */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="ol-layer"
        style={{
          opacity: popupVisible && isFlashbang ? 1 : 0,
          zIndex: 999999,
          backgroundColor: '#fff',
          pointerEvents: popupVisible && isFlashbang ? 'auto' : 'none',
        }}
      />

      {/* Off-screen preloader — buffers the next video in queue */}
      <video
        ref={preloadVideoRef}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        playsInline
        muted
        preload="auto"
      />
    </div>
  );
}

export default function MediaOverlayPage() {
  return (
    <Suspense fallback={null}>
      <MediaOverlayContent />
    </Suspense>
  );
}
