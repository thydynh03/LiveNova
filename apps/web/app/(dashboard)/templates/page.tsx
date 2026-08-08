'use client';

import React, { useState } from 'react';
import { useApi } from '../../../lib/use-api';
import { api } from '../../../lib/api-client';
import { LoadingState, ErrorState, EmptyState } from '../../../components/common/States';
import { Icon, type IconName } from '../../../components/ui/Icon';
import { ConfirmAction } from '../../../components/common/ConfirmAction';

interface TemplateSummary {
  id: string;
  kind: 'GAME' | 'MEDIA_PACK' | 'RULE_PACK';
  gameMode: string | null;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
}

interface AppliedTemplate {
  id: string;
  name: string;
  createdAt: string;
  template: { id: string; kind: string; thumbnailUrl: string | null };
}

/** Kind codes are database values. Nobody streaming has to see RULE_PACK. */
const KIND: Record<string, { label: string; blurb: string; icon: IconName }> = {
  GAME: {
    label: 'Trò chơi',
    blurb: 'Khán giả tặng quà để chơi cùng bạn ngay trên sóng.',
    icon: 'versus',
  },
  RULE_PACK: {
    label: 'Bộ kịch bản',
    blurb: 'Thêm sẵn một bộ phản ứng tự động cho buổi live.',
    icon: 'rule',
  },
  MEDIA_PACK: {
    label: 'Bộ hiệu ứng',
    blurb: 'Video và ảnh dựng sẵn để dùng cho các kịch bản.',
    icon: 'gift',
  },
};

export default function TemplatesPage() {
  const available = useApi<TemplateSummary[]>('/templates');
  const mine = useApi<AppliedTemplate[]>('/templates/mine');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [justApplied, setJustApplied] = useState<string | null>(null);

  async function apply(template: TemplateSummary) {
    setActionError(null);
    setBusyId(template.id);
    try {
      await api.post(`/templates/${template.id}/apply`);
      setJustApplied(template.id);
      mine.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không áp dụng được mẫu');
    } finally {
      setBusyId(null);
    }
  }

  async function removeApplied(applied: AppliedTemplate) {
    setActionError(null);
    setBusyId(applied.id);
    try {
      await api.delete(`/templates/mine/${applied.id}`);
      mine.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không gỡ được mẫu');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h1 className="page-title">Kho mẫu</h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem', maxWidth: '62ch' }}>
          Những bộ dựng sẵn để bạn dùng ngay, không phải tự cấu hình. Áp dụng xong bạn
          vẫn sửa lại được — bản của bạn là bản riêng, chúng tôi cập nhật mẫu gốc cũng
          không đụng tới.
        </p>
      </div>

      {actionError && (
        <p role="alert" style={{ color: 'hsl(var(--destructive))' }}>
          {actionError}
        </p>
      )}

      <section>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Đang dùng
        </h2>

        {mine.loading && <LoadingState />}
        {mine.error && <ErrorState message={mine.error} onRetry={mine.reload} />}
        {!mine.loading && !mine.error && (mine.data?.length ?? 0) === 0 && (
          <EmptyState
            title="Bạn chưa dùng mẫu nào"
            description="Chọn một mẫu bên dưới để bắt đầu nhanh."
          />
        )}

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {mine.data?.map((applied) => (
            <div
              key={applied.id}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
                padding: '1rem 1.25rem',
              }}
            >
              <Icon
                name={KIND[applied.template.kind]?.icon ?? 'spark'}
                size={20}
                style={{ color: 'hsl(var(--primary))' }}
              />
              <strong style={{ flex: '1 1 200px' }}>{applied.name}</strong>
              <ConfirmAction
                label="Gỡ"
                question="Gỡ mẫu này khỏi tài khoản?"
                confirmLabel="Gỡ"
                busyLabel="Đang gỡ…"
                onConfirm={() => removeApplied(applied)}
                disabled={busyId === applied.id}
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Có thể thêm
        </h2>

        {available.loading && <LoadingState />}
        {available.error && <ErrorState message={available.error} onRetry={available.reload} />}
        {!available.loading && !available.error && (available.data?.length ?? 0) === 0 && (
          <EmptyState
            title="Chưa có mẫu nào"
            description="Đội ngũ LiveNova đang chuẩn bị. Bạn vẫn tự tạo kịch bản riêng được."
          />
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
          }}
        >
          {available.data?.map((template) => {
            const kind = KIND[template.kind] ?? {
              label: template.kind,
              blurb: '',
              icon: 'spark' as IconName,
            };
            return (
              <article
                key={template.id}
                className="card"
                style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
              >
                {template.thumbnailUrl && (
                  /* Decorative: the name below carries the same information,
                     so a screen reader repeating it would only add noise.
                     Plain <img> rather than next/image — the URL is arbitrary
                     admin-supplied Cloudinary content, which next/image would
                     need configured remote patterns for. */
                  <img
                    src={template.thumbnailUrl}
                    alt=""
                    style={{
                      width: '100%',
                      aspectRatio: '16 / 9',
                      objectFit: 'cover',
                      borderRadius: 'var(--radius)',
                    }}
                  />
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icon name={kind.icon} size={18} style={{ color: 'hsl(var(--primary))' }} />
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      color: 'hsl(var(--muted-foreground))',
                    }}
                  >
                    {kind.label.toUpperCase()}
                  </span>
                </div>

                <strong style={{ fontSize: '1.05rem' }}>{template.name}</strong>
                <p
                  style={{
                    color: 'hsl(var(--muted-foreground))',
                    fontSize: '0.9rem',
                    flex: 1,
                  }}
                >
                  {template.description || kind.blurb}
                </p>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => apply(template)}
                  disabled={busyId === template.id}
                  // Pinned to the foot of the card so every CTA lands on one line
                  // regardless of how long the description above ran.
                  style={{ marginTop: 'auto' }}
                >
                  <Icon name={justApplied === template.id ? 'check' : 'plus'} size={16} />
                  {busyId === template.id
                    ? 'Đang thêm…'
                    : justApplied === template.id
                      ? 'Đã thêm'
                      : 'Dùng mẫu này'}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
