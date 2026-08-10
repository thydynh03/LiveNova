'use client';

import React, { useState } from 'react';
import { useApi } from '../../../../lib/use-api';
import { api } from '../../../../lib/api-client';
import { LoadingState, ErrorState, EmptyState } from '../../../../components/common/States';
import { Icon } from '../../../../components/ui/Icon';
import { ConfirmAction } from '../../../../components/common/ConfirmAction';
import { TemplateEditorModal, type TemplateData } from '../../../../components/templates/TemplateEditorModal';
import { TemplateAssetManager } from '../../../../components/templates/TemplateAssetManager';
import type { TeamBattleConfig } from '@livenova/shared';

interface AdminTemplate {
  id: string;
  slug: string | null;
  kind: 'GAME' | 'MEDIA_PACK' | 'RULE_PACK';
  gameMode: 'TEAM_BATTLE' | null;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  published: boolean;
  config: unknown;
  editableFields: string[];
  // `createdAt` từng được khai ở đây nhưng `listForAdmin` không select nó —
  // một trường luôn undefined mà kiểu dữ liệu lại khẳng định là có.
  assets: { id: string; key: string; url: string; mediaType: string }[];
  _count: { applied: number };
}

export default function AdminTemplatesPage() {
  const { data, loading, error, reload } = useApi<AdminTemplate[]>('/admin/templates');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals state
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateData | null>(null);
  const [assetManagerTemplate, setAssetManagerTemplate] = useState<AdminTemplate | null>(null);

  async function togglePublished(template: AdminTemplate) {
    setActionError(null);
    setBusyId(template.id);
    try {
      await api.patch(`/admin/templates/${template.id}/published`, {
        published: !template.published,
      });
      reload();
    } catch (err) {
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

  function handleOpenCreate() {
    setEditingTemplate(null);
    setEditorModalOpen(true);
  }

  function handleOpenEdit(template: AdminTemplate) {
    setEditingTemplate({
      id: template.id,
      kind: template.kind,
      gameMode: template.gameMode,
      name: template.name,
      description: template.description,
      thumbnailUrl: template.thumbnailUrl,
      config: template.config,
      editableFields: template.editableFields,
      published: template.published,
      assets: template.assets,
    });
    setEditorModalOpen(true);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="admin-header__text">
          <h1>Kho mẫu hệ thống</h1>
          <p>
            Tạo và cấu hình các bộ game, kịch bản phản ứng hoặc hiệu ứng để streamer áp dụng trực tiếp.
          </p>
        </div>

        <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
          <Icon name="plus" size={16} />
          Tạo mẫu mới
        </button>
      </div>

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
          description="Tạo mẫu đầu tiên hoặc chạy seed để nạp các mẫu khởi đầu."
        />
      )}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {data?.map((template) => {
          const isGame = template.kind === 'GAME';
          const battleConfig = isGame ? (template.config as TeamBattleConfig) : null;

          return (
            <article
              key={template.id}
              className="card"
              style={{
                display: 'grid',
                gap: '0.85rem',
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--card))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius)',
                      backgroundColor: 'hsl(var(--secondary))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'hsl(var(--primary))',
                      flexShrink: 0,
                    }}
                  >
                    <Icon
                      name={template.kind === 'GAME' ? 'versus' : template.kind === 'RULE_PACK' ? 'rule' : 'spark'}
                      size={20}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1.1rem' }}>{template.name}</strong>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${
                            template.published ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))'
                          }`,
                          color: template.published
                            ? 'hsl(var(--success))'
                            : 'hsl(var(--muted-foreground))',
                          backgroundColor: template.published
                            ? 'hsl(var(--success) / 0.1)'
                            : 'hsl(var(--muted) / 0.3)',
                        }}
                      >
                        {template.published ? 'ĐANG HIỆN' : 'BẢN NHÁP'}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'hsl(var(--muted-foreground))',
                        fontFamily: 'var(--font-mono), monospace',
                        marginTop: '0.2rem',
                      }}
                    >
                      {template.kind}
                      {template.gameMode ? ` · ${template.gameMode}` : ''}
                      {template.slug ? ` · [slug: ${template.slug}]` : ''}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    className="tabular"
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.25rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'hsl(var(--secondary))',
                      color: 'hsl(var(--muted-foreground))',
                    }}
                  >
                    <Icon name="user" size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                    {template._count.applied} streamer đang dùng
                  </span>
                </div>
              </div>

              {template.description && (
                <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.88rem', margin: 0 }}>
                  {template.description}
                </p>
              )}

              {/* GAME BATTLE PREVIEW SUMMARY */}
              {isGame && battleConfig?.teams && (
                <div
                  style={{
                    backgroundColor: 'hsl(var(--secondary) / 0.4)',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid hsl(var(--border))',
                    display: 'grid',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 600 }}>
                      Sàn đấu {battleConfig.teams.length} phe tham chiến:
                    </span>
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>
                      Thời lượng: {Math.round((battleConfig.battle?.durationSec ?? 1200) / 60)} phút · {battleConfig.actions?.length ?? 0} bậc hoả lực
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {battleConfig.teams.map((t, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'hsl(var(--card))',
                          border: `1px solid ${t.color || 'hsl(var(--border))'}`,
                          fontSize: '0.78rem',
                        }}
                      >
                        <span
                          style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: t.color || '#a78bfa',
                          }}
                        />
                        <strong>{t.name || t.key}</strong>
                        <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.72rem' }}>
                          ({(t.giftNames || []).join(', ') || 'Chưa gán quà'})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid hsl(var(--border))', paddingTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleOpenEdit(template)}
                  disabled={busyId === template.id}
                  style={{ fontSize: '0.82rem' }}
                >
                  <Icon name="settings" size={15} />
                  Sửa cấu hình
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAssetManagerTemplate(template)}
                  disabled={busyId === template.id}
                  style={{ fontSize: '0.82rem' }}
                >
                  <Icon name="spark" size={15} />
                  Tài nguyên ({template.assets.length})
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => togglePublished(template)}
                  disabled={busyId === template.id}
                  style={{ fontSize: '0.82rem' }}
                >
                  <Icon name={template.published ? 'eyeSlash' : 'eye'} size={15} />
                  {template.published ? 'Ẩn đi' : 'Phát hành'}
                </button>

                {template._count.applied === 0 && (
                  <div style={{ marginLeft: 'auto' }}>
                    <ConfirmAction
                      label="Xoá"
                      question={`Xoá hẳn mẫu "${template.name}" khỏi hệ thống?`}
                      confirmLabel="Xoá"
                      busyLabel="Đang xoá…"
                      onConfirm={() => remove(template)}
                      disabled={busyId === template.id}
                    />
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Template Create / Edit Modal */}
      {editorModalOpen && (
        <TemplateEditorModal
          initialData={editingTemplate}
          onSaved={() => {
            setEditorModalOpen(false);
            reload();
          }}
          onClose={() => setEditorModalOpen(false)}
        />
      )}

      {/* Asset Manager Modal */}
      {assetManagerTemplate && (
        <TemplateAssetManager
          templateId={assetManagerTemplate.id}
          templateName={assetManagerTemplate.name}
          assets={assetManagerTemplate.assets}
          onChanged={() => {
            reload();
            // Update local open state if template reloaded
            const updated = data?.find((t) => t.id === assetManagerTemplate.id);
            if (updated) setAssetManagerTemplate(updated);
          }}
          onClose={() => setAssetManagerTemplate(null)}
        />
      )}
    </div>
  );
}
