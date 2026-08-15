'use client';

import React from 'react';
import Link from 'next/link';
import { Icon } from '../ui/Icon';
import { Badge, Card } from '../ui/primitives';

/**
 * Ba bước đầu tiên.
 *
 * Người dùng mới trước đây vào thẳng dashboard với mọi ô số bằng 0 và không có
 * gì chỉ ra phải làm gì trước. Ba bước này là con đường ngắn nhất từ tài khoản
 * trống tới một overlay đang chạy trên sóng, và tự biến mất khi xong.
 */

export interface OnboardingStep {
  id: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  done: boolean;
}

export function buildOnboardingSteps({
  hasChannel,
  hasOverlay,
  hasRule,
}: {
  hasChannel: boolean;
  hasOverlay: boolean;
  hasRule: boolean;
}): OnboardingStep[] {
  return [
    {
      id: 'channel',
      title: 'Liên kết kênh TikTok',
      detail: 'Để LiveNova nhận được bình luận và quà tặng từ buổi live của bạn.',
      href: '/channels',
      cta: 'Liên kết kênh',
      done: hasChannel,
    },
    {
      id: 'overlay',
      title: 'Tạo một overlay',
      detail: 'Overlay là lớp hình sẽ hiện lên sóng — sàn nhảy, thanh mục tiêu, hiệu ứng quà.',
      href: '/overlays',
      cta: 'Tạo overlay',
      done: hasOverlay,
    },
    {
      id: 'rule',
      title: 'Đặt kịch bản đầu tiên',
      detail: 'Quyết định điều gì xảy ra khi có người tặng quà hay gõ một lệnh trong chat.',
      href: '/rules',
      cta: 'Tạo kịch bản',
      done: hasRule,
    },
  ];
}

export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;

  // Xong hết thì biến mất hẳn: một danh sách toàn dấu tích chỉ chiếm chỗ của
  // những con số mà người dùng quen thuộc mới thực sự cần.
  if (doneCount === steps.length) return null;

  return (
    <Card
      title="Bắt đầu với LiveNova"
      actions={<Badge tone="accent">{doneCount}/{steps.length} bước</Badge>}
    >
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {steps.map((step, index) => (
          <li
            key={step.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid hsl(var(--border))',
              background: step.done ? 'transparent' : 'hsl(var(--card))',
              opacity: step.done ? 0.6 : 1,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flex: 'none',
                width: 26,
                height: 26,
                display: 'grid',
                placeItems: 'center',
                borderRadius: '50%',
                fontSize: '0.8125rem',
                fontWeight: 700,
                background: step.done ? 'hsl(var(--success))' : 'hsl(var(--secondary))',
                color: step.done ? 'hsl(var(--success-foreground))' : 'hsl(var(--secondary-foreground))',
              }}
            >
              {step.done ? '✓' : index + 1}
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem' }}>
                {step.title}
                {step.done && <span className="ln-visually-hidden"> — đã xong</span>}
              </p>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
                {step.detail}
              </p>
            </div>

            {!step.done && (
              <Link
                href={step.href}
                style={{
                  flex: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  minHeight: 34,
                  padding: '0.3rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {step.cta} <Icon name="forward" size={14} />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
