import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GUIDES, guideBySlug } from '../../../../lib/guides';
import { SITE_NAME, absoluteUrl } from '../../../../lib/site';

/**
 * Một bài hướng dẫn.
 *
 * Tĩnh hoàn toàn: `generateStaticParams` dựng sẵn mọi bài lúc build, nên trình
 * thu thập dữ liệu nhận HTML đầy đủ ngay ở phản hồi đầu tiên thay vì phải chạy
 * JavaScript rồi mới thấy nội dung.
 */

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const guide = guideBySlug(params.slug);
  if (!guide) return {};

  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/huong-dan/${guide.slug}` },
    openGraph: {
      type: 'article',
      title: guide.title,
      description: guide.description,
      url: `/huong-dan/${guide.slug}`,
    },
  };
}

/**
 * `HowTo` cho phần các bước, `FAQPage` cho phần hỏi đáp.
 *
 * Cả hai đều mô tả đúng nội dung đang hiển thị trên trang. Khai báo các bước
 * không có thật trong bài là thứ Google phát hiện được và phạt, chứ không phải
 * mẹo tăng hạng.
 */
function GuideJsonLd({ slug }: { slug: string }) {
  const guide = guideBySlug(slug);
  if (!guide) return null;

  const steps = guide.sections.flatMap((s) => s.steps ?? []);

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Article',
      headline: guide.title,
      description: guide.description,
      inLanguage: 'vi-VN',
      datePublished: guide.updated,
      dateModified: guide.updated,
      mainEntityOfPage: absoluteUrl(`/huong-dan/${guide.slug}`),
      publisher: { '@type': 'Organization', name: SITE_NAME, url: absoluteUrl('/') },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: 'Hướng dẫn', item: absoluteUrl('/huong-dan') },
        {
          '@type': 'ListItem',
          position: 3,
          name: guide.title,
          item: absoluteUrl(`/huong-dan/${guide.slug}`),
        },
      ],
    },
  ];

  if (steps.length > 0) {
    graph.push({
      '@type': 'HowTo',
      name: guide.title,
      description: guide.description,
      inLanguage: 'vi-VN',
      step: steps.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: s.name,
        text: s.text,
      })),
    });
  }

  if (guide.faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: guide.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }),
      }}
    />
  );
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = guideBySlug(params.slug);
  if (!guide) notFound();

  const others = GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 3);

  return (
    <>
      <GuideJsonLd slug={guide.slug} />

      <article
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: 'clamp(2rem, 5vw, 4rem) 1.5rem 4rem',
        }}
      >
        <nav style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1.5rem' }}>
          <Link href="/" style={{ color: 'inherit' }}>
            Trang chủ
          </Link>
          {' › '}
          <Link href="/huong-dan" style={{ color: 'inherit' }}>
            Hướng dẫn
          </Link>
        </nav>

        <h1
          style={{
            fontSize: 'clamp(1.85rem, 4.5vw, 2.75rem)',
            fontWeight: 800,
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            marginBottom: '0.75rem',
          }}
        >
          {guide.title}
        </h1>

        <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', marginBottom: '2rem' }}>
          {guide.readingMinutes} phút đọc · Cập nhật {guide.updated}
        </p>

        <p
          style={{
            fontSize: '1.15rem',
            lineHeight: 1.7,
            color: 'hsl(var(--foreground))',
            marginBottom: '2.5rem',
          }}
        >
          {guide.intro}
        </p>

        {guide.sections.map((section) => (
          <section key={section.heading} style={{ marginBottom: '2.5rem' }}>
            <h2
              style={{
                fontSize: 'clamp(1.3rem, 2.6vw, 1.6rem)',
                fontWeight: 700,
                marginBottom: '0.9rem',
                letterSpacing: '-0.01em',
              }}
            >
              {section.heading}
            </h2>

            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 40)} style={{ lineHeight: 1.75, marginBottom: '1rem' }}>
                {p}
              </p>
            ))}

            {section.steps && (
              <ol style={{ paddingLeft: '1.25rem', margin: '1.25rem 0', lineHeight: 1.7 }}>
                {section.steps.map((step) => (
                  <li key={step.name} style={{ marginBottom: '0.6rem' }}>
                    <strong>{step.name}.</strong> {step.text}
                  </li>
                ))}
              </ol>
            )}

            {section.note && (
              <p
                style={{
                  padding: '0.9rem 1.1rem',
                  borderLeft: '3px solid hsl(var(--primary))',
                  background: 'hsl(var(--accent-surface))',
                  borderRadius: '0 var(--radius) var(--radius) 0',
                  lineHeight: 1.65,
                  fontSize: '0.95rem',
                }}
              >
                {section.note}
              </p>
            )}
          </section>
        ))}

        <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: 'clamp(1.3rem, 2.6vw, 1.6rem)', fontWeight: 700, marginBottom: '1.1rem' }}>
            Câu hỏi thường gặp
          </h2>
          {guide.faq.map((f) => (
            <div key={f.q} style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.02rem', fontWeight: 700, marginBottom: '0.35rem' }}>{f.q}</h3>
              <p style={{ lineHeight: 1.7, color: 'hsl(var(--muted-foreground))' }}>{f.a}</p>
            </div>
          ))}
        </section>

        <div
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--card))',
            marginBottom: '3rem',
          }}
        >
          <p style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Thử trên buổi live của bạn</p>
          <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '1rem', lineHeight: 1.65 }}>
            Cấu hình một lần, chạy suốt buổi live. Overlay chạy thẳng trong OBS, không cần cài gì.
          </p>
          <Link
            href="/register"
            style={{
              display: 'inline-block',
              padding: '0.7rem 1.4rem',
              borderRadius: 'var(--radius)',
              background: 'hsl(var(--primary))',
              color: '#fff',
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Tạo tài khoản
          </Link>
        </div>

        {others.length > 0 && (
          <section>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.9rem' }}>Bài khác</h2>
            <ul style={{ listStyle: 'none', padding: 0, lineHeight: 1.9 }}>
              {others.map((g) => (
                <li key={g.slug}>
                  <Link href={`/huong-dan/${g.slug}`} style={{ color: 'hsl(var(--primary))' }}>
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </>
  );
}
