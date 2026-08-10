'use client';

import React, { useState } from 'react';
import { useApi } from '../../../../lib/use-api';
import { api } from '../../../../lib/api-client';
import { LoadingState, ErrorState, EmptyState } from '../../../../components/common/States';
import { Icon } from '../../../../components/ui/Icon';
import { ConfirmAction } from '../../../../components/common/ConfirmAction';
import { AdminPageHeader } from '../../../../components/admin/AdminShell';

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  role: 'USER' | 'ADMIN';
  emailVerified: boolean;
  deletedAt: string | null;
  createdAt: string;
  creditBalance?: { balance: number } | null;
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const { data, loading, error, reload } = useApi<{ users: AdminUser[]; total: number }>(
    `/admin/users?limit=50${applied ? `&search=${encodeURIComponent(applied)}` : ''}`,
  );

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<AdminUser | null>(null);

  async function toggleSuspended(user: AdminUser) {
    setActionError(null);
    setBusyId(user.id);
    try {
      await api.patch(`/admin/users/${user.id}/suspended`, { suspended: !user.deletedAt });
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không đổi được trạng thái');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <AdminPageHeader
        title="Người dùng"
        description={
          data ? `${data.total.toLocaleString('vi-VN')} tài khoản trong hệ thống.` : undefined
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(search.trim());
        }}
        style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}
      >
        <label htmlFor="admin-search" className="sr-only">
          Tìm theo email hoặc tên
        </label>
        <input
          id="admin-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo email hoặc tên"
          style={{
            flex: '1 1 260px',
            minHeight: '44px',
            padding: '0.6rem 0.9rem',
            borderRadius: 'var(--radius)',
            border: '1px solid hsl(var(--input))',
            background: 'hsl(var(--background))',
            color: 'inherit',
          }}
        />
        <button type="submit" className="btn btn-secondary">
          <Icon name="search" size={16} />
          Tìm
        </button>
      </form>

      {actionError && (
        <p role="alert" style={{ color: 'hsl(var(--destructive))' }}>
          {actionError}
        </p>
      )}

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (data?.users.length ?? 0) === 0 && (
        <EmptyState title="Không tìm thấy" description="Thử từ khoá khác." />
      )}

      <div className="admin-panel" style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Người Dùng</th>
              <th>Tình Trạng</th>
              <th>Số Dư</th>
              <th>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {data?.users.map((user) => (
              <tr key={user.id} style={{ opacity: user.deletedAt ? 0.6 : 1 }}>
                <td>
                  <strong style={{ display: 'block' }}>{user.displayName || '(chưa đặt tên)'}</strong>
                  <span style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>{user.email}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {user.role === 'ADMIN' && <Tag tone="primary">Quản trị</Tag>}
                    {!user.emailVerified && <Tag tone="muted">Chưa xác minh</Tag>}
                    {user.deletedAt && <Tag tone="destructive">Đã khoá</Tag>}
                    {!user.deletedAt && user.emailVerified && user.role !== 'ADMIN' && <Tag tone="primary">Bình thường</Tag>}
                  </div>
                </td>
                <td>
                  <strong className="tabular" style={{ color: 'hsl(var(--primary))' }}>
                    {user.creditBalance?.balance?.toLocaleString('vi-VN') || '0'}
                  </strong>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setAdjusting(user)}
                    >
                      <Icon name="coins" size={16} />
                      Credit
                    </button>
                    {user.role !== 'ADMIN' && (
                      <ConfirmAction
                        label={user.deletedAt ? 'Mở khoá' : 'Khoá'}
                        question={
                          user.deletedAt
                            ? 'Mở khoá tài khoản này?'
                            : 'Khoá tài khoản này? Họ sẽ không đăng nhập được.'
                        }
                        confirmLabel={user.deletedAt ? 'Mở khoá' : 'Khoá'}
                        busyLabel="Đang xử lý…"
                        onConfirm={() => toggleSuspended(user)}
                        disabled={busyId === user.id}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adjusting && (
        <AdjustCreditPanel
          user={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={() => {
            setAdjusting(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function Tag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'primary' | 'muted' | 'destructive';
}) {
  const colour =
    tone === 'primary'
      ? 'hsl(var(--primary))'
      : tone === 'destructive'
        ? 'hsl(var(--destructive))'
        : 'hsl(var(--muted-foreground))';
  return (
    <span
      style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        padding: '0.15rem 0.5rem',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${colour}`,
        color: colour,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

/**
 * Credit adjustment.
 *
 * The reason is required, not optional: an unexplained balance change is
 * exactly what the audit log exists to make answerable, and a blank reason
 * would leave a log entry that answers nothing.
 */
function AdjustCreditPanel({
  user,
  onClose,
  onDone,
}: {
  user: AdminUser;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(amount);
  const valid = Number.isInteger(parsed) && parsed !== 0 && reason.trim() !== '';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/admin/users/${user.id}/credit`, { amount: parsed, reason: reason.trim() });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Điều chỉnh thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: 'grid', gap: '0.75rem' }}>
      <strong>Điều chỉnh credit — {user.email}</strong>

      <label htmlFor="adj-amount" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
        Số lượng (số dương để cộng, số âm để trừ)
      </label>
      <input
        id="adj-amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="numeric"
        placeholder="Ví dụ: 500 hoặc -200"
        style={inputStyle}
      />

      <label htmlFor="adj-reason" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
        Lý do (bắt buộc — sẽ lưu vào nhật ký)
      </label>
      <input
        id="adj-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Ví dụ: hoàn credit do lỗi hệ thống ngày 08/08"
        style={inputStyle}
      />

      {error && (
        <p role="alert" style={{ color: 'hsl(var(--destructive))', fontSize: '0.85rem' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" className="btn btn-primary" disabled={!valid || busy}>
          {busy ? 'Đang lưu…' : 'Xác nhận'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Huỷ
        </button>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  minHeight: '44px',
  padding: '0.6rem 0.9rem',
  borderRadius: 'var(--radius)',
  border: '1px solid hsl(var(--input))',
  background: 'hsl(var(--background))',
  color: 'inherit',
};
