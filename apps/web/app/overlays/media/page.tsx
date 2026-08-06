'use client';

import React, { useEffect, useState } from 'react';
import { Icon } from '../../../components/ui/Icon';

/**
 * Gift popup overlay, rendered inside an OBS browser source.
 *
 * Colours here are literal rather than theme tokens on purpose: this composites
 * over arbitrary video, so it must stay legible regardless of the operator's
 * light/dark preference in the dashboard.
 */

type GiftEventPopup = {
  id: string;
  senderName: string;
  senderAvatar: string;
  giftName: string;
  coinValue: number;
  videoUrl?: string;
  imageUrl?: string;
};

/** Same cyan as --primary on the dark theme, resolved to a literal. */
const ACCENT = '#22d3ee';

export default function MediaOverlay() {
  const [activePopup, setActivePopup] = useState<GiftEventPopup | null>(null);

  useEffect(() => {
    // Transparent background for OBS chromakey
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';

    // Demo popup trigger simulation for OBS testing
    const timer = setInterval(() => {
      setActivePopup({
        id: `gift_${Date.now()}`,
        senderName: 'Ngọc Hân',
        senderAvatar: 'https://api.dicebear.com/6.x/avataaars/svg?seed=streamer1',
        giftName: 'Mũ TikTok',
        coinValue: 99,
        imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80',
      });

      setTimeout(() => {
        setActivePopup(null);
      }, 5000);
    }, 9000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        boxSizing: 'border-box',
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

      {activePopup ? (
        <div
          className="media-popup"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
            padding: '1.5rem 2.5rem',
            borderRadius: '20px',
            background: 'rgba(10, 15, 20, 0.86)',
            border: `1px solid ${ACCENT}66`,
            boxShadow: `0 0 40px rgba(34, 211, 238, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.12)`,
            backdropFilter: 'blur(16px)',
            color: 'white',
            textAlign: 'center',
            maxWidth: '480px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src={activePopup.senderAvatar}
              alt={`Ảnh đại diện của ${activePopup.senderName}`}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: `2px solid ${ACCENT}`,
              }}
            />
            <div style={{ textAlign: 'left' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                }}
              >
                <Icon name="gift" size={20} weight="fill" style={{ color: ACCENT }} />
                {activePopup.senderName}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                đã tặng <strong>{activePopup.giftName}</strong>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    marginLeft: '0.4rem',
                    color: ACCENT,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <Icon name="coins" size={14} weight="fill" />
                  {activePopup.coinValue}
                </span>
              </div>
            </div>
          </div>

          {activePopup.imageUrl && (
            <img
              src={activePopup.imageUrl}
              alt={`Hiệu ứng kèm quà ${activePopup.giftName}`}
              style={{
                width: '100%',
                maxHeight: '240px',
                objectFit: 'cover',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.18)',
              }}
            />
          )}
        </div>
      ) : (
        <div
          style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: '0.9rem',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Overlay quà tặng đang chờ sự kiện.
        </div>
      )}
    </div>
  );
}
