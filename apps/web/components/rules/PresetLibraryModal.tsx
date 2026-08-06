'use client';

import React, { useState } from 'react';
import { Icon } from '../ui/Icon';
import { api } from '../../lib/api-client';

export interface PresetLibraryModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const PRESETS_LIST = [
  {
    id: 'rose-popup',
    title: '🌹 Cảm ơn quà Rose (Hoa Hồng)',
    description: 'Tự động hiển thị ảnh/video popup cảm ơn mỗi khi người xem tặng 1 Hoa Hồng.',
    badge: 'Quà phổ biến',
    color: '#f43f5e',
  },
  {
    id: 'dragon-gift',
    title: '🐉 Siêu Popup Rồng Bay (> 1000 Xu)',
    description: 'Hiệu ứng hoành tráng dành riêng cho các món quà VIP có giá trị từ 1000 Xu trở lên.',
    badge: 'Siêu VIP',
    color: '#a855f7',
  },
  {
    id: 'comment-welcome',
    title: '💬 Tự động chào hỏi khi comment "chao"',
    description: 'Giọng đọc AI TTS tự động phát lời chào thân thiện khi viewer nhắn "chào", "hi", "hello".',
    badge: 'Bình luận AI',
    color: '#3b82f6',
  },
];

export function PresetLibraryModal({ onClose, onSuccess }: PresetLibraryModalProps) {
  const [applying, setApplying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApplyPreset(presetId: string) {
    setApplying(presetId);
    setError(null);

    try {
      await api.post(`/rules/presets/${presetId}`);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Áp dụng luật mẫu thất bại');
      setApplying(null);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        className="glass"
        style={{
          width: '100%',
          maxWidth: '640px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--glass-border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon name="spark" size={22} />
              Kho Luật Mẫu Sẵn (Preset Library)
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.2rem' }}>
              Thêm các luật tương tác phổ biến nhất vào kênh của bạn chỉ với 1 click.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'hsl(var(--muted-foreground))', fontSize: '1.5rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius)', background: 'rgba(239, 68, 68, 0.15)', color: 'hsl(var(--destructive))', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          {PRESETS_LIST.map((p) => (
            <div
              key={p.id}
              style={{
                padding: '1.25rem',
                borderRadius: 'var(--radius)',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <strong style={{ fontSize: '1rem' }}>{p.title}</strong>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      background: `${p.color}25`,
                      color: p.color,
                      border: `1px solid ${p.color}50`,
                    }}
                  >
                    {p.badge}
                  </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>{p.description}</p>
              </div>

              <button
                onClick={() => handleApplyPreset(p.id)}
                disabled={applying !== null}
                style={{
                  padding: '0.55rem 1.1rem',
                  borderRadius: 'var(--radius)',
                  background: 'hsl(var(--primary))',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: applying !== null ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  opacity: applying === p.id ? 0.7 : 1,
                }}
              >
                {applying === p.id ? 'Đang thêm...' : '+ Thêm luật này'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
