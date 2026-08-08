'use client';

import React, { useState } from 'react';
import type { TeamBattleConfig, RulePackConfig, MediaPackConfig } from '@livenova/shared';
import { validateTeamBattleConfig, RuleActionType, LiveEventType } from '@livenova/shared';
import { api } from '../../lib/api-client';
import { Icon, type IconName } from '../ui/Icon';
import { TeamBattleConfigEditor } from './TeamBattleConfigEditor';
import { RulePackConfigEditor } from './RulePackConfigEditor';
import { MediaPackConfigEditor } from './MediaPackConfigEditor';

export interface TemplateData {
  id?: string;
  kind: 'GAME' | 'RULE_PACK' | 'MEDIA_PACK';
  gameMode?: 'TEAM_BATTLE' | null;
  name: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  config: unknown;
  editableFields?: string[];
  published?: boolean;
  assets?: { id: string; key: string; url: string; mediaType: string; createdAt: string }[];
}

interface TemplateEditorModalProps {
  initialData?: TemplateData | null;
  onSaved: () => void;
  onClose: () => void;
}

const DEFAULT_TEAM_BATTLE_CONFIG: TeamBattleConfig = {
  teams: [
    {
      key: 'cat',
      name: 'Vương quốc Mèo',
      color: '#ef4444',
      castleAsset: 'castle_cat',
      giftNames: ['Rose', 'Hoa hồng'],
    },
    {
      key: 'dog',
      name: 'Vương quốc Chó',
      color: '#3b82f6',
      castleAsset: 'castle_dog',
      giftNames: ['Finger Heart', 'Bắn tim'],
    },
  ],
  power: {
    like: 1,
    share: 3,
    follow: 10,
  },
  energy: {
    capacity: 30,
    refillPerSec: 0.5,
  },
  freeEventMaxAction: 'castle',
  actions: [
    { minPower: 1, key: 'soldier', asset: 'fx_soldier' },
    { minPower: 10, key: 'castle', asset: 'fx_castle' },
    { minPower: 50, key: 'bomb', asset: 'fx_bomb' },
    { minPower: 99, key: 'dragon', asset: 'fx_dragon' },
  ],
  battle: {
    durationSec: 1200,
    showTopDonors: 4,
  },
};

const DEFAULT_RULE_PACK_CONFIG: RulePackConfig = {
  rules: [
    {
      name: 'Quà to thì reo mừng',
      enabled: true,
      priority: 1,
      cooldownMs: 5000,
      continueMatching: false,
      conditions: {
        eventType: [LiveEventType.GIFT],
        minCoinValue: 10,
      },
      actions: [
        {
          type: RuleActionType.SOUND,
          payload: { asset: 'cheer' },
        },
      ],
    },
  ],
};

const DEFAULT_MEDIA_PACK_CONFIG: MediaPackConfig = {
  assetKeys: ['castle_cat', 'castle_dog', 'fx_dragon', 'fx_bomb', 'fx_soldier'],
};

const KIND_OPTIONS: { value: 'GAME' | 'RULE_PACK' | 'MEDIA_PACK'; label: string; icon: IconName }[] = [
  { value: 'GAME', label: 'Trò chơi tương tác (Game)', icon: 'versus' },
  { value: 'RULE_PACK', label: 'Bộ kịch bản (Rule Pack)', icon: 'rule' },
  { value: 'MEDIA_PACK', label: 'Bộ hiệu ứng (Media Pack)', icon: 'gift' },
];

