'use client';

import React from 'react';
import { useApi } from '../../../../lib/use-api';
import { LoadingState, ErrorState } from '../../../../components/common/States';
import { Icon } from '../../../../components/ui/Icon';
import {
  AdminPageHeader,
  Panel,
  StatTile,
  StatusPill,
} from '../../../../components/admin/AdminShell';

/**
 * SEO có hoạt động không.
 *
 * Máy chủ tải thật các trang công khai rồi đọc thẻ meta trong đó — không đọc mã
 * nguồn. Khác biệt này quan trọng: một bảng đọc mã nguồn sẽ luôn báo xanh, kể
 * cả khi trang đang trả về 500 hoặc khi biến môi trường sai làm canonical trỏ
 * về localhost. Trang này báo đúng thứ Googlebot thấy.
 */

interface PageCheck {
  path: string;
  status: number | null;
  error: string | null;
  title: string | null;
  titleLength: number | null;
  description: string | null;
  descriptionLength: number | null;
  canonical: string | null;
  ogTitle: string | null;
  ogImage: string | null;
  h1Count: number;
  robotsMeta: string | null;
  issues: string[];
}

interface Audit {
  baseUrl: string;
  checkedAt: string;
  baseUrlIsLocal: boolean;
  pages: PageCheck[];
  robots: { status: number | null; declaresSitemap: boolean; issues: string[] };
  sitemap: { status: number | null; urlCount: number; issues: string[] };
  notChecked: string[];
  totalIssues: number;
}

