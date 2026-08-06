'use client';

import React, { useMemo } from 'react';
import { useApi } from '../../../lib/use-api';
import { LoadingState, ErrorState } from '../../../components/common/States';
import { Icon } from '../../../components/ui/Icon';
import type { CreditBalance } from '../../../lib/types';

const nf = new Intl.NumberFormat('vi-VN');

type LedgerReason = 'PURCHASE' | 'TTS_SYNTHESIS' | 'DAILY_QUOTA' | 'REFUND' | 'ADMIN_ADJUST';

interface LedgerEntry {
  id: string;
  delta: number;
  reason: LedgerReason;
  description: string | null;
  balanceAfter: number;
  createdAt: string;
}

/**
 * Every row reads as a sentence about something that happened, not as a
 * transaction record. `description` from the server wins when it exists; the
 * fallback covers rows written before descriptions were populated.
 */
const REASON_PHRASE: Record<LedgerReason, string> = {
  PURCHASE: 'Bạn nạp thêm lượt đọc',
  TTS_SYNTHESIS: 'LiveNova đọc hộ bạn',
  DAILY_QUOTA: 'Lượt đọc tặng hằng ngày',
  REFUND: 'Hoàn lại lượt đọc',
  ADMIN_ADJUST: 'Điều chỉnh từ đội hỗ trợ',
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BillingPage() {
  const balance = useApi<CreditBalance>('/credits/balance');
  const ledger = useApi<LedgerEntry[]>('/credits/ledger?take=50');

  const entries = ledger.data ?? [];

  /**
   * "Đủ dùng khoảng bao lâu" from the user's own recent consumption rather than
   * a flat assumption. Only spend rows count, and only if there are enough of
   * them to mean anything — a projection from two data points is a guess
   * dressed up as a fact.
   */
  const daysLeft = useMemo(() => {
    const spends = entries.filter((e) => e.delta < 0);
    if (spends.length < 5 || !balance.data) return null;

    const newest = new Date(spends[0].createdAt).getTime();
    const oldest = new Date(spends[spends.length - 1].createdAt).getTime();
    const spanDays = (newest - oldest) / 86_400_000;
    if (!Number.isFinite(spanDays) || spanDays < 1) return null;

    const totalSpent = spends.reduce((sum, e) => sum + Math.abs(e.delta), 0);
    const perDay = totalSpent / spanDays;
    if (perDay <= 0) return null;

    return Math.floor(balance.data.balance / perDay);
  }, [entries, balance.data]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h1 className="page-title">Lượt đọc của bạn</h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>
          Mỗi câu LiveNova đọc hộ bạn tốn một lượt. Hiệu ứng màn hình và kịch bản thì không tốn gì.
        </p>
      </div>

      {balance.error && <ErrorState message={balance.error} onRetry={balance.reload} />}

      <section
        className="card"
        style={{
          background: 'hsl(var(--accent-surface))',
          borderColor: 'hsl(var(--primary) / 0.2)',
        }}
      >
        {balance.loading ? (
          <LoadingState label="Đang tải số dư…" />
        ) : (
          <>
            <p style={{ color: 'hsl(var(--muted-foreground))' }}>Bạn còn</p>
            <p
              className="mono"
              style={{ fontSize: '2.75rem', fontWeight: 700, lineHeight: 1.1, margin: '0.25rem 0' }}
            >
              {nf.format(balance.data?.balance ?? 0)}{' '}
              <span style={{ fontSize: '1.125rem', fontWeight: 600 }}>lượt đọc</span>
            </p>
            <p style={{ color: 'hsl(var(--muted-foreground))' }}>
              {daysLeft !== null
                ? `Với mức dùng gần đây, đủ khoảng ${daysLeft} ngày nữa.`
                : 'Dùng thêm vài buổi live nữa là chúng tôi ước lượng được bạn còn đủ bao lâu.'}
            </p>

            {balance.data?.resetsAt && (
              <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
                <Icon name="pending" size={16} style={{ verticalAlign: '-3px', marginRight: '0.35rem' }} />
                Lượt tặng hằng ngày làm mới lúc{' '}
                {new Date(balance.data.resetsAt).toLocaleString('vi-VN')}
                {balance.data.dailyFreeUsed > 0
                  ? ` · hôm nay đã dùng ${nf.format(balance.data.dailyFreeUsed)} lượt tặng`
                  : ''}
              </p>
            )}
          </>
        )}
      </section>

      {/*
        No top-up packages are shown.

        `POST /credits/purchase` was removed on purpose (C-01) — it minted
        credits straight from a request body — and the webhook-backed
        replacement is blocked on a Vietnamese payment entity. Drawing three
        price cards with a "Nạp ngay" button that cannot charge anyone would be
        a storefront that takes no money and grants no credit: worse than saying
        plainly that it is not open yet.
      */}
      <section className="card">
        <h2 className="section-title">Nạp thêm lượt đọc</h2>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginTop: '0.375rem' }}>
          Chúng tôi đang hoàn tất thủ tục thanh toán trong nước. Trong lúc chờ, bạn vẫn nhận lượt
          đọc tặng mỗi ngày. Cần thêm gấp thì nhắn cho đội hỗ trợ, chúng tôi cộng tay cho bạn.
        </p>
      </section>

      <section className="card">
        <h2 className="section-title" style={{ marginBottom: '0.75rem' }}>
          Lịch sử
        </h2>

        {ledger.loading && <LoadingState label="Đang tải lịch sử…" />}
        {ledger.error && <ErrorState message={ledger.error} onRetry={ledger.reload} />}

        {!ledger.loading && !ledger.error && entries.length === 0 && (
          <p style={{ color: 'hsl(var(--muted-foreground))' }}>
            Chưa có gì ở đây. Lịch sử sẽ hiện lên sau buổi live đầu tiên của bạn.
          </p>
        )}

        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {entries.map((entry) => {
            const positive = entry.delta > 0;
            return (
              <li
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.75rem 0',
                  borderBottom: '1px solid hsl(var(--border))',
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block' }}>
                    {entry.description || REASON_PHRASE[entry.reason] || 'Thay đổi lượt đọc'}
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
                    {formatWhen(entry.createdAt)}
                  </span>
                </span>
                <span style={{ textAlign: 'right', flex: 'none' }}>
                  <span
                    className="mono"
                    style={{
                      display: 'block',
                      fontWeight: 600,
                      color: positive ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))',
                    }}
                  >
                    {positive ? '+' : ''}
                    {nf.format(entry.delta)}
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}
                  >
                    còn {nf.format(entry.balanceAfter)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
