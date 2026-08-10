'use client';

import React, { useState } from 'react';
import { useApi } from '../../../../lib/use-api';
import { LoadingState, ErrorState, EmptyState } from '../../../../components/common/States';
import { Icon } from '../../../../components/ui/Icon';
import { AdminPageHeader, Panel, StatTile } from '../../../../components/admin/AdminShell';

/**
 * Lưu lượng web.
 *
 * Mọi con số ở đây đến từ bảng `WebEvent` của chính hệ thống. Chỗ nào chưa đo
 * được thì ghi "chưa đo được" — cùng nguyên tắc với trang tổng quan, và ở đây
 * còn quan trọng hơn: báo cáo lưu lượng là thứ người ta đem đi thuyết phục
 * người khác, nên một ô bịa số gây hại xa hơn phạm vi sản phẩm.
 */

interface Report {
  window: { days: number; since: string };
  summary: {
    totalViews: number;
    uniqueVisitors: number;
    totalClicks: number;
    newUsers: number;
    botViews: number;
    medianDwellMs: number | null;
    singlePageSessions: number | null;
  };
  unmeasured: string[];
  daily: { date: string; views: number; visitors: number }[];
  topPages: { path: string; views: number; medianDwellMs: number | null }[];
  topClicks: { label: string; clicks: number }[];
  referrers: { host: string; views: number }[];
  devices: { device: string; views: number }[];
  pagesWithoutDwell: string[];
  collectingSince: string | null;
}

const WINDOWS = [
  { days: 7, label: '7 ngày' },
  { days: 30, label: '30 ngày' },
  { days: 90, label: '90 ngày' },
];

