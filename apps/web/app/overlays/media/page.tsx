'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { OverlayAction, RuleActionType, MediaPopupPayload } from '@livenova/shared';
import { useOverlaySocket } from '../../../lib/use-overlay-socket';
import { useSpeechQueue } from '../../../lib/use-speech-queue';

interface MediaPopupItem {
  id: string;
  mediaType: 'video' | 'image';
  url: string;
  volume: number;
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

    const payload = action.payload as unknown as MediaPopupPayload;

    const isVideoUrl =
      payload.url?.endsWith('.mp4') ||
      payload.url?.endsWith('.webm') ||
      payload.mediaType === 'video';

    const item: MediaPopupItem = {
      id: action.id,
      mediaType: isVideoUrl ? 'video' : 'image',
      url: payload.url || '',
      volume: payload.volume ?? 0.8,
      durationMs: payload.durationMs || 5000,
    };

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
          }}
        >
          {statusMessage}
        </div>
      )}

      {activePopup && (
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
