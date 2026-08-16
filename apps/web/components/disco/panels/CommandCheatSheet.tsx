'use client';

import React from 'react';
import { Card } from '../../ui/primitives';

/**
 * Bảng lệnh để streamer đọc cho khán giả.
 *
 * Nội dung lấy đúng theo `interpretComment` trong `@livenova/shared` — nếu bộ
 * luật đổi thì bảng này phải đổi theo, nên hai bên được nhắc chéo bằng chú thích
 * ở cả hai file.
 */
const ROWS = [
  { keys: 'hey · 1 · join · vào · quẩy', effect: 'Rơi xuống sàn và bắt đầu nhảy' },
  { keys: '2 · jump · lên · bật', effect: 'Bật nhảy tại chỗ' },
  { keys: '3 · skin · đổi · change', effect: 'Đổi trang phục nhân vật' },
  { keys: '4 · walk · đi · dạo', effect: 'Đi dạo quanh sàn' },
] as const;

const GIFTS = [
  { name: 'Hoa hồng (Rose)', effect: 'Zoom cận cảnh 7 giây, +1 điểm' },
  { name: 'TikTok', effect: 'Đổi trang phục và bật nhảy, +1 điểm' },
  { name: 'Rosa', effect: 'Zoom cận cảnh kèm lời cảm ơn bằng giọng nói, +5 điểm' },
  { name: 'Pháo hoa giấy', effect: 'Đăng quang hạng nhất, lên bục giữa, +50 điểm' },
  { name: 'Quà khác', effect: 'Xếp hàng xử lý, điểm bằng số xu' },
] as const;

function Table({ head, rows }: { head: [string, string]; rows: readonly { a: string; b: string }[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '0.4rem 0.5rem',
                  borderBottom: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--muted-foreground))',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.a}>
              <td
                style={{
                  padding: '0.4rem 0.5rem',
                  borderBottom: '1px solid hsl(var(--border))',
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.a}
              </td>
              <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid hsl(var(--border))' }}>
                {r.b}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CommandCheatSheet() {
  return (
    <>
      <Card title="Lệnh cho khán giả">
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
          Khán giả phải gõ đúng một trong các lệnh dưới đây mới vào sàn. Comment tán gẫu
          bình thường không tạo nhân vật — nếu không sàn sẽ đầy người chỉ sau vài phút.
        </p>
        <Table head={['Gõ', 'Kết quả']} rows={ROWS.map((r) => ({ a: r.keys, b: r.effect }))} />
      </Card>

      <Card title="Quà tặng">
        <Table head={['Quà', 'Kết quả']} rows={GIFTS.map((g) => ({ a: g.name, b: g.effect }))} />
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
          Ghế DJ luôn thuộc về DJ LiveNova. Người dẫn đầu bảng quà đứng ở ô giữa bục vinh
          danh, không thay thế DJ.
        </p>
      </Card>
    </>
  );
}
