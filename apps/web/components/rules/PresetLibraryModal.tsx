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
    title: 'Cảm ơn khi có người tặng Hoa hồng',
    description: 'Ai tặng Hoa hồng là màn hình live hiện ngay lời cảm ơn.',
    badge: 'Hay dùng nhất',
  },
  {
    id: 'dragon-gift',
    title: 'Ăn mừng quà lớn',
    description: 'Quà từ 1.000 xu trở lên thì chạy hiệu ứng thật hoành tráng.',
    badge: 'Quà lớn',
  },
  {
    id: 'comment-welcome',
    title: 'Chào lại người mới vào',
    description: 'Ai nhắn “chào”, “hi”, “hello” thì LiveNova chào lại bằng giọng nói.',
    badge: 'Có giọng đọc',
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
      setError(err instanceof Error ? err.message : 'Không thêm được mẫu này, thử lại nhé');
      setApplying(null);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'hsl(20 8% 11% / 0.45)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '640px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid hsl(var(--border))',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid hsl(var(--border))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon name="spark" size={22} />
              Mẫu có sẵn
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.2rem' }}>
              Chọn một mẫu là chạy được ngay. Sửa lại câu chữ cho giống giọng bạn lúc nào cũng được.
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
            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius)', background: 'hsl(var(--destructive) / 0.08)', color: 'hsl(var(--destructive))', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          {PRESETS_LIST.map((p) => (
            <div
              key={p.id}
              style={{
                padding: '1.25rem',
                borderRadius: 'var(--radius)',
                background: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <strong style={{ fontSize: '1rem' }}>{p.title}</strong>
                  {/* One neutral badge style. The three presets used to be
                      rose, purple and blue, which read as three unrelated
                      products rather than three options in one list. */}
                  <span className="pill">{p.badge}</span>
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
                  color: 'hsl(var(--primary-foreground))',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: applying !== null ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  opacity: applying === p.id ? 0.7 : 1,
                }}
              >
                {applying === p.id ? 'Đang thêm…' : 'Dùng mẫu này'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
