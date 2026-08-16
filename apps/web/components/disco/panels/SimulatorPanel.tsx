'use client';

import React from 'react';
import { Icon } from '../../ui/Icon';
import { Badge, Button, Card, Field, Input } from '../../ui/primitives';
import type { DiscoController } from '../use-disco-controller';

/**
 * Khu kiểm thử.
 *
 * Ở bản cũ khu này nằm xen giữa các thẻ điều khiển thật, nên streamer đang live
 * phải cuộn qua nó để tới thứ mình cần — và có thể bấm nhầm một nút mô phỏng.
 * Giờ nó ở tab riêng.
 */

const COMMANDS = [
  { content: 'hey', label: 'Vào sàn', log: '💬 gõ "hey" và vào sàn' },
  { content: '2', label: 'Bật nhảy', log: '🦘 gõ "2" và bật nhảy' },
  { content: '3', label: 'Đổi trang phục', log: '🎭 gõ "3" và đổi trang phục' },
  { content: '4', label: 'Đi dạo', log: '🚶 gõ "4" và đi dạo' },
] as const;

const GIFTS = [
  { name: 'Rose', coins: 1, label: 'Hoa hồng', log: '🌹 tặng Hoa Hồng' },
  { name: 'TikTok', coins: 1, label: 'TikTok', log: '🎵 tặng TikTok' },
  { name: 'Rosa', coins: 5, label: 'Rosa', log: '🌌 tặng Rosa' },
  { name: 'Pháo hoa giấy', coins: 100, label: 'Pháo hoa giấy', log: '🎊 tặng Pháo Hoa Giấy' },
  { name: 'Nước Ngọt', coins: 3, label: 'Quà thường', log: '🎁 tặng quà thường' },
] as const;

function ButtonGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '0.5rem',
      }}
    >
      {children}
    </div>
  );
}

export function SimulatorPanel({ c }: { c: DiscoController }) {
  const running = c.activeScenario !== null;

  return (
    <>
      <Card title="Khán giả giả lập">
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <Field label="Tên tài khoản" hint="Dùng làm mã định danh, giống senderUsername thật.">
            {(props) => (
              <Input {...props} value={c.testUsername} onChange={(e) => c.setTestUsername(e.target.value)} />
            )}
          </Field>
          <Field label="Tên hiển thị" hint="Chữ hiện trên huy hiệu của nhân vật.">
            {(props) => (
              <Input {...props} value={c.testDisplayName} onChange={(e) => c.setTestDisplayName(e.target.value)} />
            )}
          </Field>
        </div>

        <Field label="Lệnh nhanh" hint="Bắn qua đúng đường mà comment thật đi qua.">
          {() => (
            <ButtonGrid>
              {COMMANDS.map((cmd) => (
                <Button key={cmd.content} variant="secondary" onClick={() => c.simulateComment(cmd.content, cmd.log)} block>
                  {cmd.label}
                </Button>
              ))}
            </ButtonGrid>
          )}
        </Field>

        <Field
          label="Comment tự do"
          hint='Thử xem một câu bất kỳ có được hiểu là lệnh không. Câu tán gẫu sẽ không tạo nhân vật.'
        >
          {(props) => (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const text = c.customComment.trim();
                if (!text) return;
                c.simulateComment(text, `💬 "${text}"`);
                c.setCustomComment('');
              }}
              style={{ display: 'flex', gap: '0.5rem' }}
            >
              <Input
                {...props}
                value={c.customComment}
                onChange={(e) => c.setCustomComment(e.target.value)}
                placeholder='ví dụ: "vào nhảy" hoặc "stream hay quá"'
                style={{ flex: 1 }}
              />
              <Button type="submit" variant="primary">
                Gửi
              </Button>
            </form>
          )}
        </Field>

        <Field label="Quà tặng" hint="Mỗi nút đi qua đúng bộ luật quà mà buổi live dùng.">
          {() => (
            <ButtonGrid>
              {GIFTS.map((g) => (
                <Button key={g.name} variant="secondary" onClick={() => c.simulateGift(g.name, g.coins, g.log)} block>
                  {g.label}
                </Button>
              ))}
            </ButtonGrid>
          )}
        </Field>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button size="sm" variant="secondary" onClick={c.addRandomDancers}>
            <Icon name="users" size={14} /> Thêm 3 khán giả
          </Button>
          <Button size="sm" variant="danger" onClick={c.clearFloor}>
            <Icon name="trash" size={14} /> Dọn sàn
          </Button>
        </div>
      </Card>

      <Card
        title="Kịch bản dựng sẵn"
        actions={
          running ? (
            <Button size="sm" variant="danger" onClick={c.stopScenario}>
              Dừng
            </Button>
          ) : null
        }
      >
        <ButtonGrid>
          {c.scenarios.map((s) => (
            <Button
              key={s.id}
              variant={c.activeScenario === s.id ? 'primary' : 'secondary'}
              onClick={() => c.runScenario(s.id)}
              disabled={running && c.activeScenario !== s.id}
              block
            >
              <span style={{ display: 'grid', textAlign: 'left', lineHeight: 1.25 }}>
                <span>{s.label}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.75 }}>{s.hint}</span>
              </span>
            </Button>
          ))}
        </ButtonGrid>

        {running && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Badge tone="accent">
              Bước {c.stepIndex}/{c.totalSteps}
            </Badge>
            {/* Thanh tiến độ có `role="progressbar"`: người dùng trình đọc màn
                hình cũng cần biết kịch bản đang chạy tới đâu. */}
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={c.totalSteps}
              aria-valuenow={c.stepIndex}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 999,
                background: 'hsl(var(--secondary))',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${c.totalSteps ? (c.stepIndex / c.totalSteps) * 100 : 0}%`,
                  height: '100%',
                  background: 'hsl(var(--primary))',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}
      </Card>

      <Card title="Nhật ký">
        {c.logs.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
            Chưa có hoạt động nào. Bấm một nút phía trên để bắt đầu.
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              maxHeight: 260,
              overflowY: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
            }}
          >
            {c.logs.map((line, i) => (
              <li
                key={`${line}-${i}`}
                style={{
                  padding: '0.3rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: i === 0 ? 'hsl(var(--accent-surface))' : 'hsl(var(--secondary) / 0.5)',
                  color: 'hsl(var(--foreground))',
                }}
              >
                {line}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
