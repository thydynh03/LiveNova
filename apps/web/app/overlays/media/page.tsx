'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { OverlayAction, RuleActionType, MediaPopupPayload } from '@livenova/shared';
import { useOverlaySocket } from '../../../lib/use-overlay-socket';
import { useSpeechQueue } from '../../../lib/use-speech-queue';

interface MediaPopupItem {
  id: string;
  senderDisplayName: string;
  giftName?: string;
  giftCoinValue?: number;
  content?: string;
  mediaType: 'video' | 'image';
  url: string;
  position: string;
  volume: number;
  caption: string;
  durationMs: number;
}

function MediaOverlayContent() {
  const token = useSearchParams().get('token');
  const [activePopup, setActivePopup] = useState<MediaPopupItem | null>(null);

  useEffect(() => {
    // Transparent background for OBS chromakey
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
  }, []);

  const { enqueue: speak, status: speechStatus, unblock } = useSpeechQueue();

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

    const payload = action.payload as unknown as MediaPopupPayload;
    const event = action.event;

    // Substitute template placeholders in caption if any
    let caption = payload.caption || 'Cảm ơn {sender} đã tương tác!';
    caption = caption
      .replace(/\{sender\}/g, event.senderDisplayName || 'Người xem')
      .replace(/\{gift\}/g, event.giftName || 'Món quà')
      .replace(/\{coins\}/g, String(event.giftCoinValue || 1));

    const isVideoUrl =
      payload.url?.endsWith('.mp4') ||
      payload.url?.endsWith('.webm') ||
      payload.mediaType === 'video';

    const item: MediaPopupItem = {
      id: action.id,
      senderDisplayName: event.senderDisplayName,
      giftName: event.giftName,
      giftCoinValue: event.giftCoinValue,
      content: event.content,
      mediaType: isVideoUrl ? 'video' : 'image',
      url: payload.url || '',
      position: payload.position || 'center',
      volume: payload.volume ?? 0.8,
      caption,
      durationMs: payload.durationMs || 5000,
    };

    setActivePopup(item);

    setTimeout(() => {
      setActivePopup((current) => (current?.id === item.id ? null : current));
    }, item.durationMs);
  }, [speak]);

  const { status, rejectionCode } = useOverlaySocket(token, { onAction: handleAction });

  const statusMessage = speechStatus === 'blocked'
    ? null // handled by the unblock button below
    : !token
    ? 'Thiếu ?token= trong URL overlay'
    : status === 'connecting'
    ? 'Đang kết nối…'
    : status === 'reconnecting'
    ? 'Mất kết nối — đang thử lại…'
    : status === 'rejected'
    ? `Token không hợp lệ (${rejectionCode ?? 'unknown'})`
    : null;

  // Position alignment mapping
  const getPositionStyles = (pos: string): React.CSSProperties => {
    switch (pos) {
      case 'top':
        return { justifyContent: 'center', alignItems: 'flex-start', paddingTop: '3rem' };
      case 'bottom':
        return { justifyContent: 'center', alignItems: 'flex-end', paddingBottom: '3rem' };
      case 'top-left':
        return { justifyContent: 'flex-start', alignItems: 'flex-start', padding: '3rem' };
      case 'top-right':
        return { justifyContent: 'flex-end', alignItems: 'flex-start', padding: '3rem' };
      case 'bottom-left':
        return { justifyContent: 'flex-start', alignItems: 'flex-end', padding: '3rem' };
      case 'bottom-right':
        return { justifyContent: 'flex-end', alignItems: 'flex-end', padding: '3rem' };
      default:
        return { justifyContent: 'center', alignItems: 'center' };
    }
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        boxSizing: 'border-box',
        position: 'relative',
        ...getPositionStyles(activePopup?.position || 'center'),
      }}
    >
      <style>{`
        @keyframes popupIn {
          0% { opacity: 0; transform: scale(0.7) translateY(40px); }
          60% { opacity: 1; transform: scale(1.05) translateY(-5px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .media-popup {
          animation: popupIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
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
          }}
        >
          {statusMessage}
        </div>
      )}

      {/*
        Autoplay unblock.

        This page is no longer only an OBS browser source. When the broadcast
        comes from a phone, the streamer opens it in an ordinary browser on the
        PC and it becomes the audio path for the whole product — so the old
        message here, "mở URL này trong OBS Browser Source", pointed the one
        group of users who cannot follow it at the one thing they do not have.

        A click is all the browser wants. It never appears inside OBS, which
        does not apply the autoplay policy.
      */}
      {speechStatus === 'blocked' && (
        <button
          type="button"
          onClick={() => void unblock()}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            border: 'none',
            background: 'rgba(0,0,0,0.82)',
            color: '#fff',
            fontFamily: 'sans-serif',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '2.5rem' }} aria-hidden="true">
            🔊
          </span>
          <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>Bấm để bật tiếng</span>
          <span style={{ fontSize: '0.9rem', opacity: 0.8, maxWidth: '30rem', textAlign: 'center' }}>
            Trình duyệt chặn tự phát âm thanh cho tới khi bạn bấm một lần. Bấm xong là giọng đọc chạy
            suốt buổi live.
          </span>
        </button>
      )}

      {activePopup && (
        <div
          className="media-popup"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0',
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            color: 'white',
            textAlign: 'center',
            maxWidth: '600px',
          }}
        >
          {/* Caption text floating with glow - like TikTok gift text */}
          <div style={{
            fontSize: '1.3rem',
            fontWeight: 800,
            color: '#FFD700',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textShadow: '0 0 10px rgba(255, 215, 0, 0.8), 0 0 20px rgba(255, 215, 0, 0.5), 0 2px 4px rgba(0,0,0,0.9)',
            letterSpacing: '0.02em',
          }}>
            <span style={{ fontSize: '1.5rem' }}>🎁</span>
            {activePopup.caption}
          </div>

          {activePopup.url && (
            activePopup.mediaType === 'video' ? (
              <video
                src={activePopup.url}
                autoPlay
                playsInline
                style={{
                  maxWidth: '100%',
                  maxHeight: '400px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 20px rgba(255, 165, 0, 0.4))',
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
                  maxWidth: '100%',
                  maxHeight: '400px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 20px rgba(255, 165, 0, 0.4))',
                }}
              />
            )
          )}
        </div>
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
