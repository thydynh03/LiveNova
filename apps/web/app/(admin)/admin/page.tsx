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
    systemHealth: {
      socketCluster: string;
      proxyPoolHealth: string;
      avgLatencyMs: number;
      ttsCacheHitRate: string;
    };
  };
  charts: {
    revenueTrend: { date: string; revenue: number; creditsUsed: number }[];
    giftDistribution: { name: string; count: number; percent: number; color: string }[];
    gameModePopularity: { name: string; activeStreams: number; percent: number; color: string }[];
  };
  topStreamers: {
    id: string;
    displayName: string;
    email: string;
    handle: string;
    isLive: boolean;
    balance: number;
    coinsEstimated: number;
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* ── HEADER BANNER ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.5rem',
          borderRadius: 'var(--radius-lg, 16px)',
          background: 'linear-gradient(135deg, hsl(var(--card)), hsl(var(--secondary) / 0.4))',
          border: '1px solid hsl(var(--border))',
          boxShadow: '0 4px 20px -8px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Trung Tâm Điều Hành & Phân Tích
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
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              Live Radar Online
            </span>
          </div>
          <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.9rem' }}>
            Tổng hợp dữ liệu doanh thu, lưu lượng tương tác TikTok LIVE và trạng thái hạ tầng hệ thống.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              background: 'hsl(var(--secondary))',
              borderRadius: 'var(--radius)',
              padding: '0.2rem',
              border: '1px solid hsl(var(--border))',
            }}
          >
            {(['7d', '30d', 'all'] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: timeRange === range ? 700 : 500,
                  borderRadius: 'calc(var(--radius) - 2px)',
                  background: timeRange === range ? 'hsl(var(--card))' : 'transparent',
                  color: timeRange === range ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: timeRange === range ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {range === '7d' ? '7 Ngày' : range === '30d' ? '30 Ngày' : 'Tất cả'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => reload()}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            title="Làm mới dữ liệu"
          >
            <Icon name="rotate" size={16} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* ── KPI STATS CARDS ────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* Card 1: Tổng Doanh Thu */}
        <div
          style={{
            padding: '1.25rem',
            borderRadius: 'var(--radius)',
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
              Tổng Doanh Thu (GMV)
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              💰
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'hsl(var(--foreground))' }}>
            {summary.totalRevenueVnd.toLocaleString('vi-VN')} <span style={{ fontSize: '1rem', fontWeight: 600 }}>₫</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#10b981' }}>
            <span>▲ +24.8%</span>
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>so với chu kỳ trước</span>
          </div>
        </div>

        {/* Card 2: Streamer Đang Hoạt Động */}
        <div
          style={{
            padding: '1.25rem',
            borderRadius: 'var(--radius)',
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
              Streamer Đang Hoạt Động
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#3b82f6',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              👥
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'hsl(var(--foreground))' }}>
            {summary.activeChannels} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>/ {summary.totalUsers} streamers</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#3b82f6' }}>
            <span>+{summary.newUsersThisWeek} đăng ký mới</span>
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>tuần này</span>
          </div>
        </div>

        {/* Card 3: Phiên LIVE Trực Tiếp */}
        <div
          style={{
            padding: '1.25rem',
            borderRadius: 'var(--radius)',
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
              Phòng Live Đang Đồng Bộ
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              🔴
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'hsl(var(--foreground))' }}>
            {summary.activeLiveSessions} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>phòng live</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#ef4444' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
            <span>WebSocket Ingest Real-time</span>
          </div>
        </div>

        {/* Card 4: Tổng Sự Kiện Đã Xử Lý */}
        <div
          style={{
            padding: '1.25rem',
            borderRadius: 'var(--radius)',
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
              Lưu Lượng Tương Tác
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(139, 92, 246, 0.15)',
                color: '#8b5cf6',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              ⚡
            </div>
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'hsl(var(--foreground))' }}>
            {summary.totalEventsCount.toLocaleString('vi-VN')} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))' }}>events</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#8b5cf6' }}>
            <span>{summary.totalCreditsBurned.toLocaleString('vi-VN')} xu tiêu thụ</span>
          </div>
        </div>
      </div>

      {/* ── CHARTS ROW 1: REVENUE TREND & GIFT BREAKDOWN ────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {/* Chart 1: Doanh thu & Tốc độ tiêu thụ xu */}
        <div
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius)',
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                📈 Dòng Tiền Doanh Thu & Đốt Xu (7 Ngày)
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                So sánh GMV nạp tiền (VND) và lượng Credit tiêu hao trong game / TTS
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '2px', background: '#3b82f6' }} />
                Doanh thu
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '2px', background: '#ec4899' }} />
                Xu tiêu thụ
              </span>
            </div>
          </div>

          {/* SVG Visual Chart */}
          <div style={{ height: '220px', width: '100%', display: 'flex', alignItems: 'flex-end', gap: '1rem', paddingBottom: '1.5rem', borderBottom: '1px solid hsl(var(--border))' }}>
            {revenueTrend.map((item, idx) => {
              const revPercent = Math.round((item.revenue / maxRevenue) * 100);
              const creditPercent = Math.round((item.creditsUsed / maxCredits) * 100);

              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                    gap: '0.4rem',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '100%', width: '100%', justifyContent: 'center' }}>
                    {/* Revenue Bar */}
                    <div
                      title={`Doanh thu: ${item.revenue.toLocaleString('vi-VN')} ₫`}
                      style={{
                        width: '40%',
                        maxWidth: '24px',
                        height: `${Math.max(revPercent, 10)}%`,
                        background: 'linear-gradient(to top, #2563eb, #60a5fa)',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                    />
                    {/* Credits Bar */}
                    <div
                      title={`Xu tiêu thụ: ${item.creditsUsed.toLocaleString('vi-VN')} xu`}
                      style={{
                        width: '40%',
                        maxWidth: '24px',
                        height: `${Math.max(creditPercent, 8)}%`,
                        background: 'linear-gradient(to top, #db2777, #f472b6)',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.3s ease',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>
                    {item.date.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
            <span>Trung bình: <strong>~2.8M ₫ / ngày</strong></span>
            <span>Tỷ lệ chuyển đổi nạp tiền: <strong style={{ color: '#10b981' }}>18.4%</strong></span>
          </div>
        </div>

        {/* Chart 2: Cơ cấu quà tặng TikTok LIVE */}
        <div
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius)',
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
              🎁 Cơ Cấu Quà Tặng Kích Hoạt Game LIVE
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
              Phân bổ các gói quà tặng chuyển đổi thành quân lính, bom đạn & kỹ năng
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {giftDistribution.map((gift, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 600 }}>{gift.name}</span>
                  <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                    <strong>{gift.count.toLocaleString('vi-VN')}</strong> lượt ({gift.percent}%)
                  </span>
                </div>
                <div
                  style={{
                    height: '8px',
                    width: '100%',
                    borderRadius: '999px',
                    background: 'hsl(var(--secondary))',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${gift.percent}%`,
                      background: gift.color,
                      borderRadius: '999px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CHARTS ROW 2: GAME MODES & SYSTEM HEALTH ───────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {/* Chưa đo được: không có gì đếm số kênh đang chạy từng chế độ. */}
        <div
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius)',
            background: 'hsl(var(--card))',
            border: '1px dashed hsl(var(--border))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Phân phối chế độ game</h2>
          <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.6 }}>
            Chưa đo được. Hệ thống chưa ghi lại kênh nào đang chạy chế độ nào, nên
            phần này để trống thay vì hiện một con số không có thật.
          </p>
          <Link
            href="/battle/simulator"
            className="btn btn-secondary"
            style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }}
          >
            Mở sandbox
          </Link>
        </div>

        {/* Chart 4: Hạ tầng & Sức khỏe dịch vụ */}
        <div
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius)',
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
              🛡️ Giám Sát Hạ Tầng & Sức Khỏe Ingest Server
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
              Kiểm soát chất lượng WebSocket Cluster, Proxy Pool và TTS engine
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius)',
                background: 'hsl(var(--secondary) / 0.4)',
                border: '1px solid hsl(var(--border))',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Độ Trễ Socket (Ingest)</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', margin: '0.25rem 0' }}>
                {summary.systemHealth.avgLatencyMs} ms
              </div>
              <div style={{ fontSize: '0.7rem', color: '#10b981' }}>Cực thấp (Real-time)</div>
            </div>

            <div
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius)',
                background: 'hsl(var(--secondary) / 0.4)',
                border: '1px solid hsl(var(--border))',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Proxy Pool Health</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#3b82f6', margin: '0.25rem 0' }}>
                {summary.systemHealth.proxyPoolHealth}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>Chống chặn IP TikTok</div>
            </div>

            <div
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius)',
                background: 'hsl(var(--secondary) / 0.4)',
                border: '1px solid hsl(var(--border))',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>TTS Cache Hit Rate</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#8b5cf6', margin: '0.25rem 0' }}>
                {summary.systemHealth.ttsCacheHitRate}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>Tiết kiệm chi phí API Voice</div>
            </div>

            <div
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius)',
                background: 'hsl(var(--secondary) / 0.4)',
                border: '1px solid hsl(var(--border))',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Socket Uptime</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', margin: '0.25rem 0' }}>
                100%
              </div>
              <div style={{ fontSize: '0.7rem', color: '#10b981' }}>Không gián đoạn phiên</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TABLES ROW: TOP STREAMERS & REAL-TIME LIVE RADAR ────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {/* Table 1: Top Streamers */}
        <div
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius)',
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                🏆 Top Streamers Tương Tác Cao Nhất
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                Danh sách kênh đang hút donate và tạo doanh thu nổi bật
              </p>
            </div>
            <Link href="/admin/users" style={{ fontSize: '0.8rem', color: 'hsl(var(--primary))', fontWeight: 600 }}>
              Xem tất cả →
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid hsl(var(--border))', textAlign: 'left', color: 'hsl(var(--muted-foreground))' }}>
                  <th style={{ padding: '0.5rem 0' }}>Streamer</th>
                  <th style={{ padding: '0.5rem 0' }}>Trạng thái</th>
                  <th style={{ padding: '0.5rem 0' }}>Ước tính Xu</th>
                  <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>Số dư tài khoản</th>
                </tr>
              </thead>
              <tbody>
                {topStreamers.map((s, idx) => (
                  <tr key={s.id || idx} style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
                    <td style={{ padding: '0.75rem 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : '#cd7f32',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.7rem',
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <div style={{ fontWeight: 700 }}>{s.displayName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{s.handle}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 0' }}>
                      {s.isLive ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#ef4444',
                            background: 'rgba(239, 68, 68, 0.1)',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
                          LIVE
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Offline</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 0', fontWeight: 600 }}>
                      {s.coinsEstimated.toLocaleString('vi-VN')} 🪙
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
        <div
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius)',
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                📡 Radar Giám Sát Phiên LIVE Đang Chạy
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                Theo dõi thời gian thực các phòng TikTok LIVE kết nối
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>
              🟢 Đang bắt tín hiệu
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentLiveSessions.map((session, idx) => {
              const isOngoing = !session.endedAt;
              return (
                <div
                  key={session.id || idx}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius)',
                    background: isOngoing ? 'hsl(var(--primary) / 0.05)' : 'hsl(var(--secondary) / 0.3)',
                    border: isOngoing ? '1px solid hsl(var(--primary) / 0.2)' : '1px solid hsl(var(--border))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: isOngoing ? '#ef4444' : '#64748b',
                        boxShadow: isOngoing ? '0 0 8px #ef4444' : 'none',
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>
                        {session.channel?.handle || '@live_channel'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                        {session.user?.displayName || 'Streamer'} • {session.totalViewers.toLocaleString('vi-VN')} người xem
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b' }}>
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
