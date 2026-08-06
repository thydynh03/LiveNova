'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApi } from '../../../lib/use-api';
import { api } from '../../../lib/api-client';
import { LoadingState, ErrorState } from '../../../components/common/States';
import { Icon } from '../../../components/ui/Icon';
import { RuleModal } from '../../../components/rules/RuleModal';
import { RuleDryRunModal } from '../../../components/rules/RuleDryRunModal';
import { PresetLibraryModal } from '../../../components/rules/PresetLibraryModal';

/* eslint-disable @typescript-eslint/no-explicit-any */

const EVENT_PHRASE: Record<string, string> = {
  gift: 'ai đó tặng quà',
  comment: 'ai đó bình luận',
  like: 'ai đó thả tim',
  follow: 'ai đó theo dõi bạn',
  share: 'ai đó chia sẻ live',
  join: 'ai đó vào phòng',
};

const ACTION_PHRASE: Record<string, string> = {
  tts_read: 'đọc thành tiếng',
  media_popup: 'hiện video/ảnh lên màn hình',
};

/** "30 giây" reads; "30000ms" does not. */
function cooldownPhrase(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} giây`;
  const m = Math.round(s / 60);
  return `${m} phút`;
}

/**
 * A chip is an editable fragment of the sentence. Rendering conditions this way
 * — rather than as `gift_value > 100` in a table cell — is the entire point of
 * this screen: the audience are creators, and a rule they cannot read is a rule
 * they will not trust enough to switch on.
 */
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="chip">{children}</span>;
}

function RuleSentence({ rule }: { rule: any }) {
  const conditions = rule.conditions ?? {};
  const actions: any[] = rule.actions ?? [];
  const eventType: string | undefined = conditions.eventType?.[0];

  return (
    <p style={{ fontSize: '1rem', lineHeight: 2.1 }}>
      <span style={{ color: 'hsl(var(--muted-foreground))' }}>Khi </span>
      <Chip>{EVENT_PHRASE[eventType ?? ''] ?? 'có sự kiện trên live'}</Chip>

      {conditions.giftName ? (
        <>
          <span style={{ color: 'hsl(var(--muted-foreground))' }}> là </span>
          <Chip>{conditions.giftName}</Chip>
        </>
      ) : null}

      {conditions.minCoinValue ? (
        <>
          <span style={{ color: 'hsl(var(--muted-foreground))' }}> từ </span>
          <Chip>{Number(conditions.minCoinValue).toLocaleString('vi-VN')} xu trở lên</Chip>
        </>
      ) : null}

      {conditions.keywords?.length ? (
        <>
          <span style={{ color: 'hsl(var(--muted-foreground))' }}> có chứa </span>
          <Chip>{conditions.keywords.join(', ')}</Chip>
        </>
      ) : null}

      <span style={{ color: 'hsl(var(--muted-foreground))' }}> thì </span>
      {actions.length === 0 ? (
        <Chip>chưa chọn việc gì</Chip>
      ) : (
        actions.map((act, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <span style={{ color: 'hsl(var(--muted-foreground))' }}> và </span> : null}
            <Chip>{ACTION_PHRASE[act.type] ?? act.type}</Chip>
          </React.Fragment>
        ))
      )}

      {rule.cooldownMs > 0 ? (
        <>
          <span style={{ color: 'hsl(var(--muted-foreground))' }}> — tối đa </span>
          <Chip>1 lần mỗi {cooldownPhrase(rule.cooldownMs)}</Chip>
        </>
      ) : null}
    </p>
  );
}

/** A real switch, not a button labelled "Đang BẬT". */
function Toggle({
  on,
  busy,
  disabled,
  onChange,
  label,
}: {
  on: boolean;
  busy: boolean;
  disabled: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      style={{
        width: '52px',
        minHeight: '30px',
        height: '30px',
        padding: 0,
        borderRadius: 999,
        border: '1px solid hsl(var(--border))',
        background: on ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.6 : 1,
        position: 'relative',
        transition: 'background 0.18s ease',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '3px',
          left: on ? '25px' : '3px',
          width: '22px',
          height: '22px',
          borderRadius: 999,
          background: '#fff',
          boxShadow: 'var(--shadow-sm)',
          transition: 'left 0.18s ease',
        }}
      />
    </button>
  );
}

function TextButton({
  children,
  onClick,
  tone = 'normal',
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'normal' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        padding: '0.25rem 0.375rem',
        minHeight: '32px',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: '0.875rem',
        fontWeight: 500,
        color:
          tone === 'danger' ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))',
        textDecoration: 'underline',
        textUnderlineOffset: '3px',
      }}
    >
      {children}
    </button>
  );
}

export default function RulesPage() {
  const { data: rules, loading, error, reload } = useApi<any[]>('/rules');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any | null>(null);
  const [dryRunRule, setDryRunRule] = useState<any | null>(null);
  const [showPresets, setShowPresets] = useState(false);

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
      setActionError(err instanceof Error ? err.message : 'Không nhân bản được');
    }
  }

  async function handleDelete(rule: any) {
    if (!confirm(`Xoá kịch bản "${rule.name}"? Thao tác này không hoàn tác được.`)) return;
    setActionError(null);
    try {
      await api.delete(`/rules/${rule.id}`);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không xoá được');
    }
  }

  const filteredRules = useMemo(
    () =>
      (rules ?? []).filter((rule) => {
        const matchesSearch = rule.name
          .toLowerCase()
          .includes(searchTerm.trim().toLowerCase());
        const matchesStatus =
          filterStatus === 'all'
            ? true
            : filterStatus === 'enabled'
              ? rule.enabled
              : !rule.enabled;
        return matchesSearch && matchesStatus;
      }),
    [rules, searchTerm, filterStatus],
  );

  const hasAnyRule = (rules?.length ?? 0) > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 className="page-title">Kịch bản tự động</h1>
          <p style={{ color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>
            Quy định cách LiveNova phản hồi khán giả khi bạn đang lên sóng.
          </p>
        </div>

        {/* One primary action on the screen. "Kho mẫu" is deliberately the
            quieter of the two even though it is the easier path — it is offered
            prominently in the banner below instead. */}
        <button type="button" className="btn btn-primary" onClick={() => { setSelectedRule(null); setShowModal(true); }}>
          <Icon name="plus" size={18} />
          Tạo kịch bản mới
        </button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="card"
          style={{
            padding: '0.875rem 1.25rem',
            borderColor: 'hsl(var(--destructive) / 0.35)',
            color: 'hsl(var(--destructive))',
          }}
        >
          {actionError}
        </div>
      )}

      {/* Templates come first. Somebody who has never built an automation rule
          should not have to face an empty canvas and a "Tạo mới" button. */}
      <section
        className="card"
        style={{ background: 'hsl(var(--accent-surface))', borderColor: 'hsl(var(--primary) / 0.18)' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Icon name="spark" size={22} weight="fill" style={{ color: 'hsl(var(--primary))' }} />
            <span>
              <strong style={{ display: 'block' }}>Chưa biết bắt đầu từ đâu?</strong>
              <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.9375rem' }}>
                Chọn một mẫu có sẵn — cảm ơn khi nhận quà, chào người mới theo dõi, lọc bình luận xấu…
              </span>
            </span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setShowPresets(true)}>
            Xem mẫu có sẵn
          </button>
        </div>
      </section>

      {/* Search and filter only earn their space once there is enough to sift. */}
      {hasAnyRule && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="search"
            placeholder="Tìm kịch bản theo tên…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Tìm kịch bản theo tên"
            style={{
              flex: 1,
              minWidth: '240px',
              minHeight: '44px',
              padding: '0.6rem 0.875rem',
              borderRadius: 'var(--radius)',
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
              color: 'inherit',
              font: 'inherit',
              fontSize: '0.9375rem',
            }}
          />
          <div
            role="group"
            aria-label="Lọc theo trạng thái"
            style={{
              display: 'flex',
              gap: '0.25rem',
              padding: '4px',
              borderRadius: 'var(--radius)',
              background: 'hsl(var(--muted))',
            }}
          >
            {([
              { id: 'all', label: 'Tất cả' },
              { id: 'enabled', label: 'Đang bật' },
              { id: 'disabled', label: 'Đang tắt' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={filterStatus === tab.id}
                onClick={() => setFilterStatus(tab.id)}
                style={{
                  minHeight: '36px',
                  padding: '0.35rem 0.85rem',
                  borderRadius: 'calc(var(--radius) - 2px)',
                  border: 'none',
                  background: filterStatus === tab.id ? 'hsl(var(--card))' : 'transparent',
                  color:
                    filterStatus === tab.id
                      ? 'hsl(var(--foreground))'
                      : 'hsl(var(--muted-foreground))',
                  fontWeight: filterStatus === tab.id ? 600 : 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  boxShadow: filterStatus === tab.id ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <LoadingState label="Đang tải kịch bản…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && filteredRules.length === 0 && (
        <section className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <h2 className="section-title">
            {hasAnyRule ? 'Không có kịch bản nào khớp' : 'Bạn chưa có kịch bản nào'}
          </h2>
          <p style={{ color: 'hsl(var(--muted-foreground))', margin: '0.5rem 0 1.25rem' }}>
            {hasAnyRule
              ? 'Thử đổi từ khoá hoặc bỏ bộ lọc.'
              : 'Cách nhanh nhất là chọn một mẫu có sẵn rồi sửa lại câu chữ cho giống giọng bạn.'}
          </p>
          {!hasAnyRule && (
            <button type="button" className="btn btn-primary" onClick={() => setShowPresets(true)}>
              Chọn mẫu có sẵn
            </button>
          )}
        </section>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {filteredRules.map((rule) => (
          <article
            key={rule.id}
            className="card"
            style={{
              display: 'flex',
              gap: '1.25rem',
              alignItems: 'flex-start',
              opacity: rule.enabled ? 1 : 0.72,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  marginBottom: '0.25rem',
                  letterSpacing: 0,
                }}
              >
                {rule.name}
              </h2>
              <RuleSentence rule={rule} />

              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                  marginTop: '0.5rem',
                  alignItems: 'center',
                }}
              >
                <TextButton onClick={() => { setSelectedRule(rule); setShowModal(true); }}>
                  Sửa
                </TextButton>
                <TextButton onClick={() => setDryRunRule(rule)}>Thử trước</TextButton>
                <TextButton onClick={() => handleDuplicate(rule)}>Nhân bản</TextButton>
                <TextButton tone="danger" onClick={() => handleDelete(rule)}>
                  Xoá
                </TextButton>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
              <Toggle
                on={rule.enabled}
                busy={togglingId === rule.id}
                disabled={togglingId !== null}
                onChange={() => toggleRule(rule)}
                label={`${rule.enabled ? 'Tắt' : 'Bật'} kịch bản ${rule.name}`}
              />
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                {togglingId === rule.id ? 'Đang lưu…' : rule.enabled ? 'Đang bật' : 'Đang tắt'}
              </span>
            </div>
          </article>
        ))}
      </div>

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

      {dryRunRule && <RuleDryRunModal rule={dryRunRule} onClose={() => setDryRunRule(null)} />}

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
