'use client';

import React, { useState } from 'react';
import { useApi } from '../../../lib/use-api';
import { api } from '../../../lib/api-client';
import { LoadingState, ErrorState, EmptyState } from '../../../components/common/States';
import type { Rule } from '../../../lib/types';

export default function RulesPage() {
  // Real rules from the API. This page used to render three invented rules
  // ("Thank for Rose", "Like Milestone", "Sub Alert") that no backend ever knew
  // about, with buttons that did nothing.
  const { data, loading, error, reload } = useApi<Rule[]>('/rules');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function toggle(rule: Rule) {
    setActionError(null);
    setTogglingId(rule.id);
    try {
      await api.patch(`/rules/${rule.id}`, { enabled: !rule.enabled });
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không đổi được trạng thái');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Luật tự động</h1>
      <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '2rem' }}>
        Luật quyết định sự kiện nào trên livestream sẽ kích hoạt hành động nào.
        Số ưu tiên nhỏ hơn được xét trước.
      </p>

      {actionError && (
        <p role="alert" style={{ color: 'hsl(var(--destructive))', marginBottom: '1rem' }}>
          {actionError}
        </p>
      )}

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState
          title="Chưa có luật nào"
          description="Giao diện tạo luật quà tặng → video/ảnh đang được phát triển (F01). Hiện có thể tạo luật qua API."
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {data?.map((rule) => (
          <div
            key={rule.id}
            className="glass"
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <strong style={{ fontSize: '1.05rem' }}>{rule.name}</strong>
              <div
                style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}
              >
                Ưu tiên {rule.priority}
                {rule.actions?.length
                  ? ` · ${rule.actions.map((a) => a.type).join(', ')}`
                  : ' · chưa có hành động'}
              </div>
            </div>

            <button
              onClick={() => toggle(rule)}
              // Every row is locked while any toggle is in flight. Only
              // disabling the clicked row let a second click fire a PATCH built
              // from a value the first request was already changing.
              disabled={togglingId !== null}
              aria-pressed={rule.enabled}
              style={{
                minHeight: '44px',
                padding: '0.5rem 1.1rem',
                borderRadius: 'var(--radius)',
                border: '1px solid hsl(var(--border))',
                background: rule.enabled ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--card))',
                color: rule.enabled ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                fontWeight: 600,
                cursor: togglingId === rule.id ? 'not-allowed' : 'pointer',
              }}
            >
              {togglingId === rule.id ? '…' : rule.enabled ? 'Đang bật' : 'Đang tắt'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