function duration(ms: number | null): string {
  if (ms == null) return 'Chưa đo được';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} giây`;
  const m = Math.floor(s / 60);
  return `${m} phút ${s % 60} giây`;
}

const DEVICE_LABEL: Record<string, string> = {
  mobile: 'Điện thoại',
  desktop: 'Máy tính',
  bot: 'Bot / trình thu thập',
};

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState(7);
  const { data, loading, error, reload } = useApi<Report>(`/admin/analytics?days=${days}`);

  if (loading && !data) return <LoadingState label="Đang tổng hợp lưu lượng…" />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <EmptyState title="Chưa có dữ liệu" description="Thử tải lại sau ít phút." />;

  const { summary } = data;
  const maxDaily = Math.max(...data.daily.map((d) => d.views), 1);

  // Chưa thu thập được ngày nào thì nói thẳng, thay vì vẽ một biểu đồ toàn số
  // không — trông y hệt "có người vào nhưng không ai xem gì".
  const noDataYet = summary.totalViews === 0 && summary.uniqueVisitors === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <AdminPageHeader
        title="Lưu lượng & Hành vi"
        description="Bao nhiêu người vào, tới từ đâu, xem những trang nào và ở lại bao lâu. Đo bằng bảng của chính hệ thống — không cookie, không script bên thứ ba."
        actions={
          <>
            <div className="admin-segmented" role="group" aria-label="Khoảng thời gian">
              {WINDOWS.map((w) => (
                <button
                  key={w.days}
                  type="button"
                  onClick={() => setDays(w.days)}
                  aria-pressed={days === w.days}
                  className={days === w.days ? 'is-active' : undefined}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => reload()} className="btn btn-secondary">
              <Icon name="rotate" size={16} />
              <span>Làm mới</span>
            </button>
          </>
        }
      />

      {noDataYet && (
        <Panel tone="notice">
          <strong>Chưa ghi nhận lượt truy cập nào trong {days} ngày qua.</strong>
          <p style={{ margin: '0.4rem 0 0' }}>
            {data.collectingSince
              ? `Bảng bắt đầu thu thập từ ${new Date(data.collectingSince).toLocaleString('vi-VN')}.`
              : 'Bảng chưa nhận được sự kiện nào — bộ đếm mới được bật, hoặc trang chưa được deploy lại.'}
          </p>
        </Panel>
      )}

      <div className="admin-tile-grid">
        <StatTile
          icon="user"
          label="Khách truy cập"
          value={summary.uniqueVisitors.toLocaleString('vi-VN')}
          hint={`Phiên riêng biệt trong ${days} ngày`}
        />
        <StatTile
          icon="home"
          label="Lượt xem trang"
          value={summary.totalViews.toLocaleString('vi-VN')}
          hint={
            summary.uniqueVisitors > 0
              ? `${(summary.totalViews / summary.uniqueVisitors).toFixed(1)} trang mỗi khách`
              : undefined
          }
        />
        <StatTile
          icon="spark"
          label="Lượt bấm"
          value={summary.totalClicks.toLocaleString('vi-VN')}
          hint="Chỉ tính các nút có gắn theo dõi"
        />
        <StatTile
          icon="queue"
          label="Thời gian ở lại"
          value={duration(summary.medianDwellMs)}
          hint="Trung vị, không phải trung bình"
        />
        <StatTile
          icon="user"
          label="Đăng ký mới"
          value={summary.newUsers.toLocaleString('vi-VN')}
          hint="Tài khoản tạo trong khoảng này"
        />
        <StatTile
          icon="lock"
          label="Lượt của bot"
          value={summary.botViews.toLocaleString('vi-VN')}
          hint="Đã loại khỏi mọi số liệu về người"
        />
      </div>

      {/* ── Chuỗi theo ngày ──────────────────────────────────────────────── */}
      <Panel title="Theo ngày" subtitle="Cột đậm là lượt xem, số bên dưới là khách riêng biệt">
        <div className="admin-bars">
          {data.daily.map((d) => (
            <div key={d.date} className="admin-bars__col" title={`${d.date}: ${d.views} lượt xem, ${d.visitors} khách`}>
              <div
                className="admin-bars__fill"
                style={{ height: `${Math.round((d.views / maxDaily) * 100)}%` }}
              />
              <span className="admin-bars__label tabular">{d.date.slice(5)}</span>
              <span className="admin-bars__sub tabular">{d.visitors}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="admin-split">
        {/* ── Trang được xem nhiều nhất ──────────────────────────────────── */}
        <Panel title="Xem những gì" subtitle="Trang được mở nhiều nhất, kèm thời gian ở lại">
          {data.topPages.length === 0 ? (
            <EmptyState title="Chưa có lượt xem" description="Chưa trang nào được ghi nhận." />
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Đường dẫn</th>
                  <th style={{ textAlign: 'right' }}>Lượt xem</th>
                  <th style={{ textAlign: 'right' }}>Ở lại</th>
                </tr>
              </thead>
              <tbody>
                {data.topPages.map((p) => (
                  <tr key={p.path}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{p.path}</td>
                    <td className="tabular" style={{ textAlign: 'right', fontWeight: 700 }}>
                      {p.views.toLocaleString('vi-VN')}
                    </td>
                    <td
                      className="tabular"
                      style={{
                        textAlign: 'right',
                        color:
                          p.medianDwellMs == null
                            ? 'hsl(var(--muted-foreground))'
                            : 'hsl(var(--foreground))',
                      }}
                    >
                      {duration(p.medianDwellMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        {/* ── Bấm vào cái gì ─────────────────────────────────────────────── */}
        <Panel
          title="Bấm vào gì"
          subtitle="Chỉ đếm phần tử có gắn data-track — nút nào chưa gắn thì không xuất hiện ở đây"
        >
          {data.topClicks.length === 0 ? (
            <EmptyState
              title="Chưa ghi nhận lượt bấm"
              description="Gắn thuộc tính data-track vào nút cần theo dõi thì nó sẽ hiện ở đây."
            />
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nhãn</th>
                  <th style={{ textAlign: 'right' }}>Lượt bấm</th>
                </tr>
              </thead>
              <tbody>
                {data.topClicks.map((c) => (
                  <tr key={c.label}>
                    <td>{c.label}</td>
                    <td className="tabular" style={{ textAlign: 'right', fontWeight: 700 }}>
                      {c.clicks.toLocaleString('vi-VN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <div className="admin-split">
        <Panel title="Tới từ đâu" subtitle="Tên miền giới thiệu, không lưu URL đầy đủ">
          {data.referrers.length === 0 ? (
            <EmptyState
              title="Toàn bộ là truy cập trực tiếp"
              description="Chưa có nguồn giới thiệu nào được ghi nhận."
            />
          ) : (
            <ul className="admin-list">
              {data.referrers.map((r) => (
                <li key={r.host}>
                  <span>{r.host}</span>
                  <strong className="tabular">{r.views.toLocaleString('vi-VN')}</strong>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Thiết bị">
          <ul className="admin-list">
            {data.devices.map((d) => (
              <li key={d.device}>
                <span>{DEVICE_LABEL[d.device] ?? d.device}</span>
                <strong className="tabular">{d.views.toLocaleString('vi-VN')}</strong>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Nói rõ cái gì chưa đo được, thay vì để trống cho người đọc tự suy. */}
      <Panel tone="muted" title="Chưa đo được">
        <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.7 }}>
          <li>
            <strong>Tỉ lệ phiên chỉ xem một trang</strong> — cần gom sự kiện theo phiên, chưa làm.
          </li>
          <li>
            <strong>Tỉ lệ chuyển đổi</strong> — chưa nối lượt xem với lượt đăng ký ở mức từng phiên.
          </li>
          {data.pagesWithoutDwell.length > 0 && (
            <li>
              <strong>Thời gian ở lại</strong> của {data.pagesWithoutDwell.length} trang: có lượt xem
              nhưng chưa có sự kiện rời trang nào.
            </li>
          )}
        </ul>
      </Panel>
    </div>
  );
}
