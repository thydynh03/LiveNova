'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { OverlayAction, RuleActionType, MediaPopupPayload } from '@livenova/shared';
import { useOverlaySocket } from '../../../lib/use-overlay-socket';
import { useSpeechQueue } from '../../../lib/use-speech-queue';

interface MediaPopupItem {
  id: string;
  mediaType: 'video' | 'image' | 'blackout' | 'flashbang';
  url: string;
  volume: number;
  durationMs: number;
  caption?: string;
}

function playTVStaticSound(durationMs = 5000) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const bufferSize = ctx.sampleRate * (durationMs / 1000);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // Crackling harsh TV static sound "tusttttt"
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

    setTimeout(() => {
      try {
        noise.stop();
        ctx.close();
      } catch (err) {
        console.error(err);
      }
    }, durationMs);
  } catch (e) {
    console.error('TV Static sound error:', e);
  }
}

function playCSGOFlashbangSound(durationMs = 5000) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const durSec = durationMs / 1000;

    // 1. CS:GO Grenade Explosion Bang (Noise Burst + Low Frequency Sub-Bass Kick)
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

    // Sub-bass impact oscillator
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

    // 2. Iconic CS:GO High-Pitched Tinnitus Ear Ringing Tone (4200 Hz Sine Wave)
    const ringOsc = ctx.createOscillator();
    ringOsc.type = 'sine';
    ringOsc.frequency.setValueAtTime(4200, now); // Iconic CS:GO tinnitus pitch

    const ringGain = ctx.createGain();
    ringGain.gain.setValueAtTime(0.5, now + 0.05); // Starts right after bang
    ringGain.gain.exponentialRampToValueAtTime(0.0001, now + durSec);

    ringOsc.connect(ringGain);
    ringGain.connect(ctx.destination);
    ringOsc.start(now + 0.05);
    ringOsc.stop(now + durSec);

    setTimeout(() => {
      try {
        ctx.close();
      } catch (err) {
        console.error(err);
      }
    }, durationMs + 200);
  } catch (e) {
    console.error('CS:GO Flashbang sound error:', e);
  }
}

function MediaOverlayContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const customDefaultVideoFromQuery = searchParams.get('defaultVideo');
  const fitParam = searchParams.get('fit'); // 'cover' | 'contain' | 'fill'

  // Default to 'cover' so video fills 100% of any Custom Resolution box in TikTok LIVE Studio / OBS without black borders
  const objectFitMode: 'cover' | 'contain' | 'fill' =
    fitParam === 'contain' ? 'contain' : fitParam === 'fill' ? 'fill' : 'cover';

  const [overlayDefaultVideo, setOverlayDefaultVideo] = useState<string | null>(null);
  const [activePopup, setActivePopup] = useState<MediaPopupItem | null>(null);

  // Fetch overlay public config by token to retrieve per-user default idle video setting
  useEffect(() => {
    if (!token) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
    fetch(`${apiUrl}/public/overlays/${token}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.config?.defaultVideo) {
          setOverlayDefaultVideo(data.config.defaultVideo);
        }
      })
      .catch(() => {});
  }, [token]);

  // Priority: 1. User config in DB -> 2. URL parameter -> 3. Fallback /DogDefault.mp4
  const defaultVideoUrl = overlayDefaultVideo || customDefaultVideoFromQuery || '/DogDefault.mp4';

  useEffect(() => {
    // Transparent background for OBS chromakey
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
  }, []);

  const { enqueue: speak, status: speechStatus } = useSpeechQueue();

  const handleAction = useCallback((action: OverlayAction) => {
    // Speech arrives already synthesised: the server bills the owner and hands
    // over a URL, because this page authenticates with a public token alone and
    // has no identity the credit ledger could charge.
    if (action.type === RuleActionType.TTS_READ) {
      const audioUrl = (action.payload as { audioUrl?: unknown }).audioUrl;
      if (typeof audioUrl === 'string' && audioUrl !== '') {
        const rawVolume = (action.payload as { volume?: unknown }).volume;
        speak({
          id: action.id,
          audioUrl,
          volume: typeof rawVolume === 'number' ? rawVolume : 1,
        });
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
      (payload.url?.endsWith('.mp4') ||
        payload.url?.endsWith('.webm') ||
        payload.mediaType === 'video');

    // If url is missing or points to old asset, default to /DogDonate.mp4
    const popupUrl = payload.url || '/DogDonate.mp4';

    const item: MediaPopupItem = {
      id: action.id,
      mediaType: isBlackout ? 'blackout' : isFlashbang ? 'flashbang' : isVideoUrl ? 'video' : 'image',
      url: popupUrl,
      volume: payload.volume ?? 0.8,
      durationMs: payload.durationMs || 5000,
      caption: payload.caption,
    };

    if (isBlackout) {
      playTVStaticSound(item.durationMs);
    } else if (isFlashbang) {
      playCSGOFlashbangSound(item.durationMs);
    }

    setActivePopup(item);

    setTimeout(() => {
      setActivePopup((current) => (current?.id === item.id ? null : current));
    }, item.durationMs);
  }, [speak]);

  const { status, rejectionCode } = useOverlaySocket(token, { onAction: handleAction });

  const statusMessage = speechStatus === 'blocked'
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

  // Always keep both layers in the DOM — swap visibility via opacity to avoid
  // React mount/unmount flicker and give the video decoder time to buffer frames
  // before the crossfade begins.
  const popupVideoRef = React.useRef<HTMLVideoElement>(null);
  const defaultVideoRef = React.useRef<HTMLVideoElement>(null);
  const showingPopup = activePopup !== null && activePopup.mediaType === 'video';
  const showingEffect = activePopup !== null && (activePopup.mediaType === 'blackout' || activePopup.mediaType === 'flashbang');

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        boxSizing: 'border-box',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <style>{`
        @keyframes popupIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .overlay-layer {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
        .overlay-video {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: ${objectFitMode};
        }
        .overlay-fade {
          transition: opacity 0.18s ease-in-out;
        }
      `}</style>

      {statusMessage && (
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.75)',
            color: '#fff',
            fontFamily: 'sans-serif',
            fontSize: '0.85rem',
            zIndex: 100,
          }}
        >
          {statusMessage}
        </div>
      )}

      {/* Layer 1: Default idle video — always mounted, fades out during popup */}
      <div
        className="overlay-layer overlay-fade"
        style={{
          opacity: activePopup ? 0 : 1,
          filter: 'drop-shadow(0 0 15px rgba(255, 255, 255, 0.2))',
          zIndex: 1,
        }}
      >
        <video
          src={defaultVideoUrl}
          autoPlay
          loop
          muted
          playsInline
          className="overlay-video"
          ref={(el) => {
            (defaultVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
            if (el) el.play().catch(() => {});
          }}
        />
      </div>

      {/* Layer 2: Popup reaction video — always mounted, fades in on donate */}
      {(showingPopup || (!activePopup && popupVideoRef.current?.src)) && (
        <div
          className="overlay-layer overlay-fade"
          style={{
            opacity: showingPopup ? 1 : 0,
            zIndex: 2,
          }}
        >
          <video
            src={activePopup?.url ?? (popupVideoRef.current?.src ?? '')}
            playsInline
            className="overlay-video"
            ref={(el) => {
              (popupVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
              if (el && activePopup) {
                el.volume = activePopup.volume;
                el.currentTime = 0;
                el.play().catch(() => {
                  el.muted = true;
                  el.play().catch(() => {});
                });
              }
            }}
          />
        </div>
      )}

      {/* Layer 3: Image popup */}
      {activePopup && activePopup.mediaType === 'image' && activePopup.url && (
        <div
          className="overlay-layer overlay-fade"
          style={{
            opacity: 1,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={activePopup.url}
            alt="Popup effect"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://media.giphy.com/media/3o7TKrEzvLbsVAud8I/giphy.gif';
            }}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: objectFitMode,
            }}
          />
        </div>
      )}

      {/* Layer 4: Blackout (Broken TV Screen) */}
      {showingEffect && activePopup.mediaType === 'blackout' && (
        <div
          className="overlay-layer overlay-fade"
          style={{
            backgroundImage: 'url(/uploads/broken-screen.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: '#000000',
            opacity: 1,
            zIndex: 999999,
          }}
        />
      )}

      {/* Layer 5: Flashbang */}
      {showingEffect && activePopup.mediaType === 'flashbang' && (
        <div
          className="overlay-layer overlay-fade"
          style={{
            backgroundColor: '#ffffff',
            opacity: 1,
            zIndex: 999999,
          }}
        />
      )}
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
