'use client';

import React from 'react';
import { Icon } from '../../../components/ui/Icon';

export default function BillingPage() {
  const packages = [
    { id: 1, name: 'Trải nghiệm', credits: 500, price: '50.000 ₫', popular: false },
    { id: 2, name: 'Streamer', credits: 2500, price: '200.000 ₫', popular: true },
    { id: 3, name: 'Studio', credits: 10000, price: '700.000 ₫', popular: false },
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1
        style={{
          fontSize: '2rem',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          marginBottom: '0.5rem',
        }}
      >
        Credit và thanh toán
      </h1>
      <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '2rem', maxWidth: '60ch' }}>
        Credit dùng cho giọng đọc tự động. Overlay, hiệu ứng quà và thanh mục tiêu
        không tốn credit.
      </p>

      {/* Balance: a plain panel, not a gradient card. The number is the subject. */}
      <section
        style={{
          padding: '1.5rem',
          borderRadius: 'var(--radius-lg)',
          background: 'hsl(var(--accent-surface))',
          border: '1px solid hsl(var(--primary) / 0.25)',
          marginBottom: '2.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.5rem',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>
            Số dư hiện tại
          </div>
          <div
            className="tabular"
            style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em' }}
          >
            1.250{' '}
            <span
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              credit
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>
            Tặng hằng ngày
          </div>
          <div
            className="tabular"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '1.05rem',
              fontWeight: 700,
              color: 'hsl(var(--primary))',
            }}
          >
            <Icon name="coins" size={18} weight="fill" />
            +100 / ngày
          </div>
        </div>
      </section>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem' }}>
        Chọn gói nạp
      </h2>
      <p
        style={{
          color: 'hsl(var(--muted-foreground))',
          fontSize: '0.9rem',
          marginBottom: '1.25rem',
        }}
      >
        Thanh toán qua VNPay, MoMo hoặc thẻ quốc tế.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.5rem',
          alignItems: 'stretch',
        }}
      >
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            style={{
              padding: '1.5rem',
              borderRadius: 'var(--radius-lg)',
              background: 'hsl(var(--card))',
              // The recommended tier is marked by the accent border and badge,
              // not by being taller than its neighbours.
              border: pkg.popular
                ? '1px solid hsl(var(--primary))'
                : '1px solid hsl(var(--border))',
              boxShadow: pkg.popular ? 'var(--shadow-md)' : 'none',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {pkg.popular && (
              <div
                style={{
                  position: 'absolute',
                  top: '-0.7rem',
                  right: '1rem',
                  background: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  padding: '0.15rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                PHỔ BIẾN
              </div>
            )}

            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              {pkg.name}
            </h3>
            <div
              className="tabular"
              style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.02em' }}
            >
              {pkg.credits.toLocaleString('vi-VN')}
            </div>
            <div
              style={{
                fontSize: '0.85rem',
                color: 'hsl(var(--muted-foreground))',
                marginBottom: '0.75rem',
              }}
            >
              credit
            </div>
            <div
              className="tabular"
              style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}
            >
              {pkg.price}
            </div>

            {/* Pushed to the bottom so every CTA lands on the same line. */}
            <button
              type="button"
              className={`btn ${pkg.popular ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', marginTop: 'auto' }}
            >
              <Icon name="billing" size={18} />
              Nạp ngay
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
