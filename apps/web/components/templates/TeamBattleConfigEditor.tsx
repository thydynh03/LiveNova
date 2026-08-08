'use client';

import React, { useState } from 'react';
import type { TeamBattleConfig, BattleTeamConfig, BattleActionTier } from '@livenova/shared';
import { TEMPLATE_LIMITS, validateTeamBattleConfig } from '@livenova/shared';
import { Icon } from '../ui/Icon';

interface TeamBattleConfigEditorProps {
  value: TeamBattleConfig;
  onChange: (next: TeamBattleConfig) => void;
  availableAssetKeys?: string[];
  disabled?: boolean;
}

const PRESET_COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

const COMMON_TIKTOK_GIFTS = [
  'Rose',
  'Hoa hồng',
  'Finger Heart',
  'Tim ngón tay',
  'Capybara',
  'Donut',
  'Nước hoa',
  'Game Controller',
  'Vương miện',
  'Sư tử',
  'TikTok Universe',
  'Dragon',
];

const STANDARD_ACTION_PRESETS: { label: string; actions: BattleActionTier[]; maxFree: string }[] = [
  {
    label: 'Chuẩn Kingdom War (6 bậc)',
    maxFree: 'castle',
    actions: [
      { minPower: 1, key: 'soldier', asset: 'fx_soldier' },
      { minPower: 10, key: 'castle', asset: 'fx_castle' },
      { minPower: 50, key: 'bomb', asset: 'fx_bomb' },
      { minPower: 99, key: 'dragon', asset: 'fx_dragon' },
      { minPower: 199, key: 'cannon', asset: 'fx_cannon' },
      { minPower: 999, key: 'meteor', asset: 'fx_meteor' },
    ],
  },
  {
    label: 'Đơn giản (3 bậc)',
    maxFree: 'soldier',
    actions: [
      { minPower: 1, key: 'soldier', asset: 'fx_soldier' },
      { minPower: 20, key: 'bomb', asset: 'fx_bomb' },
      { minPower: 100, key: 'dragon', asset: 'fx_dragon' },
    ],
  },
];

