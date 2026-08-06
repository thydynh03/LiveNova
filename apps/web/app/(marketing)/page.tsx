import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Hero } from '../../components/marketing/Hero';
import { Reveal, RevealGroup, RevealItem } from '../../components/ui/motion-primitives';
import { Icon, type IconName } from '../../components/ui/Icon';
import { SITE_NAME, SITE_DESCRIPTION, absoluteUrl } from '../../lib/site';

export const metadata: Metadata = {
  title: 'Tự động hoá livestream TikTok',
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
};

interface Capability {
  icon: IconName;
  title: string;
  body: string;
}

/**
 * Four capabilities, deliberately not three.
 *
 * Three equal cards in a row is the single most recognisable AI layout. These
 * render as a two-by-two grid with the first tile spanning wider, so the row
 * has rhythm instead of repetition.
 */
const CAPABILITIES: Capability[] = [
  {
    icon: 'waveform',
    title: 'Đọc bình luận bằng giọng nói',
    body: 'Bình luận của người xem được đọc lên trong lúc bạn đang diễn, không cần rời mắt khỏi camera để dò khung chat.',
  },
  {
    icon: 'gift',
    title: 'Quà tặng kích hoạt hiệu ứng',
    body: 'Đặt luật: quà nào chạy video nào, hiện ảnh gì. Người tặng thấy phản hồi ngay trên sóng.',
  },
  {
    icon: 'broadcast',
    title: 'Overlay cắm thẳng vào OBS',
    body: 'Chatbox, thanh mục tiêu, bảng xếp hạng. Dán một đường link vào Browser Source là chạy.',
  },
  {
    icon: 'versus',
    title: 'Điều khiển OBS và game',
    body: 'Chuyển scene hoặc gửi lệnh vào game khi có quà, kèm giới hạn an toàn để không phá buổi chơi.',
  },
];

const STEPS = [
  {
    verb: 'Liên kết kênh',
    body: 'Dán tên kênh TikTok, xác minh quyền sở hữu bằng mã trong phần giới thiệu.',
  },
  {
    verb: 'Đặt luật',
    body: 'Chọn loại quà, ngưỡng coin, rồi chọn hành động: đọc tên, chạy video, đổi scene.',
  },
  {
    verb: 'Lên sóng',
    body: 'Dán URL overlay vào OBS. Từ đó buổi live tự phản hồi người xem.',
  },
];

