'use client';

import React from 'react';
import { useApi } from '../../../../lib/use-api';
import { LoadingState, ErrorState, EmptyState } from '../../../../components/common/States';

interface AuditEntry {
  id: string;
  action: string;
  detail: Record<string, unknown>;
  createdAt: string;
  admin: { id: string; email: string };
  targetUser: { id: string; email: string } | null;
}

/** Codes are stored values; nobody reading a log should have to decode them. */
const ACTION_LABEL: Record<string, string> = {
  'user.suspend': 'Khoá tài khoản',
  'user.restore': 'Mở khoá tài khoản',
  'credit.adjust': 'Điều chỉnh credit',
};

export default function AdminAuditPage() {
  const { data, loading, error, reload } = useApi<AuditEntry[]>('/admin/audit-log?limit=100');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Nhật ký quản trị</h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem', maxWidth: '62ch' }}>
          Mọi hành động của quản trị viên đều ghi lại ở đây. Không có bảng này thì
          “tự dưng mất credit” là câu hỏi không ai trả lời được.
        </p>
      </div>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState title="Chưa có hoạt động nào" description="Nhật ký sẽ hiện khi có thao tác." />
      )}

      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {data?.map((entry) => (
          <div
            key={entry.id}
            className="card"
            style={{ display: 'grid', gap: '0.3rem', padding: '0.85rem 1.15rem' }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
              <strong>{ACTION_LABEL[entry.action] ?? entry.action}</strong>
              <span
                className="tabular"
                style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}
              >
                {new Date(entry.createdAt).toLocaleString('vi-VN')}
              </span>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>
              {entry.admin.email}
              {entry.targetUser ? ` → ${entry.targetUser.email}` : ''}
            </div>

            {Object.keys(entry.detail ?? {}).length > 0 && (
              <code
                style={{
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono), monospace',
                  color: 'hsl(var(--muted-foreground))',
                  overflowWrap: 'anywhere',
                }}
              >
                {JSON.stringify(entry.detail)}
              </code>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