export function TeamBattleConfigEditor({
  value,
  onChange,
  availableAssetKeys = [],
  disabled = false,
}: TeamBattleConfigEditorProps) {
  const [activeTab, setActiveTab] = useState<'teams' | 'power' | 'actions' | 'battle' | 'preview'>('teams');
  const [newGiftInputs, setNewGiftInputs] = useState<Record<number, string>>({});

  // Realtime diagnostics
  const validationProblems = validateTeamBattleConfig(value);

  // Detect duplicate gifts across teams
  const giftTeamMap = new Map<string, string[]>();
  value.teams.forEach((t) => {
    (t.giftNames || []).forEach((g) => {
      const norm = g.trim().toLowerCase();
      if (!norm) return;
      const existing = giftTeamMap.get(norm) || [];
      existing.push(t.name || t.key || 'Chưa đặt tên');
      giftTeamMap.set(norm, existing);
    });
  });

  const duplicateGifts = Array.from(giftTeamMap.entries())
    .filter(([_, teams]) => teams.length > 1)
    .map(([gift, teams]) => ({ gift, teams }));

  // Teams helpers
  function addTeam() {
    if (value.teams.length >= TEMPLATE_LIMITS.MAX_TEAMS) return;
    const nextIdx = value.teams.length + 1;
    const nextColor = PRESET_COLORS[value.teams.length % PRESET_COLORS.length];
    const newTeam: BattleTeamConfig = {
      key: `team_${nextIdx}`,
      name: `Phe ${nextIdx}`,
      color: nextColor,
      castleAsset: `castle_team_${nextIdx}`,
      giftNames: [],
    };
    onChange({
      ...value,
      teams: [...value.teams, newTeam],
    });
  }

  function removeTeam(index: number) {
    if (value.teams.length <= TEMPLATE_LIMITS.MIN_TEAMS) return;
    const updated = value.teams.filter((_, i) => i !== index);
    onChange({ ...value, teams: updated });
  }

  function updateTeam(index: number, patch: Partial<BattleTeamConfig>) {
    const updated = value.teams.map((team, i) => {
      if (i !== index) return team;
      return { ...team, ...patch };
    });
    onChange({ ...value, teams: updated });
  }

  function addGiftToTeam(teamIndex: number, giftName: string) {
    const clean = giftName.trim();
    if (!clean) return;
    const team = value.teams[teamIndex];
    if (!team) return;
    const existing = team.giftNames || [];
    if (existing.some((g) => g.toLowerCase() === clean.toLowerCase())) return;
    updateTeam(teamIndex, { giftNames: [...existing, clean] });
    setNewGiftInputs((prev) => ({ ...prev, [teamIndex]: '' }));
  }

  function removeGiftFromTeam(teamIndex: number, giftName: string) {
    const team = value.teams[teamIndex];
    if (!team) return;
    const existing = team.giftNames || [];
    updateTeam(teamIndex, {
      giftNames: existing.filter((g) => g !== giftName),
    });
  }

  // Action tier helpers
  function addActionTier() {
    if (value.actions.length >= TEMPLATE_LIMITS.MAX_ACTION_TIERS) return;
    const highestPower = value.actions.reduce((max, a) => Math.max(max, a.minPower), 0);
    const newTier: BattleActionTier = {
      minPower: highestPower + 50,
      key: `action_${value.actions.length + 1}`,
      asset: `fx_action_${value.actions.length + 1}`,
    };
    const nextActions = [...value.actions, newTier].sort((a, b) => a.minPower - b.minPower);
    onChange({ ...value, actions: nextActions });
  }

  function removeActionTier(index: number) {
    if (value.actions.length <= 1) return;
    const updated = value.actions.filter((_, i) => i !== index);
    onChange({ ...value, actions: updated });
  }

  function updateActionTier(index: number, patch: Partial<BattleActionTier>) {
    const updated = value.actions.map((act, i) => {
      if (i !== index) return act;
      return { ...act, ...patch };
    });
    onChange({ ...value, actions: updated });
  }

  function applyActionPreset(preset: (typeof STANDARD_ACTION_PRESETS)[0]) {
    onChange({
      ...value,
      actions: preset.actions,
      freeEventMaxAction: preset.maxFree,
    });
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {/* Sub-navigation Tabs */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          gap: '0.25rem',
          borderBottom: '1px solid hsl(var(--border))',
          paddingBottom: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'teams'}
          onClick={() => setActiveTab('teams')}
          style={{
            ...tabButtonStyle,
            fontWeight: activeTab === 'teams' ? 700 : 500,
            color: activeTab === 'teams' ? 'hsl(var(--primary))' : 'inherit',
            borderBottom: activeTab === 'teams' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
          }}
        >
          <Icon name="versus" size={16} />
          Các phe ({value.teams.length})
          {duplicateGifts.length > 0 && (
            <span style={pillAlertStyle}>!</span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'power'}
          onClick={() => setActiveTab('power')}
          style={{
            ...tabButtonStyle,
            fontWeight: activeTab === 'power' ? 700 : 500,
            color: activeTab === 'power' ? 'hsl(var(--primary))' : 'inherit',
            borderBottom: activeTab === 'power' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
          }}
        >
          <Icon name="like" size={16} />
          Sức mạnh & Năng lượng
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'actions'}
          onClick={() => setActiveTab('actions')}
          style={{
            ...tabButtonStyle,
            fontWeight: activeTab === 'actions' ? 700 : 500,
            color: activeTab === 'actions' ? 'hsl(var(--primary))' : 'inherit',
            borderBottom: activeTab === 'actions' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
          }}
        >
          <Icon name="spark" size={16} />
          Bậc hoả lực ({value.actions.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'battle'}
          onClick={() => setActiveTab('battle')}
          style={{
            ...tabButtonStyle,
            fontWeight: activeTab === 'battle' ? 700 : 500,
            color: activeTab === 'battle' ? 'hsl(var(--primary))' : 'inherit',
            borderBottom: activeTab === 'battle' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
          }}
        >
          <Icon name="settings" size={16} />
          Thiết lập trận
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'preview'}
          onClick={() => setActiveTab('preview')}
          style={{
            ...tabButtonStyle,
            marginLeft: 'auto',
            fontWeight: activeTab === 'preview' ? 700 : 500,
            color: activeTab === 'preview' ? 'hsl(var(--primary))' : 'inherit',
            borderBottom: activeTab === 'preview' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
          }}
        >
          <Icon name="preview" size={16} />
          Xem sàn đấu
        </button>
      </div>

      {/* Validation banner */}
      {validationProblems.length > 0 && (
        <div
          role="alert"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius)',
            border: '1px solid hsl(var(--destructive))',
            background: 'hsl(var(--destructive) / 0.08)',
            color: 'hsl(var(--destructive))',
            fontSize: '0.85rem',
            display: 'grid',
            gap: '0.25rem',
          }}
        >
          <strong>Cấu hình chưa hợp lệ ({validationProblems.length} vấn đề):</strong>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', listStyle: 'disc' }}>
            {validationProblems.map((prob, i) => (
              <li key={i}>{prob}</li>
            ))}
          </ul>
        </div>
      )}

      {/* TAB 1: TEAMS */}
      {activeTab === 'teams' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <strong style={{ fontSize: '0.95rem' }}>Thiết lập các phe tham chiến</strong>
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
                Khán giả tặng quà nào sẽ tự động gia nhập phe đó. Mỗi món quà chỉ được gán cho duy nhất 1 phe.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={addTeam}
              disabled={disabled || value.teams.length >= TEMPLATE_LIMITS.MAX_TEAMS}
              style={{ fontSize: '0.82rem' }}
            >
              <Icon name="plus" size={14} />
              Thêm phe ({value.teams.length}/{TEMPLATE_LIMITS.MAX_TEAMS})
            </button>
          </div>

          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            {value.teams.map((team, idx) => {
              const hasNoGifts = !team.giftNames || team.giftNames.length === 0;
              const teamHasConflict = team.giftNames?.some((g) =>
                duplicateGifts.some((d) => d.gift.toLowerCase() === g.toLowerCase())
              );

              return (
                <div
                  key={idx}
                  className="card"
                  style={{
                    display: 'grid',
                    gap: '0.75rem',
                    borderLeft: `4px solid ${team.color || '#a78bfa'}`,
                    position: 'relative',
                    background: 'hsl(var(--card))',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: team.color || '#a78bfa',
                          border: '2px solid hsl(var(--card))',
                          boxShadow: '0 0 0 1px hsl(var(--border))',
                          display: 'inline-block',
                        }}
                      />
                      <strong style={{ fontSize: '0.95rem' }}>Phe #{idx + 1}</strong>
                    </div>

                    {value.teams.length > TEMPLATE_LIMITS.MIN_TEAMS && (
                      <button
                        type="button"
                        onClick={() => removeTeam(idx)}
                        disabled={disabled}
                        title="Xoá phe này"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'hsl(var(--destructive))',
                          cursor: 'pointer',
                          padding: '0.2rem',
                        }}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    )}
                  </div>

                  {/* Basic team info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label htmlFor={`team-name-${idx}`} style={smallLabelStyle}>Tên phe</label>
                      <input
                        id={`team-name-${idx}`}
                        value={team.name}
                        onChange={(e) => updateTeam(idx, { name: e.target.value })}
                        placeholder="VD: Vương quốc Mèo"
                        disabled={disabled}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor={`team-key-${idx}`} style={smallLabelStyle}>Mã định danh (Key)</label>
                      <input
                        id={`team-key-${idx}`}
                        value={team.key}
                        onChange={(e) => updateTeam(idx, { key: e.target.value.trim().toLowerCase() })}
                        placeholder="VD: cat"
                        disabled={disabled}
                        style={{ ...inputStyle, fontFamily: 'var(--font-mono), monospace' }}
                      />
                    </div>
                  </div>

                  {/* Color & Castle Asset */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={smallLabelStyle}>Màu chủ đạo</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <input
                          type="color"
                          value={team.color || '#a78bfa'}
                          onChange={(e) => updateTeam(idx, { color: e.target.value })}
                          disabled={disabled}
                          style={{
                            width: '36px',
                            height: '36px',
                            padding: 0,
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            background: 'transparent',
                          }}
                        />
                        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                          {PRESET_COLORS.slice(0, 5).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => updateTeam(idx, { color: c })}
                              disabled={disabled}
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '3px',
                                backgroundColor: c,
                                border: team.color === c ? '2px solid hsl(var(--foreground))' : '1px solid hsl(var(--border))',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label htmlFor={`team-castle-${idx}`} style={smallLabelStyle}>Mã Asset lâu đài</label>
                      {availableAssetKeys.length > 0 ? (
                        <select
                          id={`team-castle-${idx}`}
                          value={team.castleAsset || ''}
                          onChange={(e) => updateTeam(idx, { castleAsset: e.target.value || undefined })}
                          disabled={disabled}
                          style={inputStyle}
                        >
                          <option value="">-- Mặc định --</option>
                          {availableAssetKeys.map((k) => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={`team-castle-${idx}`}
                          value={team.castleAsset || ''}
                          onChange={(e) => updateTeam(idx, { castleAsset: e.target.value.trim() || undefined })}
                          placeholder="VD: castle_cat"
                          disabled={disabled}
                          style={{ ...inputStyle, fontFamily: 'var(--font-mono), monospace' }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Gifts selection */}
                  <div>
                    <label style={smallLabelStyle}>
                      Quà gán cho phe này (Tặng để vào phe):
                    </label>

                    {/* Gifts list / tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.4rem', minHeight: '32px' }}>
                      {(team.giftNames || []).map((gift) => {
                        const isConflict = duplicateGifts.some((d) => d.gift.toLowerCase() === gift.toLowerCase());
                        return (
                          <span
                            key={gift}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              backgroundColor: isConflict
                                ? 'hsl(var(--destructive) / 0.15)'
                                : 'hsl(var(--secondary))',
                              color: isConflict ? 'hsl(var(--destructive))' : 'inherit',
                              border: isConflict
                                ? '1px solid hsl(var(--destructive))'
                                : '1px solid hsl(var(--border))',
                            }}
                          >
                            <Icon name="gift" size={12} />
                            {gift}
                            {!disabled && (
                              <button
                                type="button"
                                onClick={() => removeGiftFromTeam(idx, gift)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: 'inherit',
                                  padding: 0,
                                  display: 'inline-flex',
                                }}
                              >
                                <Icon name="close" size={12} />
                              </button>
                            )}
                          </span>
                        );
                      })}
                    </div>

                    {/* Add gift input & quick tags */}
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <input
                        value={newGiftInputs[idx] || ''}
                        onChange={(e) =>
                          setNewGiftInputs((prev) => ({ ...prev, [idx]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addGiftToTeam(idx, newGiftInputs[idx] || '');
                          }
                        }}
                        placeholder="Nhập tên quà + Enter..."
                        disabled={disabled}
                        style={{ ...inputStyle, fontSize: '0.8rem', minHeight: '36px' }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => addGiftToTeam(idx, newGiftInputs[idx] || '')}
                        disabled={disabled || !newGiftInputs[idx]?.trim()}
                        style={{ padding: '0.4rem 0.75rem', minHeight: '36px', fontSize: '0.8rem' }}
                      >
                        Thêm
                      </button>
                    </div>

                    {/* Quick suggestion suggestions */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.35rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))' }}>Gợi ý nhanh:</span>
                      {COMMON_TIKTOK_GIFTS.slice(0, 6).map((g) => {
                        const isAssigned = (team.giftNames || []).some((x) => x.toLowerCase() === g.toLowerCase());
                        if (isAssigned) return null;
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => addGiftToTeam(idx, g)}
                            disabled={disabled}
                            style={{
                              background: 'transparent',
                              border: '1px dashed hsl(var(--border))',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.1rem 0.35rem',
                              fontSize: '0.7rem',
                              cursor: 'pointer',
                              color: 'hsl(var(--muted-foreground))',
                            }}
                          >
                            +{g}
                          </button>
                        );
                      })}
                    </div>

                    {/* Warnings for this team */}
                    {hasNoGifts && (
                      <p style={{ color: 'hsl(var(--destructive))', fontSize: '0.75rem', marginTop: '0.4rem', margin: 0 }}>
                        ⚠️ Chưa có quà nào được gán — khán giả sẽ không thể tham gia phe này!
                      </p>
                    )}
                    {teamHasConflict && (
                      <p style={{ color: 'hsl(var(--destructive))', fontSize: '0.75rem', marginTop: '0.4rem', margin: 0 }}>
                        ⚠️ Trùng lặp quà với phe khác! Hãy kiểm tra lại danh sách quà.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: POWER & ENERGY */}
      {activeTab === 'power' && (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          {/* Power Multipliers */}
          <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon name="coins" size={18} style={{ color: 'hsl(var(--warning))' }} />
              <strong>Quy đổi hoả lực (Xu-tương-đương / Power)</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
              Mọi sự kiện được quy về điểm năng lượng hoả lực. Quà tặng có power = số xu thật của món quà (1 xu = 1 power).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label htmlFor="power-like" style={smallLabelStyle}>
                  <Icon name="like" size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                  Mỗi lượt Tim (Like)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    id="power-like"
                    type="number"
                    min={0}
                    max={100}
                    value={value.power?.like ?? 1}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        power: { ...value.power, like: Number(e.target.value) || 0 },
                      })
                    }
                    disabled={disabled}
                    style={inputStyle}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>power</span>
                </div>
              </div>

              <div>
                <label htmlFor="power-share" style={smallLabelStyle}>
                  <Icon name="share" size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                  Mỗi lượt Chia sẻ (Share)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    id="power-share"
                    type="number"
                    min={0}
                    max={500}
                    value={value.power?.share ?? 3}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        power: { ...value.power, share: Number(e.target.value) || 0 },
                      })
                    }
                    disabled={disabled}
                    style={inputStyle}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>power</span>
                </div>
              </div>

              <div>
                <label htmlFor="power-follow" style={smallLabelStyle}>
                  <Icon name="follow" size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                  Lượt Theo dõi (Follow)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    id="power-follow"
                    type="number"
                    min={0}
                    max={1000}
                    value={value.power?.follow ?? 10}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        power: { ...value.power, follow: Number(e.target.value) || 0 },
                      })
                    }
                    disabled={disabled}
                    style={inputStyle}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>power</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))' }}>
                  * Chỉ tính 1 lần duy nhất cho mỗi khán giả mỗi trận
                </span>
              </div>
            </div>
          </div>

          {/* Energy Pool (Anti-spam) */}
          <div className="card" style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon name="waveform" size={18} style={{ color: 'hsl(var(--primary))' }} />
              <strong>Bình năng lượng chống spam (Energy Pool)</strong>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
              Dành riêng cho tim và chia sẻ. Khán giả bấm tim liên tục sẽ tiêu hao năng lượng trong bình. Hết bình thì tim vẫn hiện hiệu ứng nhưng không cộng điểm trận.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label htmlFor="energy-capacity" style={smallLabelStyle}>Sức chứa bình (Capacity)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    id="energy-capacity"
                    type="number"
                    min={5}
                    max={200}
                    value={value.energy?.capacity ?? 30}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        energy: { ...value.energy, capacity: Number(e.target.value) || 30 },
                      })
                    }
                    disabled={disabled}
                    style={inputStyle}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>điểm</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))' }}>
                  Tương đương {value.energy?.capacity ?? 30} tim liên tục
                </span>
              </div>

              <div>
                <label htmlFor="energy-refill" style={smallLabelStyle}>Tốc độ hồi năng lượng (Refill)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    id="energy-refill"
                    type="number"
                    step={0.1}
                    min={0.1}
                    max={10}
                    value={value.energy?.refillPerSec ?? 0.5}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        energy: { ...value.energy, refillPerSec: Number(e.target.value) || 0.5 },
                      })
                    }
                    disabled={disabled}
                    style={inputStyle}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>power / giây</span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))' }}>
                  +1 power mỗi {value.energy?.refillPerSec ? (1 / value.energy.refillPerSec).toFixed(1) : '2'} giây
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ACTION TIERS */}
      {activeTab === 'actions' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <strong style={{ fontSize: '0.95rem' }}>Bảng ngưỡng hành động & Hiệu ứng (Action Tiers)</strong>
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
                Khi một sự kiện đạt ngưỡng hoả lực tương ứng, game sẽ phát hiệu ứng đó lên màn hình livestream.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {STANDARD_ACTION_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => applyActionPreset(p)}
                    disabled={disabled}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                  >
                    Mẫu: {p.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={addActionTier}
                disabled={disabled || value.actions.length >= TEMPLATE_LIMITS.MAX_ACTION_TIERS}
                style={{ fontSize: '0.82rem' }}
              >
                <Icon name="plus" size={14} />
                Thêm bậc ({value.actions.length}/{TEMPLATE_LIMITS.MAX_ACTION_TIERS})
              </button>
            </div>
          </div>

          {/* Free event cap setting */}
          <div
            className="card"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
              backgroundColor: 'hsl(var(--accent-surface))',
              border: '1px solid hsl(var(--primary) / 0.2)',
            }}
          >
            <div>
              <strong style={{ fontSize: '0.9rem', color: 'hsl(var(--primary))' }}>
                Trần hoả lực cho sự kiện miễn phí (freeEventMaxAction)
              </strong>
              <p style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', margin: 0 }}>
                Tim / Share / Follow không bao giờ được kích hoạt các đòn lớn như Rồng, Thiên thạch hay Đại bác.
              </p>
            </div>

            <select
              value={value.freeEventMaxAction || ''}
              onChange={(e) => onChange({ ...value, freeEventMaxAction: e.target.value })}
              disabled={disabled}
              style={{ ...inputStyle, minWidth: '180px', fontWeight: 600 }}
            >
              {value.actions.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.key} (ngưỡng ≥ {a.minPower})
                </option>
              ))}
            </select>
          </div>

          {/* Action tiers list */}
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {value.actions.map((action, idx) => {
              const isFreeMax = action.key === value.freeEventMaxAction;
              return (
                <div
                  key={idx}
                  className="card"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 1fr 1fr auto',
                    gap: '0.75rem',
                    alignItems: 'center',
                    padding: '0.6rem 0.9rem',
                    borderLeft: isFreeMax ? '4px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
                  }}
                >
                  <div>
                    <label style={smallLabelStyle}>Ngưỡng Xu/Power</label>
                    <input
                      type="number"
                      min={1}
                      value={action.minPower}
                      onChange={(e) =>
                        updateActionTier(idx, { minPower: Number(e.target.value) || 1 })
                      }
                      disabled={disabled}
                      style={{ ...inputStyle, fontWeight: 700 }}
                    />
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Mã hành động (Key)</label>
                    <input
                      value={action.key}
                      onChange={(e) =>
                        updateActionTier(idx, { key: e.target.value.trim().toLowerCase() })
                      }
                      placeholder="VD: dragon"
                      disabled={disabled}
                      style={{ ...inputStyle, fontFamily: 'var(--font-mono), monospace' }}
                    />
                  </div>

                  <div>
                    <label style={smallLabelStyle}>Mã hiệu ứng (Asset key)</label>
                    {availableAssetKeys.length > 0 ? (
                      <select
                        value={action.asset || ''}
                        onChange={(e) =>
                          updateActionTier(idx, { asset: e.target.value || undefined })
                        }
                        disabled={disabled}
                        style={inputStyle}
                      >
                        <option value="">-- Mặc định --</option>
                        {availableAssetKeys.map((k) => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={action.asset || ''}
                        onChange={(e) =>
                          updateActionTier(idx, { asset: e.target.value.trim() || undefined })
                        }
                        placeholder="VD: fx_dragon"
                        disabled={disabled}
                        style={{ ...inputStyle, fontFamily: 'var(--font-mono), monospace' }}
                      />
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    {value.actions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeActionTier(idx)}
                        disabled={disabled}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'hsl(var(--destructive))',
                          cursor: 'pointer',
                          padding: '0.4rem',
                        }}
                        title="Xoá bậc này"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: BATTLE SETTINGS */}
      {activeTab === 'battle' && (
        <div className="card" style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Icon name="clock" size={18} />
            <strong>Thiết lập trận đấu (Battle Specs)</strong>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div>
              <label htmlFor="battle-duration" style={smallLabelStyle}>
                Thời lượng trận đấu (Duration)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <input
                  id="battle-duration"
                  type="number"
                  min={60}
                  max={7200}
                  step={30}
                  value={value.battle?.durationSec ?? 1200}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      battle: { ...value.battle, durationSec: Number(e.target.value) || 1200 },
                    })
                  }
                  disabled={disabled}
                  style={{ ...inputStyle, fontWeight: 700 }}
                />
                <span style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>
                  giây ({Math.round((value.battle?.durationSec ?? 1200) / 60)} phút)
                </span>
              </div>

              {/* Quick preset duration buttons */}
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                {[300, 600, 900, 1200, 1800].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...value,
                        battle: { ...value.battle, durationSec: sec },
                      })
                    }
                    disabled={disabled}
                    style={{
                      padding: '0.15rem 0.45rem',
                      borderRadius: 'var(--radius-sm)',
                      border:
                        (value.battle?.durationSec ?? 1200) === sec
                          ? '1px solid hsl(var(--primary))'
                          : '1px solid hsl(var(--border))',
                      background:
                        (value.battle?.durationSec ?? 1200) === sec
                          ? 'hsl(var(--primary) / 0.1)'
                          : 'transparent',
                      color:
                        (value.battle?.durationSec ?? 1200) === sec
                          ? 'hsl(var(--primary))'
                          : 'inherit',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {sec / 60}p
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="battle-top-donors" style={smallLabelStyle}>
                Số vị trí TOP DONATE hiển thị
              </label>
              <input
                id="battle-top-donors"
                type="number"
                min={1}
                max={10}
                value={value.battle?.showTopDonors ?? 4}
                onChange={(e) =>
                  onChange({
                    ...value,
                    battle: { ...value.battle, showTopDonors: Number(e.target.value) || 4 },
                  })
                }
                disabled={disabled}
                style={inputStyle}
              />
              <span style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))' }}>
                Vinh danh các đại thần đóng góp nhiều nhất trên HUD
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PREVIEW */}
      {activeTab === 'preview' && (
        <div
          className="card"
          style={{
            display: 'grid',
            gap: '1rem',
            background: 'hsl(var(--secondary) / 0.5)',
            border: '1px solid hsl(var(--border))',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong>Mô phỏng sàn đấu ({value.teams.length} phe)</strong>
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
              Thời lượng: {Math.round((value.battle?.durationSec ?? 1200) / 60)} phút · Top {value.battle?.showTopDonors ?? 4} donate
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${value.teams.length}, 1fr)`,
              gap: '0.75rem',
              minHeight: '200px',
            }}
          >
            {value.teams.map((t, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'hsl(var(--card))',
                  border: `2px solid ${t.color || '#a78bfa'}`,
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  textAlign: 'center',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: t.color || '#a78bfa',
                      margin: '0 auto 0.5rem auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '1.1rem',
                    }}
                  >
                    🏰
                  </div>
                  <strong style={{ fontSize: '0.95rem', color: t.color || 'inherit' }}>
                    {t.name || `Phe ${i + 1}`}
                  </strong>
                  <div style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-mono)' }}>
                    [{t.key}]
                  </div>
                </div>

                <div style={{ marginTop: '0.5rem', width: '100%' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', marginBottom: '0.25rem' }}>
                    Quà gia nhập:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', justifyContent: 'center' }}>
                    {(t.giftNames || []).map((g) => (
                      <span
                        key={g}
                        style={{
                          fontSize: '0.68rem',
                          padding: '0.1rem 0.35rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'hsl(var(--secondary))',
                          border: '1px solid hsl(var(--border))',
                        }}
                      >
                        🎁 {g}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              fontSize: '0.8rem',
              display: 'flex',
              justifyContent: 'space-around',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div>
              ❤️ Tim: <strong>{value.power?.like ?? 1} power</strong>
            </div>
            <div>
              🔄 Share: <strong>{value.power?.share ?? 3} power</strong>
            </div>
            <div>
              ➕ Follow: <strong>{value.power?.follow ?? 10} power</strong>
            </div>
            <div>
              ⚡ Bình năng lượng: <strong>{value.energy?.capacity ?? 30} điểm</strong> (+{value.energy?.refillPerSec ?? 0.5}/s)
            </div>
            <div>
              🛡️ Trần sự kiện miễn phí: <strong>{value.freeEventMaxAction}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const tabButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '0.5rem 0.75rem',
  fontSize: '0.85rem',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  transition: 'all 0.15s ease',
};

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

const pillAlertStyle: React.CSSProperties = {
  backgroundColor: 'hsl(var(--destructive))',
  color: '#ffffff',
  borderRadius: '50%',
  width: '14px',
  height: '14px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.65rem',
  fontWeight: 700,
};
