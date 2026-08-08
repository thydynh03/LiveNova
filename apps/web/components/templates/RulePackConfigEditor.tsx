'use client';

import React from 'react';
import {
  type RulePackConfig,
  type TemplateRule,
  TEMPLATE_LIMITS,
  RuleActionType,
  LiveEventType,
} from '@livenova/shared';
import { Icon } from '../ui/Icon';

interface RulePackConfigEditorProps {
  value: RulePackConfig;
  onChange: (next: RulePackConfig) => void;
  availableAssetKeys?: string[];
  disabled?: boolean;
}

const EVENT_TYPE_OPTIONS: { value: LiveEventType; label: string; icon: string }[] = [
  { value: LiveEventType.GIFT, label: 'Tặng quà (Gift)', icon: 'gift' },
  { value: LiveEventType.LIKE, label: 'Thả tim (Like)', icon: 'like' },
  { value: LiveEventType.COMMENT, label: 'Bình luận (Comment)', icon: 'comment' },
  { value: LiveEventType.FOLLOW, label: 'Theo dõi (Follow)', icon: 'follow' },
  { value: LiveEventType.SHARE, label: 'Chia sẻ (Share)', icon: 'share' },
];

export function RulePackConfigEditor({
  value,
  onChange,
  availableAssetKeys = [],
  disabled = false,
}: RulePackConfigEditorProps) {
  function addRule() {
    if (value.rules.length >= TEMPLATE_LIMITS.MAX_RULES_PER_PACK) return;
    const newRule: TemplateRule = {
      name: `Kịch bản ${value.rules.length + 1}`,
      enabled: true,
      priority: 1,
      cooldownMs: 0,
      continueMatching: false,
      conditions: {
        eventType: [LiveEventType.GIFT],
      },
      actions: [
        {
          type: RuleActionType.SOUND,
          payload: { asset: availableAssetKeys[0] || 'sound_alert' },
        },
      ],
    };
    onChange({ ...value, rules: [...value.rules, newRule] });
  }

  function removeRule(index: number) {
    if (value.rules.length <= 1) return;
    const updated = value.rules.filter((_, i) => i !== index);
    onChange({ ...value, rules: updated });
  }

  function updateRule(index: number, patch: Partial<TemplateRule>) {
    const updated = value.rules.map((rule, i) => {
      if (i !== index) return rule;
      return { ...rule, ...patch };
    });
    onChange({ ...value, rules: updated });
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <strong style={{ fontSize: '0.95rem' }}>Danh sách kịch bản phản ứng (Rule Pack)</strong>
          <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
            Tập hợp các phản ứng tự động (âm thanh, thông báo TTS, video overlay) khi livestream có sự kiện.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={addRule}
          disabled={disabled || value.rules.length >= TEMPLATE_LIMITS.MAX_RULES_PER_PACK}
          style={{ fontSize: '0.82rem' }}
        >
          <Icon name="plus" size={14} />
          Thêm kịch bản ({value.rules.length}/{TEMPLATE_LIMITS.MAX_RULES_PER_PACK})
        </button>
      </div>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {value.rules.map((rule, idx) => {
          const currentEventType = rule.conditions?.eventType?.[0] || LiveEventType.GIFT;

          return (
            <div
              key={idx}
              className="card"
              style={{
                display: 'grid',
                gap: '0.75rem',
                borderLeft: '4px solid hsl(var(--primary))',
                background: 'hsl(var(--card))',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icon name="rule" size={16} style={{ color: 'hsl(var(--primary))' }} />
                  <strong style={{ fontSize: '0.95rem' }}>#{idx + 1}</strong>
                </div>
                {value.rules.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRule(idx)}
                    disabled={disabled}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'hsl(var(--destructive))',
                      cursor: 'pointer',
                      padding: '0.2rem',
                    }}
                    title="Xoá kịch bản này"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                <div>
                  <label style={smallLabelStyle}>Tên kịch bản</label>
                  <input
                    value={rule.name}
                    onChange={(e) => updateRule(idx, { name: e.target.value })}
                    placeholder="VD: Quà to thì reo mừng"
                    disabled={disabled}
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={smallLabelStyle}>Loại sự kiện kích hoạt</label>
                  <select
                    value={currentEventType}
                    onChange={(e) =>
                      updateRule(idx, {
                        conditions: {
                          ...rule.conditions,
                          eventType: [e.target.value as LiveEventType],
                        },
                      })
                    }
                    disabled={disabled}
                    style={inputStyle}
                  >
                    {EVENT_TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={smallLabelStyle}>Khoảng nghỉ (Cooldown)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input
                      type="number"
                      min={0}
                      max={3600}
                      value={Math.round((rule.cooldownMs ?? 0) / 1000)}
                      onChange={(e) =>
                        updateRule(idx, { cooldownMs: (Number(e.target.value) || 0) * 1000 })
                      }
                      disabled={disabled}
                      style={inputStyle}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>giây</span>
                  </div>
                </div>
              </div>

              {/* Conditions preview & basic configs */}
              {currentEventType === LiveEventType.GIFT && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={smallLabelStyle}>Tên quà lọc (để trống nếu nhận mọi quà)</label>
                    <input
                      value={rule.conditions?.giftName || ''}
                      onChange={(e) =>
                        updateRule(idx, {
                          conditions: {
                            ...rule.conditions,
                            giftName: e.target.value.trim() || undefined,
                          },
                        })
                      }
                      placeholder="VD: Rose, Galaxy, Lion..."
                      disabled={disabled}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={smallLabelStyle}>Giá trị xu tối thiểu (minCoinValue)</label>
                    <input
                      type="number"
                      min={0}
                      value={rule.conditions?.minCoinValue ?? ''}
                      onChange={(e) =>
                        updateRule(idx, {
                          conditions: {
                            ...rule.conditions,
                            minCoinValue: e.target.value ? Number(e.target.value) : undefined,
                          },
                        })
                      }
                      placeholder="VD: 1, 10, 100..."
                      disabled={disabled}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const smallLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'hsl(var(--muted-foreground))',
  display: 'block',
  marginBottom: '0.2rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '38px',
  padding: '0.4rem 0.65rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid hsl(var(--input))',
  background: 'hsl(var(--background))',
  color: 'inherit',
  fontSize: '0.85rem',
};
