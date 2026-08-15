'use client';

import React from 'react';
import { Icon } from '../../ui/Icon';
import { Button, Card, Field, Input } from '../../ui/primitives';
import type { DiscoController } from '../use-disco-controller';

/**
 * Link overlay và hướng dẫn đặt kích thước.
 *
 * Kích thước ở đây là hướng dẫn thật, không phải dòng gợi ý cho có: ô này trước
 * ghi "1920 × 1080" — đúng cho overlay ngang, sai hoàn toàn cho sàn nhảy dọc.
 * Streamer đặt nguồn theo con số đó rồi phải kéo giãn cho vừa khung TikTok, mà
 * kéo giãn thì phần mềm phát sóng phóng to ảnh đã render sẵn, và hình vỡ nét.
 */
export function OutputPanel({ c }: { c: DiscoController }) {
  return (
    <Card
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Icon name="link" size={18} /> Link gắn vào OBS / TikTok Live Studio
        </span>
      }
    >
      {/*
        Chọn khung hình.

        Trước đây chỉ có khung dọc, và cách duy nhất để lấy khung ngang là tự gõ
        `?ratio=16:9` vào cuối link — thứ không ai biết trừ khi đọc mã nguồn.
      */}
      <Field
        label="Khung hình"
        hint="Quyết định tỉ lệ và kích thước bạn cần đặt cho Browser Source."
      >
        {() => (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {c.frameOptions.map((opt) => (
              <Button
                key={opt.id}
                variant={c.ratio === opt.id ? 'primary' : 'secondary'}
                aria-pressed={c.ratio === opt.id}
                onClick={() => c.setRatio(opt.id)}
              >
                <span style={{ display: 'grid', textAlign: 'left', lineHeight: 1.25 }}>
                  <span>{opt.label}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.8 }}>
                    {opt.width} × {opt.height}
                  </span>
                </span>
              </Button>
            ))}
          </div>
        )}
      </Field>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.625rem',
          padding: '0.75rem',
          borderRadius: 'var(--radius-sm)',
          background: 'hsl(var(--accent-surface))',
          border: '1px solid hsl(var(--border))',
        }}
      >
        <Icon name="info" size={18} />
        <div style={{ fontSize: '0.8125rem', lineHeight: 1.55 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>
            Đặt Browser Source đúng{' '}
            <Button size="sm" variant="ghost" onClick={c.copySize} title="Chép kích thước"
              style={{
                fontFamily: 'monospace',
                fontWeight: 700,
                minHeight: 0,
                padding: '0.05rem 0.35rem',
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--background))',
                color: 'hsl(var(--primary))',
              }}
            >
              {c.frame.width} × {c.frame.height}
            </Button>{' '}
            — rồi <b>không kéo giãn</b>.
          </p>
          <p style={{ margin: '0.35rem 0 0', color: 'hsl(var(--muted-foreground))' }}>
            Sàn nhảy luôn vẽ ở đúng khung {c.frame.label.toLowerCase()} này. Kéo giãn nguồn
            sẽ phóng to ảnh đã vẽ và làm hình mờ đi. Đổi khung ở trên rồi chép lại link mới.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Input
          readOnly
          value={c.overlayUrl}
          onFocus={(e) => e.currentTarget.select()}
          style={{ flex: 1, minWidth: '260px', fontFamily: 'monospace', fontSize: '0.8125rem' }}
          aria-label="Link overlay sàn nhảy"
        />
        <Button variant="primary" onClick={c.copyUrl}>
          <Icon name={c.copied ? 'check' : 'copy'} size={16} />
          {c.copied ? 'Đã chép' : 'Chép link'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => window.open(c.overlayUrl, '_blank', 'noopener,noreferrer')}
        >
          <Icon name="preview" size={16} /> Mở tab mới
        </Button>
      </div>

      {!c.hasOverlay && (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
          Chưa có overlay nào trong tài khoản — link phía trên sẽ thiếu token và overlay
          trong OBS sẽ không nhận được sự kiện live.
        </p>
      )}
    </Card>
  );
}
