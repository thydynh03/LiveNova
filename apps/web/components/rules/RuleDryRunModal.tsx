'use client';

import React, { useState } from 'react';
import { Icon } from '../ui/Icon';
import { api } from '../../lib/api-client';

export interface RuleDryRunModalProps {
  rule: any;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--glass-border)',
  background: 'rgba(255, 255, 255, 0.05)',
  color: 'inherit',
  fontSize: '0.95rem',
  outline: 'none',
};

export function RuleDryRunModal({ rule, onClose }: RuleDryRunModalProps) {
  const [eventType, setEventType] = useState<string>(rule?.conditions?.eventType?.[0] || 'gift');
  const [senderUsername, setSenderUsername] = useState('nguoidung123');
  const [giftName, setGiftName] = useState(rule?.conditions?.giftName || 'Rose');
  const [giftCoinValue, setGiftCoinValue] = useState<number>(rule?.conditions?.minCoinValue || 1);
  const [content, setContent] = useState('Xin chào bạn, chúc livestream vui vẻ!');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRunTest(e: React.FormEvent) {
    e.preventDefault();
    setTesting(true);
    setResult(null);
    setError(null);

    try {
      const res = await api.post<any>(`/rules/${rule.id}/test`, {
        type: eventType,
        senderUsername,
        giftName: eventType === 'gift' ? giftName : undefined,
        giftCoinValue: eventType === 'gift' ? Number(giftCoinValue) : undefined,
        content: eventType === 'comment' ? content : undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chạy thử nghiệm thất bại');
    } finally {
      setTesting(false);
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
          maxWidth: '560px',
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
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon name="device" size={20} />
              Giả lập & Chạy thử Luật: {rule.name}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.2rem' }}>
              Kết quả sẽ hiển thị ngay lập tức trên OBS Overlay nếu đang mở!
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'hsl(var(--muted-foreground))', fontSize: '1.5rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleRunTest} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius)', background: 'rgba(239, 68, 68, 0.15)', color: 'hsl(var(--destructive))', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>Loại sự kiện giả lập</label>
              <select value={eventType} onChange={(e) => setEventType(e.target.value)} style={{ ...inputStyle, background: '#18181b' }}>
                <option value="gift">🎁 Quà tặng (Gift)</option>
                <option value="comment">💬 Bình luận (Comment)</option>
                <option value="like">❤️ Thả tim (Like)</option>
                <option value="follow">➕ Follow mới</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>Tên người gửi (Username)</label>
              <input type="text" value={senderUsername} onChange={(e) => setSenderUsername(e.target.value)} style={inputStyle} required />
            </div>
          </div>

          {eventType === 'gift' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>Tên quà tặng</label>
                <input type="text" value={giftName} onChange={(e) => setGiftName(e.target.value)} style={inputStyle} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>Số lượng Xu</label>
                <input type="number" min={1} value={giftCoinValue} onChange={(e) => setGiftCoinValue(parseInt(e.target.value, 10) || 1)} style={inputStyle} required />
              </div>
            </div>
          )}

          {eventType === 'comment' && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>Nội dung bình luận</label>
              <input type="text" value={content} onChange={(e) => setContent(e.target.value)} style={inputStyle} required />
            </div>
          )}

          <button
            type="submit"
            disabled={testing}
            style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius)',
              background: 'hsl(var(--primary))',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              cursor: testing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <Icon name="device" size={18} />
            {testing ? 'Đang kiểm tra kết quả...' : 'Bắt đầu Chạy thử (Dry-Run)'}
          </button>

          {/* Test Results Output */}
          {result && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '1.25rem',
                borderRadius: 'var(--radius)',
                background: result.match ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: result.match ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, color: result.match ? '#4ade80' : 'hsl(var(--destructive))', fontSize: '1rem' }}>
                  {result.match ? '✅ KHỚP ĐIỀU KIỆN! (SUCCESS)' : '❌ KHÔNG KHỚP ĐIỀU KIỆN'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                  Độ trễ: {result.latencyMs} ms · 0 Credit
                </span>
              </div>

              {result.match && (
                <div style={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))' }}>
                  <p style={{ fontWeight: '600', marginBottom: '0.3rem' }}>Đã kích hoạt {result.actionsTriggered?.length || 0} hành động:</p>
                  <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                    {result.actionsTriggered?.map((act: any, i: number) => (
                      <li key={i} style={{ marginBottom: '0.2rem' }}>
                        <strong>{act.type}</strong>: {JSON.stringify(act.payload)}
                      </li>
                    ))}
                  </ul>
                  <p style={{ fontSize: '0.8rem', color: '#4ade80', marginTop: '0.6rem', fontStyle: 'italic' }}>
                    💡 Đã phát tín hiệu hiển thị lên OBS Overlay!
                  </p>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
