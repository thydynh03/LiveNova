'use client';

import React, { useState } from 'react';
import { Icon } from '../../../components/ui/Icon';

export default function TtsPage() {
  const [voice, setVoice] = useState('vi-VN-Wavenet-A');
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [testText, setTestText] = useState('Cảm ơn bạn đã theo dõi kênh livestream!');
  const [isPlaying, setIsPlaying] = useState(false);

  const handleTestSpeech = () => {
    setIsPlaying(true);
    setTimeout(() => setIsPlaying(false), 3000);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1
        style={{
          fontSize: '2rem',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          marginBottom: '0.5rem',
        }}
      >
        Giọng đọc tự động
      </h1>
      <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '2rem' }}>
        Tùy chỉnh giọng đọc tự động cho bình luận và thông báo nhận quà trên TikTok LIVE stream.
      </p>

      <div
        style={{
          display: 'grid',
          // Collapses on its own instead of forcing two columns onto a phone.
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2rem',
        }}
      >
        {/* Settings Card */}
        <div
          style={{
            padding: '1.5rem',
            borderRadius: '16px',
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
          }}
        >
          <h2
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '1.25rem',
              fontWeight: 700,
              marginBottom: '1.5rem',
            }}
          >
            <Icon name="settings" size={20} style={{ color: 'hsl(var(--primary))' }} />
            Cấu hình
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Chọn giọng đọc:
              </label>
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--border))',
                }}
              >
                <option value="vi-VN-Wavenet-A">Nữ 1 — Ban Mai (Standard Wavenet)</option>
                <option value="vi-VN-Wavenet-B">Nam 1 — Minh Quang (Standard Male)</option>
                <option value="vi-VN-Standard-A">Nữ 2 — Ngọan Ngào (Light Female)</option>
                <option value="vi-VN-Standard-B">Nam 2 — Trầm Ấm (Deep Male)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Tốc độ đọc ({speed}x):
              </label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Giọng điệu Pitch ({pitch}):
              </label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.1"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Test & Speech Queue Card */}
        <div
          style={{
            padding: '1.5rem',
            borderRadius: '16px',
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '1.25rem',
                fontWeight: 700,
                marginBottom: '1.5rem',
              }}
            >
              <Icon name="audio" size={20} style={{ color: 'hsl(var(--primary))' }} />
              Nghe thử
            </h2>
            <textarea
              rows={4}
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--border))',
                marginBottom: '1rem',
                resize: 'none',
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleTestSpeech}
            disabled={isPlaying}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            <Icon name={isPlaying ? 'audio' : 'play'} size={18} weight="fill" />
            {isPlaying ? 'Đang phát…' : 'Nghe thử'}
          </button>
        </div>
      </div>
    </div>
  );
}
