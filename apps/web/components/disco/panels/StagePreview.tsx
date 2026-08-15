'use client';

import React from 'react';
import DiscoStageView from '../DiscoStageView';
import { Badge } from '../../ui/primitives';
import type { DiscoController } from '../use-disco-controller';

/**
 * Bản xem trước sân khấu.
 *
 * Dính (sticky) trên màn rộng: streamer chỉnh nhạc hay bấm hiệu ứng thì phải
 * thấy kết quả ngay, không phải cuộn lên cuộn xuống. Trên màn hẹp nó nằm trên
 * cùng theo luồng bình thường vì không đủ chỗ cho hai cột.
 *
 * Tỉ lệ 9:16 khớp với khung overlay thật, nên thứ thấy ở đây là thứ khán giả
 * thấy — trước đây khung xem trước là hình vuông và không nói lên điều đó.
 */
export function StagePreview({ c }: { c: DiscoController }) {
  const connected = c.status === 'connected';

  return (
    <div style={{ position: 'sticky', top: '5rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '9 / 16',
          maxHeight: '68vh',
          margin: '0 auto',
          borderRadius: 'var(--radius)',
          border: '1px solid hsl(var(--border))',
          overflow: 'hidden',
          background: '#040308',
        }}
      >
        <DiscoStageView
          engine={c.engine}
          videoUrl={c.djVideoUrl}
          musicUrl={c.musicUrl}
          trackTitle={c.trackTitle}
          isMuted={c.isDjVideoMuted}
          ledDim={c.ledDim}
          enableAudio={false}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Badge tone={connected ? 'success' : 'warning'}>
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: connected ? 'hsl(var(--success))' : 'hsl(var(--warning))',
            }}
          />
          {connected ? 'Đang nhận sự kiện live' : `Kết nối: ${c.status}`}
        </Badge>

        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
          Xem trước — tiếng đã tắt tại đây, chỉ overlay mới phát tiếng
        </span>
      </div>

      {/* Trình phát ẩn: giữ nhạc chạy để chỉnh bài nghe được ngay tại dashboard
          nếu streamer muốn, dù mặc định sân khấu xem trước là im lặng. */}
      <audio ref={c.audioRef} loop style={{ display: 'none' }} />
    </div>
  );
}
