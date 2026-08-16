'use client';

import React from 'react';
import { Icon } from '../../ui/Icon';
import { Button, Card, Switch } from '../../ui/primitives';
import type { DiscoController } from '../use-disco-controller';

/**
 * Điều khiển camera và hiệu ứng sân khấu.
 *
 * Đây là những nút streamer bấm GIỮA buổi live, nên chúng ở tab vận hành, tách
 * hẳn khỏi khu kiểm thử — bấm nhầm một nút mô phỏng khi đang lên sóng thì khán
 * giả thấy một người xem không có thật.
 */

const SHOTS = [
  { id: 'DJ_POV', label: 'Góc nhìn DJ', hint: '9 giây' },
  { id: 'SPOTLIGHT_ZOOM', label: 'Zoom cận cảnh', hint: '5 giây' },
  { id: 'CRANE_SWOOP', label: 'Cần cẩu lia', hint: '6 giây' },
  { id: 'WIDE_ORBIT', label: 'Bay vòng toàn cảnh', hint: '8 giây' },
] as const;

const EFFECTS = [
  { id: 'smoke_blast', label: 'Xịt khói' },
  { id: 'confetti', label: 'Mưa hoa giấy' },
  { id: 'strobe', label: 'Đèn chớp' },
  { id: 'laser_show', label: 'Laser' },
  { id: 'firework_burst', label: 'Pháo hoa' },
] as const;

function ButtonGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '0.5rem',
      }}
    >
      {children}
    </div>
  );
}

export function DirectorPanel({ c }: { c: DiscoController }) {
  return (
    <>
      <Card
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Icon name="preview" size={18} /> Máy quay
          </span>
        }
      >
        <Switch
          checked={c.isAutoDirector}
          onChange={c.toggleAutoDirector}
          label="Đạo diễn tự động"
          hint="Tự đổi góc máy theo nhịp. Bấm một cú máy bên dưới sẽ tạm chiếm quyền trong vài giây."
        />

        <ButtonGrid>
          {SHOTS.map((shot) => (
            <Button key={shot.id} variant="secondary" onClick={() => c.camera(shot.id)} block>
              <span style={{ display: 'grid', textAlign: 'left', lineHeight: 1.25 }}>
                <span>{shot.label}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'hsl(var(--muted-foreground))' }}>
                  {shot.hint}
                </span>
              </span>
            </Button>
          ))}
        </ButtonGrid>
      </Card>

      <Card
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Icon name="spark" size={18} /> Hiệu ứng sân khấu
          </span>
        }
      >
        <ButtonGrid>
          {EFFECTS.map((fx) => (
            <Button key={fx.id} variant="secondary" onClick={() => c.effect(fx.id)} block>
              {fx.label}
            </Button>
          ))}
        </ButtonGrid>
      </Card>
    </>
  );
}
