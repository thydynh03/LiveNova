'use client';

import React, { useEffect, useState } from 'react';

type GiftEventPopup = {
  id: string;
  senderName: string;
  senderAvatar: string;
  giftName: string;
  giftIcon: string;
  coinValue: number;
  videoUrl?: string;
  imageUrl?: string;
};

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
        senderName: 'NguyenVanA',
        senderAvatar: 'https://api.dicebear.com/6.x/avataaars/svg?seed=streamer1',
        giftName: 'TikTok Cap 🧢',
        giftIcon: '🎁',
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
            borderRadius: '24px',
            background: 'rgba(15, 15, 25, 0.85)',
            border: '2px solid rgba(167, 139, 250, 0.5)',
            boxShadow: '0 0 40px rgba(167, 139, 250, 0.4), inset 0 0 20px rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(16px)',
            color: 'white',
            textAlign: 'center',
            maxWidth: '480px',
          }}
        >
          {/* Top Banner Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src={activePopup.senderAvatar}
              alt="avatar"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: '2px solid #a78bfa',
              }}
            />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f43f5e' }}>
                🎉 {activePopup.senderName}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                đã tặng <strong>{activePopup.giftName}</strong> ({activePopup.coinValue} 🪙)
              </div>
            </div>
          </div>

          {/* Media Video / Image Banner */}
          {activePopup.imageUrl && (
            <img
              src={activePopup.imageUrl}
              alt="Gift Media Popup"
              style={{
                width: '100%',
                maxHeight: '240px',
                objectFit: 'cover',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            />
          )}
        </div>
      ) : (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', fontFamily: 'sans-serif' }}>
          [ OBS Media & Gift Popup Overlay Active — Waiting for Gift Events ]
        </div>
      )}
    </div>
  );
}
