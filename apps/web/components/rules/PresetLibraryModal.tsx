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
    id: 'vs-battle-game',
    title: '⚔️ Đấu trường Đặt Gạch (Ronaldo vs Messi)',
    description: 'Tặng Hoa hồng đặt gạch cho Ronaldo, tặng Galaxy đặt 5 gạch cho Messi vào sàn đấu!',
    badge: '🔥 Game Mới',
  },

  {
    id: 'blackout-troll',
    title: '🙈 Troll Streamer - Che Màn Hình 5s khi được Donate',
    description: 'Mỗi khi khán giả donate quà TikTok LIVE, màn hình live bị đen xì 5s gây ức chế cực hài!',
    badge: '🔥 Troll cực vui',
  },
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
  {
    id: 'game-dragon-comment',
    title: 'Bình luận Gọi Rồng (Đấu trường Game)',
    description: 'Khán giả gõ "rồng" sẽ thả Rồng vào trận địa.',
    badge: 'Đấu trường',
  },
  {
    id: 'game-meteor-like',
    title: 'Thả tim rơi Thiên Thạch (Đấu trường Game)',
    description: 'Mỗi mốc thả tim sẽ tự động giáng Thiên Thạch xuống sàn đấu.',
    badge: 'Đấu trường',
  },
  {
    id: 'stage-fireworks-biggift',
    title: 'Pháo hoa khi có quà lớn',
    description: 'Quà từ 500 xu trở lên thì bắn pháo hoa kèm lời cảm ơn.',
    badge: 'Sân khấu',
  },
  {
    id: 'stage-confetti-gift',
    title: 'Kim tuyến chào mỗi món quà',
    description: 'Rắc kim tuyến mỗi khi có người tặng quà, dù nhỏ.',
    badge: 'Sân khấu',
  },
  {
    id: 'stage-smoke-comment',
    title: 'Khói sân khấu theo lệnh chat',
    description: 'Ai bình luận “khói” thì sân khấu bốc khói.',
    badge: 'Sân khấu',
  },
  {
    id: 'stage-hype-comment',
    title: 'Hype theo lệnh chat',
    description: 'Ai bình luận “hype” hoặc “quẩy” thì sân khấu bùng lên.',
    badge: 'Sân khấu',
  },
  {
    id: 'stage-shake-comment',
    title: 'Rung màn hình theo lệnh chat',
    description: 'Ai bình luận “rung” thì cả khung hình rung lên.',
    badge: 'Sân khấu',
  },
  {
    id: 'stage-strobe-comment',
    title: 'Đèn nhấp nháy theo lệnh chat',
    description: 'Bật đèn sàn nhảy. Tần số đã giới hạn để an toàn cho người xem nhạy sáng.',
    badge: 'Sân khấu',
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
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: 'min(88vh, 760px)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid hsl(var(--border))',
          background: 'hsl(var(--card))',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
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
            flexShrink: 0,
            background: 'hsl(var(--card))',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'hsl(var(--foreground))' }}>
              <Icon name="spark" size={22} />
              Kho Mẫu Có Sẵn
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', margin: '0.25rem 0 0' }}>
              Chọn một mẫu là kích hoạt dùng được ngay. Bạn có thể tùy chỉnh lại theo ý thích sau.
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            style={{
              background: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'grid',
              placeItems: 'center',
              color: 'hsl(var(--muted-foreground))',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.875rem',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {error && (
            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius)', background: 'hsl(var(--destructive) / 0.12)', color: 'hsl(var(--destructive))', fontSize: '0.85rem', fontWeight: 600 }}>
              {error}
            </div>
          )}

          {PRESETS_LIST.map((p) => (
            <div
              key={p.id}
              style={{
                padding: '1rem 1.25rem',
                borderRadius: 'var(--radius)',
                background: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                transition: 'border-color 0.15s ease',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '0.95rem', color: 'hsl(var(--foreground))' }}>{p.title}</strong>
                  <span className="pill" style={{ fontSize: '0.7rem' }}>{p.badge}</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', margin: 0, lineHeight: 1.4 }}>
                  {p.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleApplyPreset(p.id)}
                disabled={applying !== null}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius)',
                  background: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: applying !== null ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                  opacity: applying === p.id ? 0.7 : 1,
                  boxShadow: '0 2px 8px hsl(var(--primary) / 0.25)',
                  flexShrink: 0,
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
