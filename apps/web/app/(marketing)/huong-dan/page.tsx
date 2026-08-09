import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { GUIDES } from '../../../lib/guides';

/**
 * Trang danh sách hướng dẫn.
 *
 * Tồn tại vì hai lý do, và cả hai đều thật: người đọc cần một chỗ để xem còn
 * bài nào khác, và các bài cần được liên kết từ một trang nội bộ — một trang
 * chỉ nằm trong sitemap mà không được liên kết từ đâu cả thì Google coi là ít
 * quan trọng.
 */

export const metadata: Metadata = {
  title: 'Hướng dẫn live TikTok',
  description:
    'Hướng dẫn thực hành cho streamer TikTok: đọc bình luận bằng giọng nói, hiệu ứng quà tặng, overlay OBS khổ dọc và trò chơi tương tác trên sóng.',
  alternates: { canonical: '/huong-dan' },
};

export default function GuidesIndexPage() {
  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: 'clamp(2rem, 5vw, 4rem) 1.5rem 4rem' }}>
      <h1
        style={{
          fontSize: 'clamp(1.9rem, 4.5vw, 2.75rem)',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          marginBottom: '0.75rem',
        }}
      >
        Hướng dẫn
      </h1>
      <p
        style={{
          fontSize: '1.1rem',
          color: 'hsl(var(--muted-foreground))',
          lineHeight: 1.7,
          marginBottom: '2.5rem',
          maxWidth: '58ch',
        }}
      >
        Những thứ cần biết trước khi lên sóng, viết theo đúng thứ tự bạn sẽ gặp chúng.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '1rem' }}>
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/huong-dan/${g.slug}`}
              style={{
                display: 'block',
                padding: '1.35rem 1.5rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--card))',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <h2 style={{ fontSize: '1.12rem', fontWeight: 700, marginBottom: '0.4rem' }}>{g.title}</h2>
              <p
                style={{
                  color: 'hsl(var(--muted-foreground))',
                  lineHeight: 1.65,
                  fontSize: '0.95rem',
                  marginBottom: '0.5rem',
                }}
              >
                {g.description}
              </p>
              <span style={{ fontSize: '0.82rem', color: 'hsl(var(--muted-foreground))' }}>
                {g.readingMinutes} phút đọc
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
