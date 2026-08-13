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
    // Sub-bass kick
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
    // Tinnitus ring
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
// Main overlay component
// ---------------------------------------------------------------------------

/**
 * Crossfade duration in ms.  Short enough to feel snappy, long enough for the
 * GPU compositor to avoid any visible tear.
 */
const FADE_MS = 180;

/**
 * How many ms before the current item ends do we start preloading the next
 * video in the queue.  Gives the decoder time to buffer the first frame so
 * the crossfade into the next clip is instant.
 */
const PRELOAD_AHEAD_MS = 500;

function MediaOverlayContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const customDefaultVideoFromQuery = searchParams.get('defaultVideo');
  const fitParam = searchParams.get('fit');

  // 'cover' fills the Custom Resolution box without black bars (default).
  // Append &fit=contain or &fit=fill to the overlay URL to override.
  const objectFitMode: 'cover' | 'contain' | 'fill' =
    fitParam === 'contain' ? 'contain' : fitParam === 'fill' ? 'fill' : 'cover';

  // --- state ---
  const [overlayDefaultVideo, setOverlayDefaultVideo] = useState<string | null>(null);

  // The item currently being displayed
  const [current, setCurrent] = useState<MediaPopupItem | null>(null);
  // Whether the popup layer is visible (opacity 1)
  const [popupVisible, setPopupVisible] = useState(false);

  // --- refs ---
  // Queue of pending items (processed serially)
  const queueRef = useRef<MediaPopupItem[]>([]);
  // True while an item is being played (guards concurrent drains)
  const busyRef = useRef(false);
  // setTimeout handle for the current item's duration
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // setTimeout handle for preload
  const preloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Video element refs — kept always in the DOM to avoid decoder re-init
  const defaultVideoRef = useRef<HTMLVideoElement>(null);
  const popupVideoRef = useRef<HTMLVideoElement>(null);
  // Hidden preloader: loads next video src while current is playing
  const preloadVideoRef = useRef<HTMLVideoElement>(null);

  // --- user config ---
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

  // --- queue drain ---
  const drainQueue = useCallback(() => {
    if (busyRef.current) return;
    if (queueRef.current.length === 0) return;

    const item = queueRef.current.shift()!;
    busyRef.current = true;

    // 1. Play audio side-effects immediately (before video appears)
    if (item.mediaType === 'blackout') playTVStaticSound(item.durationMs);
    if (item.mediaType === 'flashbang') playCSGOFlashbangSound(item.durationMs);

    // 2. For video items: set src on the hidden popup video element so the
    //    decoder can start buffering before we make it visible.
    if (item.mediaType === 'video' && popupVideoRef.current) {
      const el = popupVideoRef.current;
      el.src = item.url;
      el.volume = item.volume;
      el.currentTime = 0;
      // Preload — play() then immediately pause so the first frame is decoded
      el.load();
    }

    // 3. Update state — this triggers the crossfade
    setCurrent(item);
    // Small rAF delay so the browser paints the new src before opacity flip
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPopupVisible(true);
        // If it's a video, actually start playback now that it's visible
        if (item.mediaType === 'video' && popupVideoRef.current) {
          const el = popupVideoRef.current;
          el.play().catch(() => { el.muted = true; el.play().catch(() => {}); });
        }
      });
    });

    // 4. Preload the NEXT item in queue while current plays
    if (queueRef.current.length > 0 && item.durationMs > PRELOAD_AHEAD_MS) {
      const next = queueRef.current[0];
      if (next.mediaType === 'video' && preloadVideoRef.current) {
        preloadTimerRef.current = setTimeout(() => {
          if (preloadVideoRef.current) {
            preloadVideoRef.current.src = next.url;
            preloadVideoRef.current.load();
          }
        }, item.durationMs - PRELOAD_AHEAD_MS);
      }
    }

    // 5. Schedule hide
    timerRef.current = setTimeout(() => {
      // Fade out popup layer
      setPopupVisible(false);
      // After fade completes, clear current and allow next item
      setTimeout(() => {
        setCurrent(null);
        if (popupVideoRef.current) {
          popupVideoRef.current.pause();
          popupVideoRef.current.src = '';
        }
        busyRef.current = false;
        drainQueue();
      }, FADE_MS + 50);
    }, item.durationMs);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (preloadTimerRef.current) clearTimeout(preloadTimerRef.current);
    };
  }, []);

  // --- speech queue ---
  const { enqueue: speak, status: speechStatus } = useSpeechQueue();

  // --- websocket action handler ---
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
      !isBlackout &&
      !isFlashbang &&
      (payload.url?.endsWith('.mp4') || payload.url?.endsWith('.webm') || payload.mediaType === 'video');

    const item: MediaPopupItem = {
      id: action.id,
      mediaType: isBlackout ? 'blackout' : isFlashbang ? 'flashbang' : isVideoUrl ? 'video' : 'image',
      url: payload.url || '/DogDonate.mp4',
      volume: payload.volume ?? 0.8,
      durationMs: payload.durationMs || 5000,
    };

    // Push to queue — drainQueue() will play them serially
    queueRef.current.push(item);
    drainQueue();
  }, [speak, drainQueue]);

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

  // Derived booleans for render
  const isVideo = current?.mediaType === 'video';
  const isImage = current?.mediaType === 'image';
  const isBlackout = current?.mediaType === 'blackout';
  const isFlashbang = current?.mediaType === 'flashbang';

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        boxSizing: 'border-box',
        position: 'relative',
        background: 'transparent',
      }}
    >
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        .ol-layer {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          /* Use will-change so the browser composites these on the GPU,
             guaranteeing tear-free opacity transitions with zero layout cost. */
          will-change: opacity;
          transition: opacity ${FADE_MS}ms ease-in-out;
        }
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
        }}>
          {statusMessage}
        </div>
      )}

      {/* LAYER 0 — default idle video (always in DOM, never unmounted)
          Fades out while a popup is showing so the video keeps playing
          underneath and snaps back instantly when the popup ends. */}
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

      {/* LAYER 1 — donate reaction video (always in DOM, src swapped per item)
          Fades in from opacity 0 → 1 when an item starts, then back to 0. */}
      <div className="ol-layer" style={{ opacity: popupVisible && isVideo ? 1 : 0, zIndex: 2 }}>
        <video
          ref={popupVideoRef}
          playsInline
          className="ol-video"
        />
      </div>

      {/* LAYER 2 — image popup */}
      {isImage && current?.url && (
        <div className="ol-layer" style={{ opacity: popupVisible ? 1 : 0, zIndex: 2 }}>
          <img
            src={current.url}
            alt="Popup effect"
            className="ol-img"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                'https://media.giphy.com/media/3o7TKrEzvLbsVAud8I/giphy.gif';
            }}
          />
        </div>
      )}

      {/* LAYER 3 — broken TV screen (blackout) */}
      <div
        className="ol-layer"
        style={{
          opacity: popupVisible && isBlackout ? 1 : 0,
          zIndex: 999999,
          backgroundImage: 'url(/uploads/broken-screen.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#000',
          // pointer-events none so it doesn't block clicks when hidden
          pointerEvents: popupVisible && isBlackout ? 'auto' : 'none',
        }}
      />

      {/* LAYER 4 — flashbang white */}
      <div
        className="ol-layer"
        style={{
          opacity: popupVisible && isFlashbang ? 1 : 0,
          zIndex: 999999,
          backgroundColor: '#fff',
          pointerEvents: popupVisible && isFlashbang ? 'auto' : 'none',
        }}
      />

      {/* Hidden preloader — loads next video src off-screen */}
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