export default function AdminSeoPage() {
  const { data, loading, error, reload } = useApi<Audit>('/admin/analytics/seo');

  if (loading && !data) return <LoadingState label="Đang tải các trang công khai và đọc thẻ meta…" />;
  if (error && !data) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const healthyPages = data.pages.filter((p) => p.issues.length === 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <AdminPageHeader
        title="Sức khoẻ SEO"
        description={`Máy chủ tải thật từng trang công khai rồi đọc thẻ meta trong kết quả trả về — đúng thứ Googlebot nhận được, không phải thứ ghi trong mã nguồn.`}
        actions={
          <button type="button" onClick={() => reload()} className="btn btn-secondary">
            <Icon name="rotate" size={16} />
            <span>Kiểm tra lại</span>
          </button>
        }
      />

      {/* Cảnh báo quan trọng nhất trang: nếu đang trỏ về localhost thì mọi kết
          luận bên dưới là về máy chủ nội bộ, không phải về trang thật. */}
      {data.baseUrlIsLocal && (
        <Panel tone="danger">
          <strong>Đang kiểm tra {data.baseUrl} — đây là địa chỉ nội bộ.</strong>
          <p style={{ margin: '0.4rem 0 0' }}>
            Mọi kết quả bên dưới nói về máy chủ này, không nói gì về trang thật ngoài internet. Đặt{' '}
            <code>PUBLIC_WEB_URL</code> trên máy chủ thành tên miền công khai rồi kiểm tra lại.
          </p>
        </Panel>
      )}

      <div className="admin-tile-grid">
        <StatTile
          icon={data.totalIssues === 0 ? 'check' : 'warning'}
          label="Vấn đề tìm thấy"
          value={String(data.totalIssues)}
          hint={data.totalIssues === 0 ? 'Không có gì cần sửa' : 'Chi tiết ở bên dưới'}
          tone={data.totalIssues === 0 ? 'good' : data.totalIssues > 5 ? 'bad' : 'warn'}
        />
        <StatTile
          icon="home"
          label="Trang đạt"
          value={`${healthyPages}/${data.pages.length}`}
          hint="Không còn lỗi nào"
          tone={healthyPages === data.pages.length ? 'good' : 'warn'}
        />
        <StatTile
          icon="queue"
          label="URL trong sitemap"
          value={String(data.sitemap.urlCount)}
          hint={data.sitemap.status === 200 ? 'sitemap.xml phản hồi 200' : 'sitemap.xml không tải được'}
          tone={data.sitemap.urlCount > 0 ? 'good' : 'bad'}
        />
        <StatTile
          icon="lock"
          label="robots.txt"
          value={data.robots.status === 200 ? 'Phản hồi 200' : `Lỗi ${data.robots.status ?? '—'}`}
          hint={data.robots.declaresSitemap ? 'Có khai báo Sitemap' : 'Chưa khai báo Sitemap'}
          tone={data.robots.status === 200 && data.robots.declaresSitemap ? 'good' : 'warn'}
        />
      </div>

      {(data.robots.issues.length > 0 || data.sitemap.issues.length > 0) && (
        <Panel tone="notice" title="robots.txt và sitemap.xml">
          <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.7 }}>
            {[...data.robots.issues, ...data.sitemap.issues].map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </Panel>
      )}

      {/* ── Từng trang ───────────────────────────────────────────────────── */}
      {data.pages.map((page) => (
        <Panel key={page.path}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)', margin: 0 }}>
              {page.path}
            </h2>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <StatusPill tone={page.status === 200 ? 'good' : 'bad'}>
                {page.error ? 'Không tải được' : `HTTP ${page.status}`}
              </StatusPill>
              <StatusPill tone={page.issues.length === 0 ? 'good' : 'warn'}>
                {page.issues.length === 0 ? 'Đạt' : `${page.issues.length} vấn đề`}
              </StatusPill>
            </div>
          </div>

          {page.issues.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.7, fontSize: '0.88rem' }}>
              {page.issues.map((issue) => (
                <li key={issue} style={{ color: 'hsl(var(--destructive))' }}>
                  {issue}
                </li>
              ))}
            </ul>
          )}

          <table className="admin-table">
            <tbody>
              <MetaRow label="Tiêu đề" value={page.title} count={page.titleLength} limit={60} />
              <MetaRow
                label="Mô tả"
                value={page.description}
                count={page.descriptionLength}
                limit={160}
              />
              <MetaRow label="Canonical" value={page.canonical} mono />
              <MetaRow label="og:title" value={page.ogTitle} />
              <MetaRow label="og:image" value={page.ogImage} mono />
              <MetaRow label="Số thẻ H1" value={String(page.h1Count)} />
              <MetaRow label="Meta robots" value={page.robotsMeta ?? 'Không đặt (mặc định: cho lập chỉ mục)'} />
            </tbody>
          </table>
        </Panel>
      ))}

      {data.notChecked.length > 0 && (
        <Panel tone="muted" title="Chưa kiểm">
          <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.6 }}>
            {data.notChecked.length} URL nằm trong sitemap nhưng trang này chưa kiểm tra. Nói rõ ra
            thay vì lờ đi — một bảng chỉ kiểm bốn trang mà trông như đã kiểm hết là bảng gây hiểu
            nhầm.
          </p>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', overflowWrap: 'anywhere' }}>
            {data.notChecked.join(' · ')}
          </div>
        </Panel>
      )}

      <p style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' }}>
        Kiểm lúc {new Date(data.checkedAt).toLocaleString('vi-VN')} · Địa chỉ gốc: {data.baseUrl}
      </p>
    </div>
  );
}

function MetaRow({
  label,
  value,
  count,
  limit,
  mono,
}: {
  label: string;
  value: string | null;
  count?: number | null;
  limit?: number;
  mono?: boolean;
}) {
  const over = count != null && limit != null && count > limit;
  return (
    <tr>
      <th style={{ width: '160px', verticalAlign: 'top', paddingTop: '0.65rem', borderBottom: 'none' }}>
        {label}
      </th>
      <td
        style={{
          fontFamily: mono ? 'var(--font-mono)' : undefined,
          fontSize: mono ? '0.8rem' : undefined,
          color: value ? undefined : 'hsl(var(--destructive))',
        }}
      >
        {value || 'Thiếu'}
        {count != null && limit != null && (
          <span
            className="tabular"
            style={{
              marginLeft: '0.5rem',
              fontSize: '0.75rem',
              color: over ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))',
            }}
          >
            {count}/{limit}
          </span>
        )}
      </td>
    </tr>
  );
}
