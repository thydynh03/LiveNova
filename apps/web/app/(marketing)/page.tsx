import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SITE_NAME, SITE_DESCRIPTION, absoluteUrl } from '../../lib/site';

export const metadata: Metadata = {
  title: 'Tự động hoá livestream TikTok',
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
};

const FEATURES = [
  {
    title: 'Đọc bình luận bằng giọng nói',
    body: 'Bình luận của người xem được đọc lên trong lúc bạn đang diễn, không cần rời mắt khỏi camera để theo dõi khung chat.',
  },
  {
    title: 'Quà tặng kích hoạt hiệu ứng',
    body: 'Đặt luật: quà nào thì chạy video nào, hiện ảnh gì, phát âm thanh ra sao. Người tặng thấy ngay phản hồi trên sóng.',
  },
  {
    title: 'Overlay cho OBS',
    body: 'Chatbox, thanh mục tiêu, bảng xếp hạng — dán một đường link vào Browser Source là chạy, không cài thêm gì.',
  },
  {
    title: 'Điều khiển OBS và game',
    body: 'Chuyển scene, bật tắt nguồn, hoặc gửi lệnh vào game khi có quà — kèm giới hạn an toàn để không phá buổi chơi.',
  },
];

const FAQ = [
  {
    q: 'Tôi có cần cài phần mềm không?',
    a: 'Overlay chạy thẳng trong OBS qua Browser Source, không cần cài gì. Ứng dụng máy tính chỉ cần khi bạn muốn phát âm thanh cục bộ hoặc điều khiển game.',
  },
  {
    q: 'Chi phí tính thế nào?',
    a: 'Mỗi ngày có một lượng credit miễn phí để dùng giọng đọc. Hết thì mua thêm. Hiệu ứng, overlay và thanh mục tiêu không tốn credit.',
  },
  {
    q: 'Hết credit thì buổi live có hỏng không?',
    a: 'Không. Chỉ phần đọc bằng giọng nói dừng lại; overlay, hiệu ứng quà và bảng xếp hạng vẫn chạy bình thường.',
  },
];

/**
 * JSON-LD for rich results.
 *
 * The audited competitor had years of demo videos, two communities and two
 * published apps, and expressed none of it as structured data — forfeiting rich
 * results entirely. Cheap to add, and only worth adding once the claims are
 * true, so pricing is described qualitatively rather than invented (Q-04).
 */
function StructuredData() {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': absoluteUrl('/#organization'),
        name: SITE_NAME,
        url: absoluteUrl('/'),
        description: SITE_DESCRIPTION,
      },
      {
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Windows, Web',
        description: SITE_DESCRIPTION,
        inLanguage: 'vi-VN',
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default function LandingPage() {
  return (
    <>
      <StructuredData />

      {/* One h1, then h2 per section: the audited site skipped from h1 to h3 and
          spent an h2 on a login prompt. */}
      <section
        style={{
          padding: '6rem 1.5rem 4rem',
          textAlign: 'center',
          background: 'radial-gradient(circle at top, hsl(var(--primary) / 0.12), transparent 55%)',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(2.25rem, 6vw, 3.75rem)',
            fontWeight: 800,
            lineHeight: 1.15,
            marginBottom: '1rem',
          }}
        >
          Tự động hoá <span className="text-gradient">livestream TikTok</span>
        </h1>

        <p
          style={{
            fontSize: '1.15rem',
            color: 'hsl(var(--muted-foreground))',
            maxWidth: '46ch',
            margin: '0 auto 2rem',
            lineHeight: 1.6,
          }}
        >
          Bình luận được đọc lên, quà tặng kích hoạt hiệu ứng, overlay chạy sẵn
          trong OBS. Bạn tập trung vào buổi diễn, phần còn lại để máy lo.
        </p>

        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/login"
            className="btn"
            style={{
              padding: '0.85rem 2rem',
              borderRadius: 'var(--radius)',
              background: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Bắt đầu
          </Link>
          <Link
            href="#tinh-nang"
            className="btn"
            style={{
              padding: '0.85rem 2rem',
              borderRadius: 'var(--radius)',
              border: '1px solid hsl(var(--border))',
              color: 'hsl(var(--foreground))',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Xem tính năng
          </Link>
        </div>
      </section>

      <section id="tinh-nang" style={{ padding: '3rem 1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '2rem' }}>
          Bạn làm được gì
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="glass"
              style={{
                padding: '1.5rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                {feature.title}
              </h3>
              <p
                style={{
                  color: 'hsl(var(--muted-foreground))',
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                }}
              >
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section style={{ padding: '3rem 1.5rem 5rem', maxWidth: '760px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem' }}>
          Câu hỏi thường gặp
        </h2>

        <dl style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt style={{ fontWeight: 700, marginBottom: '0.35rem' }}>{item.q}</dt>
              <dd
                style={{
                  margin: 0,
                  color: 'hsl(var(--muted-foreground))',
                  lineHeight: 1.6,
                }}
              >
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
