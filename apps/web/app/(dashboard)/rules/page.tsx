'use client';

import React, { useState, useEffect } from 'react';
import { useApi } from '../../../lib/use-api';
import { api } from '../../../lib/api-client';
import { LoadingState, ErrorState, EmptyState } from '../../../components/common/States';
import { Icon } from '../../../components/ui/Icon';
import { RuleModal } from '../../../components/rules/RuleModal';
import { RuleDryRunModal } from '../../../components/rules/RuleDryRunModal';
import { PresetLibraryModal } from '../../../components/rules/PresetLibraryModal';

export default function RulesPage() {
  const { data: rules, loading, error, reload } = useApi<any[]>('/rules');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any | null>(null);
  const [dryRunRule, setDryRunRule] = useState<any | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');

  useEffect(() => {
    if (!loading) setTogglingId(null);
  }, [loading]);

  async function toggleRule(rule: any) {
    setActionError(null);
    setTogglingId(rule.id);
    try {
      await api.patch(`/rules/${rule.id}`, { enabled: !rule.enabled });
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không đổi được trạng thái');
      setTogglingId(null);
    }
  }

  async function handleDuplicate(rule: any) {
    setActionError(null);
    try {
      await api.post(`/rules/${rule.id}/duplicate`);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Sao chép luật thất bại');
    }
  }

  async function handleDelete(rule: any) {
    if (!confirm(`Bạn có chắc chắn muốn xóa luật "${rule.name}"?`)) return;
    setActionError(null);
    try {
      await api.delete(`/rules/${rule.id}`);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Xóa luật thất bại');
    }
  }

  const filteredRules = (rules || []).filter((rule) => {
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'enabled'
        ? rule.enabled
        : !rule.enabled;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ maxWidth: '1050px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Top Header & Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '2rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Icon name="goal" size={30} />
            Luật Tự động <span className="accent">(Auto Rules Engine)</span>
          </h1>
          <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.95rem' }}>
            Quyết định các sự kiện livestream (Quà tặng, Bình luận, Thả tim, Follow) sẽ tự động kích hoạt hiệu ứng Video/Ảnh Popup trên OBS, Đọc giọng nói TTS.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowPresets(true)}
            style={{
              padding: '0.65rem 1.1rem',
              borderRadius: 'var(--radius)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: 'hsl(var(--foreground))',
              border: '1px solid var(--glass-border)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              minHeight: '44px',
            }}
          >
            <Icon name="spark" size={18} />
            Kho Luật Mẫu Sẵn
          </button>

          <button
            onClick={() => {
              setSelectedRule(null);
              setShowModal(true);
            }}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: 'var(--radius)',
              background: 'hsl(var(--primary))',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 4px 14px rgba(6, 182, 212, 0.35)',
              minHeight: '44px',
            }}
          >
            + Tạo Luật Mới
          </button>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius)',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'hsl(var(--destructive))',
            marginBottom: '1.5rem',
            fontWeight: 500,
          }}
        >
          {actionError}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ flex: 1, minWidth: '260px' }}>
          <input
            type="text"
            placeholder="🔍 Tìm kiếm luật theo tên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 1rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--glass-border)',
              background: 'rgba(255, 255, 255, 0.04)',
              color: 'inherit',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: 'var(--radius)' }}>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'enabled', label: 'Đang bật' },
            { id: 'disabled', label: 'Đang tắt' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id as any)}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: 'calc(var(--radius) - 2px)',
                border: 'none',
                background: filterStatus === tab.id ? 'hsl(var(--primary))' : 'transparent',
                color: filterStatus === tab.id ? '#fff' : 'hsl(var(--muted-foreground))',
                fontWeight: filterStatus === tab.id ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading / Error States */}
      {loading && <LoadingState label="Đang tải danh sách luật tự động..." />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {/* Empty State */}
      {!loading && !error && filteredRules.length === 0 && (
        <EmptyState
          title="Chưa có luật tự động nào"
          description="Tạo luật đầu tiên để tự động phát Video/Ảnh Popup hoặc Đọc giọng nói TTS mỗi khi viewer tặng quà hoặc bình luận trên livestream!"
        />
      )}

      {/* Rules List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredRules.map((rule) => {
          const conditions = rule.conditions || {};
          const actions = rule.actions || [];
          const eventTypeLabel =
            conditions.eventType?.[0] === 'gift'
              ? '🎁 Quà tặng'
              : conditions.eventType?.[0] === 'comment'
              ? '💬 Bình luận'
              : conditions.eventType?.[0] === 'like'
              ? '❤️ Thả tim'
              : conditions.eventType?.[0] === 'follow'
              ? '➕ Follow'
              : '⚡ Sự kiện';

          return (
            <div
              key={rule.id}
              className="glass"
              style={{
                padding: '1.25rem 1.5rem',
                borderRadius: 'var(--radius-lg)',
                border: rule.enabled ? '1px solid hsl(var(--primary) / 0.4)' : '1px solid var(--glass-border)',
                background: rule.enabled ? 'rgba(6, 182, 212, 0.03)' : 'rgba(255, 255, 255, 0.02)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1.25rem',
                flexWrap: 'wrap',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'hsl(var(--primary) / 0.15)',
                      color: 'hsl(var(--primary))',
                    }}
                  >
                    Ưu tiên #{rule.priority}
                  </span>

                  <strong style={{ fontSize: '1.1rem' }}>{rule.name}</strong>
                </div>

                {/* Details Badges */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.2rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255,255,255,0.06)',
                      color: 'hsl(var(--foreground))',
                    }}
                  >
                    {eventTypeLabel}
                    {conditions.giftName ? `: ${conditions.giftName}` : ''}
                    {conditions.minCoinValue ? ` (≥ ${conditions.minCoinValue} Xu)` : ''}
                    {conditions.keywords?.length ? `: "${conditions.keywords.join(', ')}"` : ''}
                  </span>

                  <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' }}>→</span>

                  {actions.map((act: any, i: number) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '0.8rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: 'var(--radius-sm)',
                        background: act.type === 'media_popup' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: act.type === 'media_popup' ? '#c084fc' : '#60a5fa',
                        fontWeight: 600,
                      }}
                    >
                      {act.type === 'media_popup' ? '🎥 Video/Ảnh Popup' : act.type === 'tts_read' ? '🗣️ Đọc TTS' : act.type}
                    </span>
                  ))}

                  {rule.cooldownMs > 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                      ⏱️ Chờ {rule.cooldownMs / 1000}s
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setDryRunRule(rule)}
                  title="Chạy thử nghiệm & xem hiệu ứng trực tiếp trên OBS"
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: 'var(--radius)',
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#4ade80',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <Icon name="device" size={15} />
                  Test
                </button>

                <button
                  onClick={() => {
                    setSelectedRule(rule);
                    setShowModal(true);
                  }}
                  title="Chỉnh sửa luật"
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: 'var(--radius)',
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: 'inherit',
                    border: '1px solid var(--glass-border)',
                    fontWeight: 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Sửa
                </button>

                <button
                  onClick={() => handleDuplicate(rule)}
                  title="Tạo bản sao luật này"
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: 'var(--radius)',
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: 'inherit',
                    border: '1px solid var(--glass-border)',
                    fontWeight: 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Nhân bản
                </button>

                <button
                  onClick={() => handleDelete(rule)}
                  title="Xóa luật"
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: 'var(--radius)',
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: 'hsl(var(--destructive))',
                    border: 'none',
                    fontWeight: 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Xóa
                </button>

                <button
                  onClick={() => toggleRule(rule)}
                  disabled={togglingId !== null}
                  aria-pressed={rule.enabled}
                  style={{
                    minHeight: '36px',
                    padding: '0.45rem 1rem',
                    borderRadius: 'var(--radius)',
                    border: '1px solid hsl(var(--border))',
                    background: rule.enabled ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.05)',
                    color: rule.enabled ? '#fff' : 'hsl(var(--muted-foreground))',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: togglingId !== null ? 'not-allowed' : 'pointer',
                    opacity: togglingId !== null && togglingId !== rule.id ? 0.6 : 1,
                  }}
                >
                  {togglingId === rule.id ? '…' : rule.enabled ? 'Đang BẬT' : 'Đang TẮT'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODALS */}
      {showModal && (
        <RuleModal
          rule={selectedRule}
          onClose={() => {
            setShowModal(false);
            setSelectedRule(null);
          }}
          onSuccess={() => {
            setShowModal(false);
            setSelectedRule(null);
            reload();
          }}
        />
      )}

      {dryRunRule && (
        <RuleDryRunModal
          rule={dryRunRule}
          onClose={() => setDryRunRule(null)}
        />
      )}

      {showPresets && (
        <PresetLibraryModal
          onClose={() => setShowPresets(false)}
          onSuccess={() => {
            setShowPresets(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
