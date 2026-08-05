'use client';

import React from 'react';
import Link from 'next/link';
import { useApi } from '../../../lib/use-api';
import { LoadingState, ErrorState, EmptyState } from '../../../components/common/States';

interface CreditBalance {
  balance: number;
  dailyFreeUsed: number;
  resetsAt: string | null;
}

interface Rule {
  id: string;
  name: string;
  enabled: boolean;
}

interface Overlay {
  id: string;
  type: string;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="glass"
      style={{
        padding: '1.5rem',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--glass-border)',
      }}
    >
      {children}
    </div>
  );
}

export default function DashboardPage() {
  // Real data. This screen used to hard-code `setBalance(5420)` and a fake
  // "connected" indicator that flipped green after 1.5s regardless of state.
  const credits = useApi<CreditBalance>('/credits/balance');
  const rules = useApi<Rule[]>('/rules');
  const overlays = useApi<Overlay[]>('/overlays');

  const enabledRules = rules.data?.filter((r) => r.enabled).length ?? 0;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '2rem' }}>Tổng quan</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        <Card>
          <h2 style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))' }}>
            Số dư credit
          </h2>
          {credits.loading ? (
            <LoadingState label="" />
          ) : credits.error ? (
            <ErrorState message={credits.error} onRetry={credits.reload} />
          ) : (
            <>
              <p style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem' }}>
                {credits.data?.balance.toLocaleString('vi-VN') ?? 0}
              </p>
              {credits.data?.resetsAt && (
                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                  Làm mới lúc{' '}
                  {new Date(credits.data.resetsAt).toLocaleString('vi-VN')}
                </p>
              )}
            </>
          )}
        </Card>

        <Card>
          <h2 style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))' }}>
            Luật đang bật
          </h2>
          {rules.loading ? (
            <LoadingState label="" />
          ) : rules.error ? (
            <ErrorState message={rules.error} onRetry={rules.reload} />
          ) : (
            <p style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem' }}>
              {enabledRules}
              <span
                style={{
                  fontSize: '1rem',
                  fontWeight: 400,
                  color: 'hsl(var(--muted-foreground))',
                }}
              >
                {' '}
                / {rules.data?.length ?? 0}
              </span>
            </p>
          )}
        </Card>

        <Card>
          <h2 style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))' }}>Overlay</h2>
          {overlays.loading ? (
            <LoadingState label="" />
          ) : overlays.error ? (
            <ErrorState message={overlays.error} onRetry={overlays.reload} />
          ) : (
            <p style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem' }}>
              {overlays.data?.length ?? 0}
            </p>
          )}
        </Card>
      </div>

      {!rules.loading && !rules.error && (rules.data?.length ?? 0) === 0 && (
        <Card>
          <EmptyState
            title="Chưa có luật nào"
            description="Tạo luật đầu tiên để quà tặng kích hoạt video, ảnh hoặc giọng đọc trên sóng."
            action={
              <Link
                href="/rules"
                style={{
                  marginTop: '0.5rem',
                  padding: '0.6rem 1.25rem',
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: 'var(--radius)',
                  background: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  fontWeight: 600,
                }}
              >
                Tạo luật
              </Link>
            }
          />
        </Card>
      )}
    </div>
  );
}
