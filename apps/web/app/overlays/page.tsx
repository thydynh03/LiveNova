'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function OverlaysHubPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const overlays = [
    {
      id: 'media',
      name: '🎬 OBS Media & Gift Popup Overlay',
      description: 'Phát Video clip MP4/WEBM & Hiển thị Popup vinh danh avatar người tặng quà thời gian thực.',
      path: '/overlays/media',
    },
    {
      id: 'chat',
      name: '💬 OBS Transparent Live Chatbox',
      description: 'Bong bóng chat hiển thị bình luận thời gian thực cho OBS Studio với nền trong suốt.',
      path: '/overlays/chat',
    },
    {
      id: 'goal',
      name: '🎯 OBS Goal / Donation Progress Bar',
      description: 'Thanh tích lũy số quà/follower mục tiêu với hiệu ứng chúc mừng khi hoàn thành.',
      path: '/overlays/goal',
    },
    {
      id: 'pk',
      name: '⚔️ OBS Multi-Team PK Score Bar',
      description: 'Thanh so sánh điểm thi đấu PK 2 đến 8 đội thời gian thực.',
      path: '/overlays/pk',
    },
  ];

  const copyLink = (path: string, id: string) => {
    const fullUrl = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
        🎬 Danh Sách OBS Browser Source Overlays
      </h1>
      <p style={{ color: 'var(--muted-foreground)', marginBottom: '2.5rem' }}>
        Copy các đường link bên dưới và dán vào <strong>Browser Source</strong> trong OBS Studio để hiển thị hiệu ứng livestream.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {overlays.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '1.5rem',
              borderRadius: '16px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>{item.name}</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)', marginBottom: '1.5rem' }}>
                {item.description}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Link
                href={item.path}
                target="_blank"
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '0.65rem',
                  borderRadius: '8px',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                👁️ Xem Thử
              </Link>

              <button
                onClick={() => copyLink(item.path, item.id)}
                style={{
                  flex: 1.2,
                  padding: '0.65rem',
                  borderRadius: '8px',
                  background: copiedId === item.id ? '#10b981' : 'linear-gradient(135deg, #6366f1, #a855f7)',
                  color: 'white',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                {copiedId === item.id ? '✓ Đã Copy Link!' : '📋 Copy Link OBS'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
