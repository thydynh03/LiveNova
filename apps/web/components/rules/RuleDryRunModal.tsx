'use client';

import React, { useState } from 'react';
import { Icon } from '../ui/Icon';
import { api } from '../../lib/api-client';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface RuleDryRunModalProps {
  rule: any;
  onClose: () => void;
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.375rem',
  fontWeight: 600,
  fontSize: '0.875rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '44px',
  padding: '0.625rem 0.875rem',
  borderRadius: 'var(--radius)',
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--background))',
  color: 'inherit',
  font: 'inherit',
  fontSize: '0.9375rem',
};

const EVENT_OPTIONS = [
  { value: 'gift', label: 'Có người tặng quà' },
  { value: 'comment', label: 'Có người bình luận' },
  { value: 'like', label: 'Có người thả tim' },
  { value: 'follow', label: 'Có người theo dõi mới' },
];

/**
 * What the viewer would actually get.
 *
 * The previous version printed `JSON.stringify(act.payload)`, which is a
 * developer's answer to "did it work?". A creator needs to see the sentence
 * that will be read aloud and the media that will appear — those are the things
 * they are checking before they go live.
 */
function ActionPreview({ action }: { action: any }) {
  const payload = action?.payload ?? {};

  if (action?.type === 'tts_read') {
    const text = payload.text ?? payload.content ?? '';
    return (
      <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
        <span
          aria-hidden="true"
          style={{
            width: 32,
            height: 32,
            flex: 'none',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 999,
            background: 'hsl(var(--accent-surface))',
            color: 'hsl(var(--primary))',
          }}
        >
          <Icon name="audio" size={18} />
        </span>
        <span>
          <span style={{ display: 'block', fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
            Sẽ đọc thành tiếng:
          </span>
          <span
            style={{
              display: 'inline-block',
              marginTop: '0.25rem',
              padding: '0.5rem 0.875rem',
              borderRadius: '14px 14px 14px 4px',
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
            }}
          >
            {text || <em style={{ color: 'hsl(var(--muted-foreground))' }}>(câu đọc đang để trống)</em>}
          </span>
        </span>
      </div>
    );
  }

  if (action?.type === 'media_popup') {
    return (
      <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
        <span
          aria-hidden="true"
          style={{
            width: 32,
            height: 32,
            flex: 'none',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 999,
            background: 'hsl(var(--accent-surface))',
            color: 'hsl(var(--primary))',
          }}
        >
          <Icon name="preview" size={18} />
        </span>
        <span>
          <span style={{ display: 'block', fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
            Sẽ hiện lên màn hình live:
          </span>
          <strong>{payload.name ?? payload.url ?? 'Video/ảnh đã chọn'}</strong>
        </span>
      </div>
    );
  }

  return (
    <div style={{ fontSize: '0.9375rem' }}>
      <strong>{action?.type}</strong>
    </div>
  );
}

export function RuleDryRunModal({ rule, onClose }: RuleDryRunModalProps) {
  const [eventType, setEventType] = useState<string>(rule?.conditions?.eventType?.[0] || 'gift');
  const [senderUsername, setSenderUsername] = useState('');
  const [giftName, setGiftName] = useState(rule?.conditions?.giftName || '');
  const [giftCoinValue, setGiftCoinValue] = useState<number>(rule?.conditions?.minCoinValue || 1);
  const [content, setContent] = useState('');
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
      setError(err instanceof Error ? err.message : 'Không chạy thử được, thử lại nhé');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Thử trước kịch bản ${rule.name}`}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'hsl(20 8% 11% / 0.45)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        overflowY: 'auto',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: 0,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid hsl(var(--border))',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <h2 className="section-title">Thử trước: {rule.name}</h2>
            <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.125rem' }}>
              Giả vờ có một khán giả vừa làm điều gì đó, xem kịch bản có chạy không. Không tốn lượt đọc.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            style={{
              background: 'none',
              border: 'none',
              color: 'hsl(var(--muted-foreground))',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
            }}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <form
          onSubmit={handleRunTest}
          style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          {error && (
            <div
              role="alert"
              style={{
                padding: '0.75rem 0.875rem',
                borderRadius: 'var(--radius)',
                background: 'hsl(var(--destructive) / 0.08)',
                border: '1px solid hsl(var(--destructive) / 0.3)',
                color: 'hsl(var(--destructive))',
                fontSize: '0.9375rem',
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="dryrun-event" style={labelStyle}>
              Chuyện gì vừa xảy ra?
            </label>
            <select
              id="dryrun-event"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              style={inputStyle}
            >
              {EVENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="dryrun-sender" style={labelStyle}>
              Tên người xem
            </label>
            <input
              id="dryrun-sender"
              type="text"
              value={senderUsername}
              onChange={(e) => setSenderUsername(e.target.value)}
              placeholder="Ví dụ: Minh Anh"
              style={inputStyle}
              required
            />
          </div>

          {eventType === 'gift' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label htmlFor="dryrun-gift" style={labelStyle}>
                  Tặng quà gì
                </label>
                <input
                  id="dryrun-gift"
                  type="text"
                  value={giftName}
                  onChange={(e) => setGiftName(e.target.value)}
                  placeholder="Ví dụ: Hoa hồng"
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label htmlFor="dryrun-coins" style={labelStyle}>
                  Trị giá bao nhiêu xu
                </label>
                <input
                  id="dryrun-coins"
                  type="number"
                  min={1}
                  value={giftCoinValue}
                  onChange={(e) => setGiftCoinValue(parseInt(e.target.value, 10) || 1)}
                  style={inputStyle}
                  required
                />
              </div>
            </div>
          )}

          {eventType === 'comment' && (
            <div>
              <label htmlFor="dryrun-content" style={labelStyle}>
                Họ bình luận gì
              </label>
              <input
                id="dryrun-content"
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Ví dụ: Chị ơi cái này còn hàng không ạ"
                style={inputStyle}
                required
              />
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={testing}>
            {testing ? 'Đang thử…' : 'Thử ngay'}
          </button>

          {result && (
            <div
              aria-live="polite"
              style={{
                padding: '1.125rem',
                borderRadius: 'var(--radius)',
                background: result.match
                  ? 'hsl(var(--success) / 0.07)'
                  : 'hsl(var(--muted) / 0.6)',
                border: `1px solid ${
                  result.match ? 'hsl(var(--success) / 0.3)' : 'hsl(var(--border))'
                }`,
              }}
            >
              <p
                style={{
                  fontWeight: 600,
                  color: result.match ? 'hsl(var(--success))' : 'hsl(var(--foreground))',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Icon name={result.match ? 'check' : 'info'} size={18} weight="bold" />
                {result.match
                  ? 'Kịch bản có chạy với tình huống này'
                  : 'Kịch bản sẽ không chạy với tình huống này'}
              </p>

              {result.match ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.875rem',
                    marginTop: '0.875rem',
                  }}
                >
                  {(result.actionsTriggered ?? []).map((act: any, i: number) => (
                    <ActionPreview key={i} action={act} />
                  ))}
                  <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
                    Nếu OBS đang mở, hiệu ứng vừa hiện lên đó luôn.
                  </p>
                </div>
              ) : (
                <p
                  style={{
                    fontSize: '0.9375rem',
                    color: 'hsl(var(--muted-foreground))',
                    marginTop: '0.5rem',
                  }}
                >
                  Tình huống bạn vừa thử không thoả điều kiện của kịch bản. Bấm “Sửa” để nới điều
                  kiện, hoặc thử lại với giá trị khác.
                </p>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
