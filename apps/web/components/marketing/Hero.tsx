'use client';

import React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { Icon } from '../ui/Icon';

/**
 * Asymmetric split hero: message left, live artefact right.
 *
 * The previous hero was centred text over a violet radial glow, which is the
 * layout every AI-generated landing page produces. Splitting it does two things
 * a centred stack cannot: it gives the value proposition a full measure to
 * read across, and it puts a concrete artefact of the product on screen instead
 * of asking the visitor to imagine one.
 *
 * The right-hand panel is a real component rendering real markup, not a
 * screenshot drawn out of styled divs pretending to be a product.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

const SAMPLE_EVENTS = [
  { icon: 'gift' as const, who: 'Ngọc Hân', what: 'Hoa hồng', meta: '1 coin' },
  { icon: 'comment' as const, who: 'Bảo Trâm', what: 'đọc tên em với', meta: '' },
  { icon: 'follow' as const, who: 'Minh Quân', what: 'vừa theo dõi', meta: '' },
  { icon: 'gift' as const, who: 'Tuấn Kiệt', what: 'Sư tử', meta: '29.999 coin' },
];

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section
      style={{
        position: 'relative',
        overflow: 'hidden',
        paddingTop: 'clamp(3rem, 8vw, 6rem)',
        paddingBottom: 'clamp(3rem, 8vw, 5rem)',
      }}
    >
      {/* Ambient wash, tinted with the accent rather than a violet blob. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(60rem 32rem at 78% 12%, hsl(var(--primary) / 0.13), transparent 62%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 1.5rem',
          display: 'grid',
          gap: 'clamp(2.5rem, 5vw, 4rem)',
          alignItems: 'center',
          gridTemplateColumns: 'var(--hero-cols, 1fr)',
        }}
        className="hero-grid"
      >
        <div>
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            style={{
              fontSize: 'clamp(2.25rem, 5.2vw, 3.75rem)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              marginBottom: '1.25rem',
            }}
          >
            Buổi live tự chạy,{' '}
            <span style={{ color: 'hsl(var(--primary))' }}>bạn chỉ việc diễn</span>
          </motion.h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
            style={{
              fontSize: '1.1rem',
              color: 'hsl(var(--muted-foreground))',
              maxWidth: '48ch',
              marginBottom: '2rem',
            }}
          >
            Bình luận được đọc lên, quà tặng kích hoạt hiệu ứng, overlay chạy sẵn
            trong OBS.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16, ease: EASE }}
            style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}
          >
            <Link href="/register" className="btn btn-primary">
              Dùng thử miễn phí
              <Icon name="forward" size={18} />
            </Link>
            <Link href="#tinh-nang" className="btn btn-secondary">
              Xem cách hoạt động
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
        >
          <LiveEventPanel reduce={Boolean(reduce)} />
        </motion.div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .hero-grid { --hero-cols: 1.05fr 0.95fr; }
        }
      `}</style>
    </section>
  );
}

/**
 * A real panel, built from the same tokens as the product.
 *
 * The rows animate in sequence because that is what the feed genuinely does
 * during a broadcast: events arrive one after another. The motion is the
 * product behaviour, not decoration.
 */
function LiveEventPanel({ reduce }: { reduce: boolean }) {
  return (
    <div
      className="glass"
      style={{
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          paddingBottom: '0.9rem',
          marginBottom: '0.9rem',
          borderBottom: '1px solid hsl(var(--border))',
        }}
      >
        <span className="live-dot" aria-hidden="true" />
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Đang phát</span>
        <span
          className="tabular"
          style={{
            marginLeft: 'auto',
            fontSize: '0.8rem',
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          1.284 người xem
        </span>
      </div>

      <ul style={{ listStyle: 'none', display: 'grid', gap: '0.5rem' }}>
        {SAMPLE_EVENTS.map((event, i) => (
          <motion.li
            key={event.who}
            initial={reduce ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.35 + i * 0.12, ease: EASE }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.7rem',
              padding: '0.65rem 0.75rem',
              borderRadius: 'var(--radius)',
              background: 'hsl(var(--muted) / 0.5)',
            }}
          >
            <Icon
              name={event.icon}
              size={18}
              weight="fill"
              style={{ color: 'hsl(var(--primary))' }}
            />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{event.who}</span>
            <span
              style={{
                fontSize: '0.9rem',
                color: 'hsl(var(--muted-foreground))',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {event.what}
            </span>
            {event.meta && (
              <span
                className="tabular"
                style={{
                  marginLeft: 'auto',
                  fontSize: '0.8rem',
                  color: 'hsl(var(--primary))',
                  fontWeight: 600,
                }}
              >
                {event.meta}
              </span>
            )}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
