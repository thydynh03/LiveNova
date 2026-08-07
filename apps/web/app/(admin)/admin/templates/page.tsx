'use client';

import React, { useState } from 'react';
import { useApi } from '../../../../lib/use-api';
import { api } from '../../../../lib/api-client';
import { LoadingState, ErrorState, EmptyState } from '../../../../components/common/States';
import { Icon } from '../../../../components/ui/Icon';
import { ConfirmAction } from '../../../../components/common/ConfirmAction';

interface AdminTemplate {
  id: string;
  slug: string | null;
  kind: 'GAME' | 'MEDIA_PACK' | 'RULE_PACK';
  gameMode: string | null;
  name: string;
  description: string | null;
  published: boolean;
  config: Record<string, unknown>;
  assets: { id: string; key: string; url: string; mediaType: string }[];
  _count: { applied: number };
}

export default function AdminTemplatesPage() {
  const { data, loading, error, reload } = useApi<AdminTemplate[]>('/admin/templates');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function togglePublished(template: AdminTemplate) {
    setActionError(null);
    setBusyId(template.id);
    try {
      await api.patch(`/admin/templates/${template.id}/published`, {
        published: !template.published,
      });
      reload();
    } catch (err) {
      // Publishing re-validates the config, so this is where a broken template
      // is most likely to be caught. The message from the server lists every
      // problem at once.
      setActionError(err instanceof Error ? err.message : 'Không đổi được trạng thái');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(template: AdminTemplate) {
    setActionError(null);
    setBusyId(template.id);
    try {
      await api.delete(`/admin/templates/${template.id}`);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không xoá được mẫu');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, flex: 1 }}>Mẫu</h1>
        <button type="button" className="btn btn-primary" onClick={() => setCreating((v) => !v)}>
          <Icon name={creating ? 'close' : 'plus'} size={16} />
          {creating ? 'Đóng' : 'Tạo mẫu'}
        </button>
      </div>

      {creating && <CreateTemplateForm onCreated={() => { setCreating(false); reload(); }} />}

      {actionError && (
        <p role="alert" style={{ color: 'hsl(var(--destructive))', whiteSpace: 'pre-wrap' }}>
          {actionError}
        </p>
      )}

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (data?.length ?? 0) === 0 && (
        <EmptyState
          title="Chưa có mẫu nào"
          description="Tạo mẫu đầu tiên, hoặc chạy seed để nạp ba mẫu khởi đầu."
        />
      )}

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {data?.map((template) => (
          <article key={template.id} className="card" style={{ display: 'grid', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '1.05rem', flex: '1 1 200px' }}>{template.name}</strong>

              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${
                    template.published ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))'
                  }`,
                  color: template.published
                    ? 'hsl(var(--success))'
                    : 'hsl(var(--muted-foreground))',
                }}
              >
                {template.published ? 'ĐANG HIỆN' : 'BẢN NHÁP'}
              </span>

              <span
                className="tabular"
                style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}
              >
                {template._count.applied} người dùng
              </span>
            </div>

            {template.description && (
              <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.9rem' }}>
                {template.description}
              </p>
            )}

            <div
              style={{
                fontSize: '0.78rem',
                color: 'hsl(var(--muted-foreground))',
                fontFamily: 'var(--font-mono), monospace',
              }}
            >
              {template.kind}
              {template.gameMode ? ` · ${template.gameMode}` : ''}
              {template.slug ? ` · ${template.slug}` : ''}
              {template.assets.length > 0 ? ` · ${template.assets.length} asset` : ''}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => togglePublished(template)}
                disabled={busyId === template.id}
              >
                <Icon name={template.published ? 'eyeSlash' : 'eye'} size={16} />
                {template.published ? 'Ẩn đi' : 'Cho hiện'}
              </button>

              {/* Deleting is refused server-side while anyone is using it, so the
                  control is hidden rather than offered and then rejected. */}
              {template._count.applied === 0 && (
                <ConfirmAction
                  label="Xoá"
                  question="Xoá hẳn mẫu này?"
                  confirmLabel="Xoá"
                  busyLabel="Đang xoá…"
                  onConfirm={() => remove(template)}
                  disabled={busyId === template.id}
                />
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/**
 * Minimal creation form: kind, name, and the config as JSON.
 *
 * A visual editor for the battle config belongs with the game itself — until
 * that engine exists there is nothing for it to edit, and building it now would
 * mean guessing at fields that are still being decided.
 */
function CreateTemplateForm({ onCreated }: { onCreated: () => void }) {
  const [kind, setKind] = useState<'RULE_PACK' | 'MEDIA_PACK' | 'GAME'>('RULE_PACK');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState('{\n  "rules": []\n}');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(config) as Record<string, unknown>;
    } catch {
      // Caught here rather than sent to the server: a JSON syntax error has
      // nothing to do with the template's validity and the server's message
      // would be less useful than this one.
      setError('Cấu hình không phải JSON hợp lệ');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.post('/admin/templates', {
        kind,
        name: name.trim(),
        description: description.trim() || undefined,
        gameMode: kind === 'GAME' ? 'TEAM_BATTLE' : undefined,
        config: parsed,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo mẫu thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: 'grid', gap: '0.7rem' }}>
      <strong>Mẫu mới</strong>

      <label htmlFor="t-kind" style={labelStyle}>
        Loại
      </label>
      <select
        id="t-kind"
        value={kind}
        onChange={(e) => {
          const next = e.target.value as typeof kind;
          setKind(next);
          // Seed the editor with the right shape, so the first save is not a
          // guess at what the server expects.
          setConfig(
            next === 'GAME'
              ? JSON.stringify(BATTLE_SKELETON, null, 2)
              : next === 'MEDIA_PACK'
                ? '{\n  "assetKeys": []\n}'
                : '{\n  "rules": []\n}',
          );
        }}
        style={inputStyle}
      >
        <option value="RULE_PACK">Bộ kịch bản</option>
        <option value="MEDIA_PACK">Bộ hiệu ứng</option>
        <option value="GAME">Trò chơi</option>
      </select>

      <label htmlFor="t-name" style={labelStyle}>
        Tên
      </label>
      <input id="t-name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />

      <label htmlFor="t-desc" style={labelStyle}>
        Mô tả
      </label>
      <input
        id="t-desc"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={inputStyle}
      />

      <label htmlFor="t-config" style={labelStyle}>
        Cấu hình (JSON)
      </label>
      <textarea
        id="t-config"
        value={config}
        onChange={(e) => setConfig(e.target.value)}
        rows={12}
        spellCheck={false}
        style={{ ...inputStyle, fontFamily: 'var(--font-mono), monospace', fontSize: '0.85rem' }}
      />

      {error && (
        <p role="alert" style={{ color: 'hsl(var(--destructive))', whiteSpace: 'pre-wrap' }}>
          {error}
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={busy || name.trim() === ''}>
        {busy ? 'Đang tạo…' : 'Tạo'}
      </button>
    </form>
  );
}

/** Starting point matching PLAN_GAME_MODES_AND_TEMPLATES.md §4.2. */
const BATTLE_SKELETON = {
  teams: [
    { key: 'cat', name: 'Vương quốc Mèo', color: '#a78bfa', giftNames: ['Rose'] },
    { key: 'dog', name: 'Vương quốc Chó', color: '#60a5fa', giftNames: ['Finger Heart'] },
  ],
  power: { like: 1, share: 3, follow: 10 },
  energy: { capacity: 30, refillPerSec: 0.5 },
  freeEventMaxAction: 'castle',
  actions: [
    { minPower: 1, key: 'soldier' },
    { minPower: 10, key: 'castle' },
    { minPower: 99, key: 'dragon' },
  ],
  battle: { durationSec: 1200, showTopDonors: 4 },
};

const labelStyle: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 600 };

const inputStyle: React.CSSProperties = {
  minHeight: '44px',
  padding: '0.6rem 0.9rem',
  borderRadius: 'var(--radius)',
  border: '1px solid hsl(var(--input))',
  background: 'hsl(var(--background))',
  color: 'inherit',
};
