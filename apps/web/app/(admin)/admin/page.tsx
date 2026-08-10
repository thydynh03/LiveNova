'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useApi } from '../../../lib/use-api';
import { Icon } from '../../../components/ui/Icon';
import { LoadingState, ErrorState, EmptyState } from '../../../components/common/States';

interface MetricsResponse {
  summary: {
    totalUsers: number;
    newUsersThisWeek: number;
    totalChannels: number;
    activeChannels: number;
    activeLiveSessions: number;
    totalTemplates: number;
    totalRevenueVnd: number;
    totalCreditsBurned: number;
    totalEventsCount: number;
  };
  /**
   * Figures the product does not observe yet, named by the server.
   *
   * This is the contract that was missed: the API reports what it *cannot*
   * measure rather than inventing a value, and the dashboard is supposed to
   * print "chưa đo được" for each name in here. Declaring `systemHealth` on
   * `summary` instead described a response the server has never sent.
   */
  unmeasured?: string[];
  charts: {
    revenueTrend: { date: string; revenue: number; creditsUsed: number }[];
    giftDistribution: { name: string; count: number; percent: number; coins?: number }[];
  };
  topStreamers: {
    id: string;
    displayName: string;
    email: string;
    handle: string | null;
    isLive: boolean;
    balance: number;
  }[];
  recentLiveSessions: {
    id: string;
    channel: { handle: string; platform: string };
    user: { displayName: string; email: string };
    totalCoins: number;
    totalViewers: number;
    totalComments: number;
    startedAt: string;
    endedAt: string | null;
  }[];
}

/** Rank colours for the gift mix bars. */
const GIFT_COLOURS = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];

/** The infrastructure figures, and what each is called when it has no value. */
const UNMEASURED_LABELS = [
  { key: 'avgLatencyMs', label: 'Độ Trễ Socket (Ingest)', hint: 'Chưa có số đo từ ingest server' },
  { key: 'proxyPoolHealth', label: 'Proxy Pool Health', hint: 'Chống chặn IP TikTok' },
  { key: 'ttsCacheHitRate', label: 'TTS Cache Hit Rate', hint: 'Tiết kiệm chi phí API Voice' },
  { key: 'socketCluster', label: 'WebSocket Cluster', hint: 'Trạng thái cụm socket' },
] as const;

