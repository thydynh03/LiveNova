'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LiveEvent, LiveEventType } from '@livenova/shared';
import { useApi } from '../../../lib/use-api';
import { useEventsSocket } from '../../../lib/use-events-socket';
import { LiveFeed, LIVE_FEED_LIMIT } from '../../../components/live-feed/LiveFeed';
import { ErrorState } from '../../../components/common/States';
import { Icon, type IconName } from '../../../components/ui/Icon';
import type { CreditBalance, Rule, Overlay, Channel } from '../../../lib/types';

const nf = new Intl.NumberFormat('vi-VN');

/**
 * Elapsed time since the stream started.
 *
 * Ticks in the client rather than being fetched: the server has no
 * session-duration endpoint, and polling one per second for a number the client
 * can derive from a single timestamp would be wasteful.
 */
function useElapsed(since: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!since) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [since]);

  if (!since) return null;
  const start = new Date(since).getTime();
  if (Number.isNaN(start)) return null;

  const total = Math.max(0, Math.floor((now - start) / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/**
 * A number with a sentence under it, not a number with an unlabelled sparkline.
 * The previous version showed deltas against data the API does not return, so
 * the trend line was decoration.
 */
function StatCard({
  label,
  value,
  hint,
  href,
  loading,
}: {
  label: string;
  value: string;
  hint: string;
  href?: string;
  loading?: boolean;
}) {
  const body = (
    <div className="card" style={{ padding: '1.25rem', height: '100%' }}>
      <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>{label}</p>
      {loading ? (
        <div className="skeleton" style={{ height: '2.5rem', width: '60%', margin: '0.5rem 0' }} />
      ) : (
        <p
          className="mono"
          style={{ fontSize: '2.25rem', fontWeight: 700, lineHeight: 1.15, margin: '0.25rem 0' }}
        >
          {value}
        </p>
      )}
      <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>{hint}</p>
    </div>
  );
  return href ? (
    <Link href={href} style={{ display: 'block' }}>
      {body}
    </Link>
  ) : (
    body
  );
}

function StatusRow({
  ok,
  label,
  detail,
}: {
  ok: boolean | null;
  label: string;
  detail: string;
}) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', padding: '0.5rem 0' }}>
      <span
        className={`dot ${ok === null ? 'dot-warn' : ok ? 'dot-ok' : 'dot-bad'}`}
        style={{ marginTop: '0.45rem' }}
        aria-hidden="true"
      />
      <span>
        <span style={{ fontWeight: 500 }}>{label}</span>
        {/* Words as well as colour — a green dot alone is not a status for the
            portion of the audience with colour-vision deficiency. */}
        <span style={{ display: 'block', fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
          {detail}
        </span>
      </span>
    </li>
  );
}

export default function DashboardPage() {
  const credits = useApi<CreditBalance>('/credits/balance');
  const rules = useApi<Rule[]>('/rules');
  const overlays = useApi<Overlay[]>('/overlays');
  const channels = useApi<Channel[]>('/channels');

  const [events, setEvents] = useState<LiveEvent[]>([]);
  const onEvent = useCallback((event: LiveEvent) => {
    setEvents((prev) => [...prev, event].slice(-LIVE_FEED_LIMIT));
  }, []);

  const channelIds = useMemo(() => (channels.data ?? []).map((c) => c.id), [channels.data]);
  const { status: socketStatus } = useEventsSocket({
    channelIds,
    onEvent,
    enabled: channelIds.length > 0,
  });

  const liveChannel = (channels.data ?? []).find((c) => c.isLive) ?? null;
  const elapsed = useElapsed(liveChannel?.lastLiveAt ?? null);

  // Session totals are computed from events this page actually received, and
  // are labelled as such. They are deliberately not called "hôm nay": the API
  // exposes no daily aggregate, and inventing one would be a lie in a number.
  const sessionGiftCoins = useMemo(
    () =>
      events
        .filter((e) => e.type === LiveEventType.GIFT)
        .reduce((sum, e) => sum + (e.giftCoinValue ?? 0), 0),
    [events],
  );

  const enabledRules = rules.data?.filter((r) => r.enabled).length ?? 0;
  const enabledOverlays = overlays.data?.filter((o) => o.enabled).length ?? 0;
  const verifiedChannels = (channels.data ?? []).filter((c) => c.verified).length;

  const firstError = credits.error ?? rules.error ?? overlays.error ?? channels.error;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 className="page-title">Tổng quan</h1>

      {firstError && (
        <div className="card">
          <ErrorState
            message={firstError}
            onRetry={() => {
              credits.reload();
              rules.reload();
              overlays.reload();
              channels.reload();
            }}
          />
        </div>
      )}

      {/* Hero: one calm sentence about whether things are working. The stop
          control is not repeated here — it lives once, in the header. */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <span
            className={`dot ${liveChannel ? 'dot-ok' : 'dot-warn'}`}
            style={{ width: '0.75rem', height: '0.75rem' }}
            aria-hidden="true"
          />
          <span>
            <span style={{ fontSize: '1.375rem', fontWeight: 700, display: 'block' }}>
              {liveChannel ? 'Buổi live đang chạy tốt' : 'Chưa có buổi live nào đang chạy'}
            </span>
            <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.9375rem' }}>
              {liveChannel
                ? `Kênh @${liveChannel.handle} đang phát`
                : 'Khi bạn bật live trên TikTok, mọi thứ ở đây sẽ tự chạy'}
            </span>
          </span>
        </div>

        {elapsed && (
          <span style={{ textAlign: 'right' }}>
            <span
              style={{
                display: 'block',
                fontSize: '0.8125rem',
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              Đã phát được
            </span>
            <span className="mono" style={{ fontSize: '2rem', fontWeight: 700 }}>
              {elapsed}
            </span>
          </span>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(212px, 1fr))',
          gap: '1rem',
        }}
      >
        <StatCard
          label="Lượt đọc còn lại"
          value={nf.format(credits.data?.balance ?? 0)}
          hint={
            credits.data?.resetsAt
              ? `Làm mới lúc ${new Date(credits.data.resetsAt).toLocaleString('vi-VN')}`
              : 'Dùng cho mỗi câu LiveNova đọc hộ bạn'
          }
          href="/billing"
          loading={credits.loading}
        />
        <StatCard
          label="Kịch bản đang bật"
          value={`${enabledRules}/${rules.data?.length ?? 0}`}
          hint="Số kịch bản sẽ tự chạy khi bạn lên sóng"
          href="/rules"
          loading={rules.loading}
        />
        <StatCard
          label="Hiệu ứng đang bật"
          value={`${enabledOverlays}/${overlays.data?.length ?? 0}`}
          hint="Những gì khán giả nhìn thấy trên màn hình"
          href="/overlays"
          loading={overlays.loading}
        />
        <StatCard
          label="Quà nhận trong phiên này"
          value={nf.format(sessionGiftCoins)}
          hint="Tính từ lúc bạn mở trang này, đơn vị xu"
          loading={false}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(260px, 1fr)',
          gap: '1.25rem',
          alignItems: 'start',
        }}
      >
        <section className="card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.75rem',
            }}
          >
            <h2 className="section-title">Hoạt động gần đây</h2>
            {socketStatus === 'connected' && (
              <span className="pill pill-ok">
                <span className="dot dot-ok" aria-hidden="true" />
                Đang cập nhật
              </span>
            )}
          </div>
          <LiveFeed events={events} />
        </section>

        <section className="card">
          <h2 className="section-title" style={{ marginBottom: '0.5rem' }}>
            Tình trạng kết nối
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            <StatusRow
              ok={verifiedChannels > 0}
              label="Kênh TikTok"
              detail={
                verifiedChannels > 0
                  ? `${verifiedChannels} kênh đã xác minh`
                  : 'Chưa kênh nào được xác minh'
              }
            />
            <StatusRow
              ok={socketStatus === 'connected' ? true : socketStatus === 'unauthorized' ? false : null}
              label="Nhận sự kiện trực tiếp"
              detail={
                socketStatus === 'connected'
                  ? 'Đang nhận bình luận và quà tặng'
                  : socketStatus === 'unauthorized'
                    ? 'Phiên đăng nhập hết hạn, hãy đăng nhập lại'
                    : channelIds.length === 0
                      ? 'Cần kết nối kênh trước'
                      : 'Đang kết nối…'
              }
            />
            <StatusRow
              ok={(credits.data?.balance ?? 0) > 0}
              label="Giọng đọc"
              detail={
                (credits.data?.balance ?? 0) > 0
                  ? 'Sẵn sàng đọc hộ bạn'
                  : 'Hết lượt đọc — nạp thêm để tiếp tục'
              }
            />
          </ul>

          {/* OBS and the local bridge genuinely cannot be probed from a browser;
              saying so is better than a green dot that means nothing. */}
          <p
            style={{
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid hsl(var(--border))',
              fontSize: '0.8125rem',
              color: 'hsl(var(--muted-foreground))',
            }}
          >
            Tình trạng OBS và phần mềm trên máy hiển thị trong ứng dụng máy tính.
          </p>
        </section>
      </div>

      {!rules.loading && !rules.error && (rules.data?.length ?? 0) === 0 && (
        <section className="card" style={{ textAlign: 'center' }}>
          <h2 className="section-title">Chưa có kịch bản nào</h2>
          <p style={{ color: 'hsl(var(--muted-foreground))', margin: '0.5rem 0 1rem' }}>
            Kịch bản là thứ giúp bạn không bỏ sót lời cảm ơn nào. Chọn một mẫu có sẵn là chạy được ngay.
          </p>
          <Link href="/rules" className="btn btn-primary">
            <Icon name={'rule' as IconName} size={18} />
            Tạo kịch bản đầu tiên
          </Link>
        </section>
      )}
    </div>
  );
}
