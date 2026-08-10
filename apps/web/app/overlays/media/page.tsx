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
      } catch {}
    }, durationMs);
  } catch (e) {
    console.error('TV Static sound error:', e);
  }
}

function MediaOverlayContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const customDefaultVideoFromQuery = searchParams.get('defaultVideo');

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

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <style>{`
        @keyframes popupIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulseGlow {
          0% { transform: scale(1); opacity: 0.9; }
          100% { transform: scale(1.03); opacity: 1; }
        }
        .media-popup {
          animation: popupIn 0.25s ease-out forwards;
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



      {/* Donate Popup Reaction Video / Image / Blackout Effect */}
      {activePopup ? (
        activePopup.mediaType === 'blackout' ? (
          <div
            className="media-popup"
            style={{
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100vh',
              backgroundImage: 'url(/uploads/broken-screen.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundColor: '#000000',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999999,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <div
              style={{
                fontSize: '3.2rem',
                fontWeight: 900,
                color: '#ff3344',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                textShadow: '0 0 25px rgba(255, 51, 68, 0.9), 0 0 10px rgba(0, 0, 0, 0.8)',
                textAlign: 'center',
                padding: '0 1rem',
                background: 'rgba(0, 0, 0, 0.65)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 51, 68, 0.4)',
                animation: 'pulseGlow 0.8s infinite alternate ease-in-out',
              }}
            >
              💥 MÀN HÌNH HỎNG CỰC TROLL!
            </div>
            <div
              style={{
                fontSize: '1.35rem',
                color: '#ffffff',
                marginTop: '1.25rem',
                background: 'rgba(0, 0, 0, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                padding: '0.6rem 1.4rem',
                borderRadius: '12px',
                backdropFilter: 'blur(10px)',
                textAlign: 'center',
                fontWeight: 600,
              }}
            >
              {activePopup.caption || 'Cảm ơn đã Donate! Màn hình hỏng 5s cực gây ức chế 😈'}
            </div>
          </div>
        ) : activePopup.mediaType === 'flashbang' ? (
          <div
            className="media-popup"
            style={{
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999999,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <div
              style={{
                fontSize: '3.5rem',
                fontWeight: 900,
                color: '#111111',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                textShadow: '0 0 20px rgba(0, 0, 0, 0.3)',
                textAlign: 'center',
                padding: '0 1rem',
                animation: 'pulseGlow 0.8s infinite alternate ease-in-out',
              }}
            >
              ⚡ FLASHBANG MÙ MẮT!
            </div>
            <div
              style={{
                fontSize: '1.25rem',
                color: '#333333',
                marginTop: '1.25rem',
                background: 'rgba(0, 0, 0, 0.08)',
                padding: '0.6rem 1.2rem',
                borderRadius: '12px',
                textAlign: 'center',
              }}
            >
              {activePopup.caption || 'Mù trắng 5 giây cực gây ức chế! 🙈'}
            </div>
          </div>
        ) : (
          <div
            className="media-popup"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              overflow: 'hidden',
            }}
          >
            {activePopup.url && (
              activePopup.mediaType === 'video' ? (
                <video
                  src={activePopup.url}
                  autoPlay
                  playsInline
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    objectFit: 'fill',
                  }}
                  ref={(el) => {
                    if (el) {
                      el.volume = activePopup.volume;
                      el.play().catch(() => {
                        el.muted = true;
                        el.play().catch(() => {});
                      });
                    }
                  }}
                />
              ) : (
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
                    objectFit: 'fill',
                  }}
                />
              )
            )}
          </div>
        )
      ) : (
        /* Default Idle Video: DogDefault.mp4 plays continuously on loop */
        <video
          src={defaultVideoUrl}
          autoPlay
          loop
          muted
          playsInline
          style={{
            maxWidth: '100%',
            maxHeight: '450px',
            objectFit: 'contain',
            filter: 'drop-shadow(0 0 15px rgba(255, 255, 255, 0.2))',
          }}
          ref={(el) => {
            if (el) {
              el.play().catch(() => {});
            }
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