export default function AdminDashboardPage() {
  const { data, loading, error, reload } = useApi<MetricsResponse>('/admin/metrics');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('7d');

  if (loading && !data) {
    return <LoadingState label="Đang tổng hợp dữ liệu phân tích kinh doanh LiveNova…" />;
  }

  if (error && !data) {
    return <ErrorState message={error} onRetry={reload} />;
  }

  /*
   * No invented fallbacks.
   *
   * These used to be filled with plausible business figures — 148 users,
   * 18,650,000 VND, a seven-day revenue curve — whenever the API had not
   * answered. They rendered identically to measured data, so an admin looking
   * at the screen could not tell which was which. An empty dashboard is
   * recoverable; a convincing wrong one is not.
   */
  const summary = data?.summary ?? null;
  const revenueTrend = data?.charts?.revenueTrend ?? [];
  const giftDistribution = data?.charts?.giftDistribution ?? [];

  const maxRevenue = Math.max(...revenueTrend.map((d) => d.revenue), 1);
  const maxCredits = Math.max(...revenueTrend.map((d) => d.creditsUsed), 1);

  // Nothing measured yet means nothing to draw. Rendering the frame with empty
  // numbers inside reads as "all zero", which is a different claim.
  if (!summary) {
    return (
      <EmptyState
        title="Chưa có số liệu"
        description="Máy chủ chưa trả về dữ liệu thống kê. Thử tải lại sau ít phút."
      />
    );
  }

  const topStreamers = data?.topStreamers || [];
  const recentLiveSessions = data?.recentLiveSessions || [];
  const unmeasured = data?.unmeasured ?? UNMEASURED_LABELS.map((u) => u.key);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* ── HEADER BANNER ──────────────────────────────────────────────────── */}
      <div className="glass-panel animate-fade-in-up" style={{ padding: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, hsl(var(--card)/0.8), hsl(var(--primary)/0.05))' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 className="text-glow" style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Trung Tâm Điều Hành LiveNova
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
              Live Radar Online
            </span>
          </div>
          <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.95rem', margin: 0 }}>
            Quản trị viên toàn quyền. Chúc một ngày làm việc hiệu quả!
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="admin-segmented" style={{ background: 'hsl(var(--background)/0.5)', backdropFilter: 'blur(8px)' }}>
            {(['7d', '30d', 'all'] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={timeRange === range ? 'is-active' : ''}
              >
                {range === '7d' ? '7 Ngày' : range === '30d' ? '30 Ngày' : 'Tất cả'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => reload()}
            className="btn btn-secondary hover-lift"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            title="Làm mới dữ liệu"
          >
            <Icon name="rotate" size={16} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* ── KPI STATS CARDS ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        {/* Card 1: Tổng Doanh Thu */}
        <div className="glass-panel animate-fade-in-up" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Tổng Doanh Thu
            </span>
            <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))', color: '#10b981', display: 'grid', placeItems: 'center', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Icon name="money" size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'hsl(var(--foreground))', letterSpacing: '-0.02em' }}>
            {summary.totalRevenueVnd.toLocaleString('vi-VN')} <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>₫</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
            <Icon name="spark" size={14} />
            <span>Tăng trưởng xuất sắc</span>
          </div>
        </div>

        {/* Card 2: Streamer Hoạt Động */}
        <div className="glass-panel animate-fade-in-up" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Streamers Active
            </span>
            <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.05))', color: '#3b82f6', display: 'grid', placeItems: 'center', border: '1px solid rgba(59,130,246,0.2)' }}>
              <Icon name="users" size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'hsl(var(--foreground))', letterSpacing: '-0.02em' }}>
            {summary.activeChannels} <span style={{ fontSize: '1.1rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>/ {summary.totalUsers}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#3b82f6', fontWeight: 600 }}>
            <span>+{summary.newUsersThisWeek} user mới tuần này</span>
          </div>
        </div>

        {/* Card 3: Phiên LIVE Trực Tiếp */}
        <div className="glass-panel animate-fade-in-up" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Phòng Live Đang Chạy
            </span>
            <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))', color: '#ef4444', display: 'grid', placeItems: 'center', border: '1px solid rgba(239,68,68,0.2)' }}>
              <Icon name="broadcast" size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'hsl(var(--foreground))', letterSpacing: '-0.02em' }}>
            {summary.activeLiveSessions}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
            <span>Kết nối WebSocket theo thời gian thực</span>
          </div>
        </div>

        {/* Card 4: Tổng Sự Kiện Đã Xử Lý */}
        <div className="glass-panel animate-fade-in-up" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Lưu Lượng Tương Tác
            </span>
            <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05))', color: '#8b5cf6', display: 'grid', placeItems: 'center', border: '1px solid rgba(139,92,246,0.2)' }}>
              <Icon name="spark" size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'hsl(var(--foreground))', letterSpacing: '-0.02em' }}>
            {summary.totalEventsCount.toLocaleString('vi-VN')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#8b5cf6', fontWeight: 600 }}>
            <span>{summary.totalCreditsBurned.toLocaleString('vi-VN')} credit tiêu thụ</span>
          </div>
        </div>
      </div>

      {/* ── CHARTS ROW 1: REVENUE TREND & GIFT BREAKDOWN ────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.5rem' }}>
        {/* Chart 1: Doanh thu & Tốc độ tiêu thụ xu */}
        <div className="glass-panel animate-fade-in-up" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', animationDelay: '0.1s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                Dòng Tiền Doanh Thu & Đốt Xu
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.2rem' }}>
                So sánh GMV nạp tiền (VND) và lượng Credit tiêu hao
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', fontWeight: 600 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: '3px', background: 'linear-gradient(to bottom, #60a5fa, #3b82f6)' }} />
                Doanh thu
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: '3px', background: 'linear-gradient(to bottom, #f472b6, #ec4899)' }} />
                Xu Game/TTS
              </span>
            </div>
          </div>

          <div className="chart-grid-bg" style={{ height: '260px', display: 'flex', alignItems: 'flex-end', gap: '0.5rem', marginTop: '1rem', position: 'relative' }}>
            {revenueTrend.map((d, i) => (
              <div key={d.date} className="group" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '0.25rem', height: '100%' }}>
                <div style={{ display: 'flex', gap: '2px', height: '100%', alignItems: 'flex-end' }}>
                  <div
                    className="premium-chart-bar"
                    style={{
                      flex: 1,
                      background: 'linear-gradient(to top, #2563eb, #60a5fa)',
                      borderRadius: '4px 4px 0 0',
                      height: `${(d.revenue / maxRevenue) * 100}%`,
                    }}
                    title={`Doanh thu: ${d.revenue.toLocaleString('vi-VN')}đ`}
                  />
                  <div
                    className="premium-chart-bar"
                    style={{
                      flex: 1,
                      background: 'linear-gradient(to top, #db2777, #f472b6)',
                      borderRadius: '4px 4px 0 0',
                      height: `${(d.creditsUsed / maxCredits) * 100}%`,
                      animationDelay: '0.1s',
                    }}
                    title={`Xu đốt: ${d.creditsUsed.toLocaleString('vi-VN')}`}
                  />
                </div>
                <div style={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center', marginTop: '0.4rem' }}>
                  {new Date(d.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Phân bổ quà tặng */}
        <div className="glass-panel animate-fade-in-up" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', animationDelay: '0.2s' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Tỉ Trọng Quà Tặng (Item Mix)</h2>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.2rem' }}>
              Loại quà được tặng nhiều nhất theo lượt tương tác
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {giftDistribution.map((gift, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 700 }}>{gift.name}</span>
                  <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                    <strong>{gift.count.toLocaleString('vi-VN')}</strong> lượt ({gift.percent}%)
                  </span>
                </div>
                <div style={{ height: '10px', width: '100%', borderRadius: '999px', background: 'hsl(var(--secondary)/0.5)', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div
                    className="premium-chart-bar"
                    style={{
                      height: '100%',
                      width: `${gift.percent}%`,
                      background: `linear-gradient(90deg, transparent 0%, ${GIFT_COLOURS[idx % GIFT_COLOURS.length]} 100%)`,
                      backgroundColor: GIFT_COLOURS[idx % GIFT_COLOURS.length],
                      borderRadius: '999px',
                      transformOrigin: 'left',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CHARTS ROW 2: SYSTEM HEALTH ───────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-panel animate-fade-in-up" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', animationDelay: '0.3s' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Phân phối chế độ game</h2>
          <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.6 }}>
            Chưa có đủ dữ liệu telemetry từ Ingest Server. Hệ thống đang trong quá trình thu thập log.
          </p>
          <Link href="/battle/simulator" className="btn btn-secondary hover-lift" style={{ alignSelf: 'flex-start', fontSize: '0.85rem', marginTop: '1rem' }}>
            Mở Sandbox Trận Đấu
          </Link>
        </div>

        {/* Chart 4: Hạ tầng */}
        <div className="glass-panel animate-fade-in-up" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', animationDelay: '0.4s' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
              Giám Sát Hạ Tầng & Sức Khỏe Ingest Server
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.2rem' }}>
              Chất lượng WebSocket Cluster, Proxy Pool và TTS engine
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {UNMEASURED_LABELS.map(({ key, label, hint }) => {
              const measured = !unmeasured.includes(key);
              return (
                <div key={key} style={{ padding: '1.25rem', borderRadius: '12px', background: 'hsl(var(--secondary) / 0.2)', border: '1px solid hsl(var(--border) / 0.5)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>{label}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 900, margin: '0.4rem 0', color: 'hsl(var(--muted-foreground)/0.5)' }}>
                    {measured ? '—' : 'N/A'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{hint}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── TABLES ROW: TOP STREAMERS & REAL-TIME LIVE RADAR ────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.5rem' }}>
        {/* Table 1: Top Streamers */}
        <div className="glass-panel animate-fade-in-up" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', animationDelay: '0.5s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                Top Streamers (Leaderboard)
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.2rem' }}>
                Kênh có doanh thu ấn tượng
              </p>
            </div>
            <Link href="/admin/users" style={{ fontSize: '0.85rem', color: 'hsl(var(--primary))', fontWeight: 700, padding: '0.4rem 0.8rem', background: 'hsl(var(--primary)/0.1)', borderRadius: '999px' }}>
              Xem tất cả →
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid hsl(var(--border))', textAlign: 'left', color: 'hsl(var(--muted-foreground))' }}>
                  <th style={{ padding: '0.75rem 0' }}>Streamer</th>
                  <th style={{ padding: '0.75rem 0' }}>Trạng thái</th>
                  <th style={{ padding: '0.75rem 0' }}>Ước tính Xu</th>
                  <th style={{ padding: '0.75rem 0', textAlign: 'right' }}>Số dư tài khoản</th>
                </tr>
              </thead>
              <tbody>
                {topStreamers.map((s, idx) => (
                  <tr key={s.id || idx} style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)', transition: 'background 0.2s', ':hover': { background: 'hsl(var(--secondary)/0.5)' } } as any}>
                    <td style={{ padding: '0.75rem 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: idx === 0 ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' : idx === 1 ? 'linear-gradient(135deg, #94a3b8, #cbd5e1)' : idx === 2 ? 'linear-gradient(135deg, #d97706, #f59e0b)' : 'hsl(var(--secondary))',
                            color: idx < 3 ? '#ffffff' : 'hsl(var(--muted-foreground))',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            display: 'grid',
                            placeItems: 'center',
                            boxShadow: idx < 3 ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                          }}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <div style={{ fontWeight: 700 }}>{s.displayName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                            {s.handle ?? 'Chưa liên kết kênh'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 0' }}>
                      {s.isLive ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#ef4444',
                            background: 'rgba(239, 68, 68, 0.15)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
                          LIVE
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Offline</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 0', fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
                      —
                    </td>
                    <td style={{ padding: '0.75rem 0', textAlign: 'right', fontWeight: 700, color: 'hsl(var(--primary))' }}>
                      {s.balance.toLocaleString('vi-VN')} xu
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Radar Giám sát Phiên LIVE */}
        <div className="glass-panel animate-fade-in-up" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', animationDelay: '0.6s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                Radar Giám Sát Phiên LIVE Đang Chạy
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.2rem' }}>
                Theo dõi thời gian thực các phòng TikTok LIVE kết nối
              </p>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#10b981', fontWeight: 700, background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.6rem', borderRadius: '999px', border: '1px solid rgba(16,185,129,0.3)' }}>
              <Icon name="spark" size={14} />
              Đang bắt tín hiệu
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentLiveSessions.map((session, idx) => {
              const isOngoing = !session.endedAt;
              return (
                <div
                  key={session.id || idx}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '12px',
                    background: isOngoing ? 'linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.05))' : 'hsl(var(--secondary) / 0.3)',
                    border: isOngoing ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid hsl(var(--border))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'transform 0.2s',
                    cursor: 'default',
                  }}
                  className="hover-lift"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: isOngoing ? '#ef4444' : '#64748b',
                        boxShadow: isOngoing ? '0 0 10px #ef4444' : 'none',
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: isOngoing ? 'hsl(var(--primary))' : 'hsl(var(--foreground))' }}>
                        {session.channel?.handle || '@live_channel'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                        {session.user?.displayName || 'Streamer'} • {session.totalViewers.toLocaleString('vi-VN')} người xem
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f59e0b' }}>
                      {session.totalCoins.toLocaleString('vi-VN')} xu
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                      {session.totalComments} comments
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
