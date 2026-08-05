'use client';

import React from 'react';

export default function BillingPage() {
  const packages = [
    { id: 1, name: 'Gói Trải Nghiệm', credits: 500, price: '50.000 VNĐ', popular: false },
    { id: 2, name: 'Gói Streamer Chuyên Nghiệp', credits: 2500, price: '200.000 VNĐ', popular: true },
    { id: 3, name: 'Gói Doanh Nghiệp / Studio', credits: 10000, price: '700.000 VNĐ', popular: false },
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
        💳 Nạp Credit & Thanh Toán
      </h1>
      <p style={{ color: 'var(--muted-foreground)', marginBottom: '2rem' }}>
        Nạp thêm Credit để sử dụng tính năng đọc giọng đọc TTS và quản lý lịch sử biến động số dư.
      </p>

      {/* Credit balance overview */}
      <div
        style={{
          padding: '1.5rem',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))',
          border: '1px solid rgba(167, 139, 250, 0.3)',
          marginBottom: '2.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)' }}>Số dư hiện tại</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#a78bfa' }}>
            1,250 <span style={{ fontSize: '1.2rem', color: 'var(--foreground)' }}>Credits</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>Quota miễn phí hàng ngày</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>+100 Credits / ngày</div>
        </div>
      </div>

      {/* Packages Grid */}
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>
        💎 Chọn Gói Nạp Credit (VNPay / MoMo / Stripe)
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            style={{
              padding: '1.5rem',
              borderRadius: '16px',
              background: 'var(--card)',
              border: pkg.popular ? '2px solid #a78bfa' : '1px solid var(--border)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {pkg.popular && (
              <div
                style={{
                  position: 'absolute',
                  top: '-12px',
                  right: '16px',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: '12px',
                }}
              >
                PHỔ BIẾN NHẤT
              </div>
            )}
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>{pkg.name}</h3>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--foreground)', marginBottom: '0.5rem' }}>
                {pkg.credits.toLocaleString()} <span style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)' }}>Credits</span>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981', marginBottom: '1.5rem' }}>
                {pkg.price}
              </div>
            </div>

            <button
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                background: pkg.popular
                  ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)'
                  : 'var(--background)',
                color: pkg.popular ? 'white' : 'var(--foreground)',
                border: pkg.popular ? 'none' : '1px solid var(--border)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Nạp Ngay
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