export function TemplateEditorModal({
  initialData,
  onSaved,
  onClose,
}: TemplateEditorModalProps) {
  const isEditing = Boolean(initialData?.id);

  const [kind, setKind] = useState<'GAME' | 'RULE_PACK' | 'MEDIA_PACK'>(
    initialData?.kind || 'GAME'
  );
  const [gameMode, _setGameMode] = useState<'TEAM_BATTLE'>(
    (initialData?.gameMode as 'TEAM_BATTLE') || 'TEAM_BATTLE'
  );
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(initialData?.thumbnailUrl || '');
  const [editableFieldsText, setEditableFieldsText] = useState(
    (initialData?.editableFields || ['teams', 'battle']).join(', ')
  );

  // Editor mode: Visual UI vs Raw JSON
  const [editorMode, setEditorMode] = useState<'visual' | 'json'>('visual');

  // Config state
  const [configState, setConfigState] = useState<unknown>(() => {
    if (initialData?.config) return initialData.config;
    if (kind === 'GAME') return DEFAULT_TEAM_BATTLE_CONFIG;
    if (kind === 'RULE_PACK') return DEFAULT_RULE_PACK_CONFIG;
    return DEFAULT_MEDIA_PACK_CONFIG;
  });

  const [rawJsonText, setRawJsonText] = useState(() =>
    JSON.stringify(configState, null, 2)
  );
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Synchronize when kind changes in create mode
  function handleKindChange(nextKind: 'GAME' | 'RULE_PACK' | 'MEDIA_PACK') {
    setKind(nextKind);
    let nextCfg: unknown;
    if (nextKind === 'GAME') nextCfg = DEFAULT_TEAM_BATTLE_CONFIG;
    else if (nextKind === 'RULE_PACK') nextCfg = DEFAULT_RULE_PACK_CONFIG;
    else nextCfg = DEFAULT_MEDIA_PACK_CONFIG;

    setConfigState(nextCfg);
    setRawJsonText(JSON.stringify(nextCfg, null, 2));
    setJsonParseError(null);
  }

  // Switch between Visual and JSON
  function switchMode(target: 'visual' | 'json') {
    if (target === 'json') {
      setRawJsonText(JSON.stringify(configState, null, 2));
      setJsonParseError(null);
    } else {
      try {
        const parsed = JSON.parse(rawJsonText);
        setConfigState(parsed);
        setJsonParseError(null);
      } catch (err) {
        setJsonParseError(err instanceof Error ? err.message : 'JSON không đúng định dạng');
        return; // Don't switch if invalid JSON
      }
    }
    setEditorMode(target);
  }

  function handleVisualConfigChange(nextConfig: unknown) {
    setConfigState(nextConfig);
    setRawJsonText(JSON.stringify(nextConfig, null, 2));
  }

  function handleJsonTextChange(text: string) {
    setRawJsonText(text);
    try {
      const parsed = JSON.parse(text);
      setConfigState(parsed);
      setJsonParseError(null);
    } catch {
      setJsonParseError('JSON chưa hợp lệ (đang soạn thảo…)');
    }
  }

  const availableAssetKeys = (initialData?.assets || []).map((a) => a.key);

  // Validation
  let liveValidationErrors: string[] = [];
  if (kind === 'GAME' && gameMode === 'TEAM_BATTLE' && configState) {
    liveValidationErrors = validateTeamBattleConfig(configState as TeamBattleConfig);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);

    // Make sure JSON parses if in JSON mode
    let finalConfig = configState;
    if (editorMode === 'json') {
      try {
        finalConfig = JSON.parse(rawJsonText);
      } catch (err) {
        setSaveError('JSON không hợp lệ: ' + (err instanceof Error ? err.message : 'Syntax error'));
        return;
      }
    }

    if (kind === 'GAME' && gameMode === 'TEAM_BATTLE') {
      const issues = validateTeamBattleConfig(finalConfig as TeamBattleConfig);
      if (issues.length > 0) {
        setSaveError(`Cấu hình chưa đạt chuẩn: ${issues[0]}`);
        return;
      }
    }

    const editableFields = editableFieldsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      if (isEditing && initialData?.id) {
        await api.patch(`/admin/templates/${initialData.id}`, {
          name: name.trim(),
          description: description.trim() || undefined,
          thumbnailUrl: thumbnailUrl.trim() || undefined,
          config: finalConfig,
          editableFields,
        });
      } else {
        await api.post('/admin/templates', {
          kind,
          gameMode: kind === 'GAME' ? gameMode : undefined,
          name: name.trim(),
          description: description.trim() || undefined,
          thumbnailUrl: thumbnailUrl.trim() || undefined,
          config: finalConfig,
          editableFields,
        });
      }
      onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Không lưu được mẫu');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 'var(--z-modal)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '92vh',
          overflowY: 'auto',
          display: 'grid',
          gap: '1.25rem',
          backgroundColor: 'hsl(var(--card))',
          boxShadow: 'var(--shadow-lg)',
          padding: '1.5rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
              {isEditing ? `Sửa mẫu: ${initialData?.name}` : 'Soạn mẫu mới cho kho'}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
              Streamer sẽ áp dụng cấu hình này vào kênh của họ.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: '0.25rem',
            }}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {saveError && (
          <div role="alert" style={{ color: 'hsl(var(--destructive))', background: 'hsl(var(--destructive) / 0.1)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>
            {saveError}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'grid', gap: '1.25rem' }}>
          {/* Metadata section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label htmlFor="tpl-name" style={smallLabelStyle}>Tên mẫu *</label>
              <input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Đại chiến 4 Vương quốc"
                disabled={saving}
                style={inputStyle}
                required
              />
            </div>

            <div>
              <label htmlFor="tpl-kind" style={smallLabelStyle}>Phân loại mẫu</label>
              {isEditing ? (
                <div style={{ ...inputStyle, background: 'hsl(var(--secondary))', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                  <Icon name={kind === 'GAME' ? 'versus' : kind === 'RULE_PACK' ? 'rule' : 'gift'} size={16} />
                  {KIND_OPTIONS.find((k) => k.value === kind)?.label}
                </div>
              ) : (
                <select
                  id="tpl-kind"
                  value={kind}
                  onChange={(e) => handleKindChange(e.target.value as 'GAME' | 'RULE_PACK' | 'MEDIA_PACK')}
                  disabled={saving}
                  style={inputStyle}
                >
                  {KIND_OPTIONS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label htmlFor="tpl-thumb" style={smallLabelStyle}>Ảnh bìa (Thumbnail URL)</label>
              <input
                id="tpl-thumb"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://... hoặc /assets/..."
                disabled={saving}
                style={inputStyle}
              />
            </div>

            <div>
              <label htmlFor="tpl-editable" style={smallLabelStyle}>Trường cho phép Streamer sửa</label>
              <input
                id="tpl-editable"
                value={editableFieldsText}
                onChange={(e) => setEditableFieldsText(e.target.value)}
                placeholder="teams, battle, power..."
                disabled={saving}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label htmlFor="tpl-desc" style={smallLabelStyle}>Mô tả chi tiết</label>
            <textarea
              id="tpl-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả cách chơi, sự hấp dẫn để streamer chọn mẫu này..."
              disabled={saving}
              style={{ ...inputStyle, height: 'auto', resize: 'vertical' }}
            />
          </div>

          {/* Config Editor Section */}
          <div className="card" style={{ display: 'grid', gap: '0.75rem', background: 'hsl(var(--secondary) / 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon name="settings" size={18} style={{ color: 'hsl(var(--primary))' }} />
                <strong>Cấu hình chi tiết ({kind})</strong>
              </div>

              {/* Visual vs JSON Switcher */}
              <div style={{ display: 'inline-flex', borderRadius: 'var(--radius)', border: '1px solid hsl(var(--border))', overflow: 'hidden', background: 'hsl(var(--card))' }}>
                <button
                  type="button"
                  onClick={() => switchMode('visual')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    border: 'none',
                    background: editorMode === 'visual' ? 'hsl(var(--primary))' : 'transparent',
                    color: editorMode === 'visual' ? 'hsl(var(--primary-foreground))' : 'inherit',
                    fontWeight: editorMode === 'visual' ? 700 : 500,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <Icon name="eye" size={14} />
                  Trực quan (Visual)
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('json')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    border: 'none',
                    background: editorMode === 'json' ? 'hsl(var(--primary))' : 'transparent',
                    color: editorMode === 'json' ? 'hsl(var(--primary-foreground))' : 'inherit',
                    fontWeight: editorMode === 'json' ? 700 : 500,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <Icon name="waveform" size={14} />
                  Mã JSON (Raw)
                </button>
              </div>
            </div>

            {/* VISUAL MODE */}
            {editorMode === 'visual' && (
              <div>
                {kind === 'GAME' && (
                  <TeamBattleConfigEditor
                    value={configState as TeamBattleConfig}
                    onChange={handleVisualConfigChange}
                    availableAssetKeys={availableAssetKeys}
                    disabled={saving}
                  />
                )}
                {kind === 'RULE_PACK' && (
                  <RulePackConfigEditor
                    value={configState as RulePackConfig}
                    onChange={handleVisualConfigChange}
                    availableAssetKeys={availableAssetKeys}
                    disabled={saving}
                  />
                )}
                {kind === 'MEDIA_PACK' && (
                  <MediaPackConfigEditor
                    value={configState as MediaPackConfig}
                    onChange={handleVisualConfigChange}
                    disabled={saving}
                  />
                )}
              </div>
            )}

            {/* JSON MODE */}
            {editorMode === 'json' && (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <textarea
                  rows={14}
                  value={rawJsonText}
                  onChange={(e) => handleJsonTextChange(e.target.value)}
                  disabled={saving}
                  style={{
                    ...inputStyle,
                    fontFamily: 'var(--font-mono), monospace',
                    fontSize: '0.82rem',
                    whiteSpace: 'pre',
                    height: 'auto',
                  }}
                />
                {jsonParseError && (
                  <span style={{ color: 'hsl(var(--warning))', fontSize: '0.78rem' }}>
                    {jsonParseError}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid hsl(var(--border))', paddingTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Huỷ
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !name.trim() || liveValidationErrors.length > 0}
            >
              <Icon name="check" size={16} />
              {saving ? 'Đang lưu…' : isEditing ? 'Lưu thay đổi' : 'Tạo mẫu'}
            </button>
          </div>
        </form>
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