const FAQ = [
  {
    q: 'Tôi có cần cài phần mềm không?',
    a: 'Overlay chạy thẳng trong OBS qua Browser Source, không cần cài gì. Ứng dụng máy tính chỉ cần khi bạn muốn phát âm thanh cục bộ hoặc gửi lệnh vào game.',
  },
  {
    q: 'Chi phí tính thế nào?',
    a: 'Mỗi ngày có một lượng credit miễn phí cho giọng đọc. Hết thì mua thêm. Hiệu ứng, overlay và thanh mục tiêu không tốn credit.',
  },
  {
    q: 'Hết credit thì buổi live có hỏng không?',
    a: 'Không. Chỉ phần đọc bằng giọng nói dừng lại. Overlay, hiệu ứng quà và bảng xếp hạng vẫn chạy bình thường.',
  },
  {
    q: 'Dữ liệu buổi live của tôi đi đâu?',
    a: 'Sự kiện live chỉ dùng để chạy luật bạn đặt. URL overlay mang mã bí mật riêng và bạn có thể xoay mã bất cứ lúc nào nếu lỡ để lộ trên sóng.',
  },
];

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
      <Hero />

      {/* Layout family 2: asymmetric tile grid, first tile wider. */}
      <section
        id="tinh-nang"
        style={{ padding: 'clamp(3rem, 7vw, 5.5rem) 1.5rem', maxWidth: '1200px', margin: '0 auto' }}
      >
        <Reveal>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 3.4vw, 2.5rem)',
              fontWeight: 700,
              marginBottom: '0.75rem',
            }}
          >
            Bạn làm được gì
          </h2>
          <p
            style={{
              color: 'hsl(var(--muted-foreground))',
              maxWidth: '55ch',
              marginBottom: '2.5rem',
            }}
          >
            Bốn thứ chạy suốt buổi live mà bạn không phải chạm tay vào.
          </p>
        </Reveal>

        <RevealGroup
          className="capability-grid"
          style={{ display: 'grid', gap: '1.25rem' }}
        >
          {CAPABILITIES.map((cap, i) => (
            <RevealItem key={cap.title} className={i === 0 ? 'capability-lead' : undefined}>
              <article
                className="capability-card"
                style={{
                  height: '100%',
                  padding: '1.75rem',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    padding: '0.6rem',
                    borderRadius: 'var(--radius)',
                    background: 'hsl(var(--accent-surface))',
                    color: 'hsl(var(--primary))',
                    marginBottom: '1rem',
                  }}
                >
                  <Icon name={cap.icon} size={22} weight="duotone" />
                </span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  {cap.title}
                </h3>
                <p
                  style={{
                    color: 'hsl(var(--muted-foreground))',
                    fontSize: '0.95rem',
                    maxWidth: '52ch',
                  }}
                >
                  {cap.body}
                </p>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* Layout family 3: numbered horizontal flow, not cards. */}
      <section
        style={{
          borderTop: '1px solid hsl(var(--border))',
          borderBottom: '1px solid hsl(var(--border))',
          background: 'hsl(var(--secondary) / 0.4)',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem',
          }}
        >
          <Reveal>
            <h2
              style={{
                fontSize: 'clamp(1.6rem, 3vw, 2.25rem)',
                fontWeight: 700,
                marginBottom: '2.5rem',
              }}
            >
              Ba bước để lên sóng
            </h2>
          </Reveal>

          <RevealGroup className="step-flow" style={{ display: 'grid', gap: '2rem' }}>
            {STEPS.map((step, i) => (
              <RevealItem key={step.verb}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <span
                    className="tabular"
                    aria-hidden="true"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem',
                      color: 'hsl(var(--primary))',
                      paddingTop: '0.3rem',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                      {step.verb}
                    </h3>
                    <p
                      style={{
                        color: 'hsl(var(--muted-foreground))',
                        fontSize: '0.95rem',
                        maxWidth: '40ch',
                      }}
                    >
                      {step.body}
                    </p>
                  </div>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* Layout family 4: two-column definition list, not an accordion. */}
      <section
        style={{ padding: 'clamp(3rem, 7vw, 5.5rem) 1.5rem', maxWidth: '1000px', margin: '0 auto' }}
      >
        <Reveal>
          <h2
            style={{
              fontSize: 'clamp(1.6rem, 3vw, 2.25rem)',
              fontWeight: 700,
              marginBottom: '2rem',
            }}
          >
            Câu hỏi thường gặp
          </h2>
        </Reveal>

        <RevealGroup className="faq-grid" style={{ display: 'grid', gap: '2rem 3rem' }}>
          {FAQ.map((item) => (
            <RevealItem key={item.q}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                {item.q}
              </h3>
              <p
                style={{
                  color: 'hsl(var(--muted-foreground))',
                  fontSize: '0.95rem',
                  maxWidth: '46ch',
                }}
              >
                {item.a}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* Layout family 5: full-width closing band. */}
      <section
        style={{
          borderTop: '1px solid hsl(var(--border))',
          padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem',
          textAlign: 'center',
        }}
      >
        <Reveal>
          <h2
            style={{
              fontSize: 'clamp(1.5rem, 3vw, 2.1rem)',
              fontWeight: 700,
              marginBottom: '1.25rem',
            }}
          >
            Buổi live tới, thử để máy lo phần còn lại
          </h2>
          <Link href="/register" className="btn btn-primary">
            Dùng thử miễn phí
            <Icon name="forward" size={18} />
          </Link>
        </Reveal>
      </section>

      <style>{`
        .capability-grid { grid-template-columns: 1fr; }
        .step-flow { grid-template-columns: 1fr; }
        .faq-grid { grid-template-columns: 1fr; }

        .capability-card { transition: border-color .2s ease, transform .2s cubic-bezier(.16,1,.3,1); }
        .capability-card:hover {
          border-color: hsl(var(--primary) / .5);
          transform: translateY(-3px);
        }
        @media (prefers-reduced-motion: reduce) {
          .capability-card:hover { transform: none; }
        }

        @media (min-width: 720px) {
          .capability-grid { grid-template-columns: repeat(2, 1fr); }
          .step-flow { grid-template-columns: repeat(3, 1fr); }
          .faq-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1024px) {
          .capability-grid { grid-template-columns: repeat(3, 1fr); }
          /* The lead tile spans two columns, so the row reads as a composition
             rather than three identical boxes. */
          .capability-lead { grid-column: span 2; }
        }
      `}</style>
    </>
  );
}
