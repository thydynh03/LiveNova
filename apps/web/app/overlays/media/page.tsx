'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { OverlayAction, RuleActionType, MediaPopupPayload } from '@livenova/shared';
import { useOverlaySocket } from '../../../lib/use-overlay-socket';
import { useSpeechQueue } from '../../../lib/use-speech-queue';
import { Icon } from '../../../components/ui/Icon';

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

const ACCENT = '#e1274c';

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
    const event = action.event;

    // Substitute template placeholders in caption if any
    let caption = payload.caption || 'Cảm ơn {sender} đã tương tác!';
    caption = caption
      .replace(/\{sender\}/g, event.senderDisplayName || 'Người xem')
      .replace(/\{gift\}/g, event.giftName || 'Món quà')
      .replace(/\{coins\}/g, String(event.giftCoinValue || 1));

    const item: MediaPopupItem = {
      id: action.id,
      senderDisplayName: event.senderDisplayName,
      giftName: event.giftName,
      giftCoinValue: event.giftCoinValue,
      content: event.content,
      mediaType: payload.mediaType || 'image',
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

      {activePopup && (
        <div
          className="media-popup"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            padding: '1.5rem 2rem',
            borderRadius: '20px',
            background: 'rgba(10, 15, 20, 0.9)',
            border: `2px solid ${ACCENT}`,
            boxShadow: `0 0 40px rgba(225, 39, 76, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15)`,
            backdropFilter: 'blur(16px)',
            color: 'white',
            textAlign: 'center',
            maxWidth: '520px',
          }}
        >
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: ACCENT, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Icon name="gift" size={24} style={{ color: ACCENT }} />
            {activePopup.caption}
          </div>

          {activePopup.url && (
            activePopup.mediaType === 'video' ? (
              <video
                src={activePopup.url}
                autoPlay
                style={{
                  width: '100%',
                  maxHeight: '320px',
                  borderRadius: '14px',
                  objectFit: 'contain',
                }}
                ref={(el) => {
                  if (el) el.volume = activePopup.volume;
                }}
              />
            ) : (
              <img
                src={activePopup.url}
                alt="Popup effect"
                onError={(e) => {
                  // Fallback if image URL is unreachable
                  (e.target as HTMLImageElement).src = 'https://media.giphy.com/media/3o7TKrEzvLbsVAud8I/giphy.gif';
                }}
                style={{
                  width: '100%',
                  maxHeight: '320px',
                  borderRadius: '14px',
                  objectFit: 'contain',
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
