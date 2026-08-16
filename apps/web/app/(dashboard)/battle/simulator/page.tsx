'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { api } from '../../../../lib/api-client';
import { BattleState, BattleTeamState, BATTLE_MAP_PRESETS } from '@livenova/shared';
import { BattleOverlayContent } from '../../../../components/battle/BattleOverlayContent';
import { Icon } from '../../../../components/ui/Icon';
import { VsConfig } from '../../../../components/battle/VsConfig';
import { useAuth } from '../../../../context/AuthContext';

export default function BattleSimulatorPage() {
  const { user } = useAuth();
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTeamKey, setSelectedTeamKey] = useState('cat');
  const [sender, setSender] = useState('@meo_cutee');
  const [copied, setCopied] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [switchingMap, setSwitchingMap] = useState(false);
  const [publicToken, setPublicToken] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const data = await api.get<BattleState>('/battle/state');
      setBattleState(data);
    } catch (err) {
      console.error('Failed to fetch battle state:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOverlayToken = useCallback(async () => {
    try {
      const overlays = await api.get<Array<{ id: string; type: string; publicToken: string }>>('/overlays');
      const battleOverlay = overlays.find((o) => o.type === 'GAME_BATTLE');
      if (battleOverlay) {
        setPublicToken(battleOverlay.publicToken);
      }
    } catch (err) {
      console.error('Failed to fetch overlays:', err);
    }
  }, []);

  useEffect(() => {
    fetchState();
    fetchOverlayToken();
  }, [fetchState, fetchOverlayToken]);

  const handleSimulate = async (
    teamKey: string,
    eventType: 'GIFT' | 'LIKE' | 'SHARE' | 'FOLLOW' | 'COMMENT',
    giftName?: string,
    giftCount = 1,
  ) => {
    setSimulating(true);
    try {
      const updated = await api.post<BattleState>('/battle/simulate', {
        sender: sender.trim() || '@khangia',
        teamKey,
        eventType,
        giftName,
        giftCount,
      });
      setBattleState(updated);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSimulating(false);
    }
  };

  const handleMapChange = async (mapThemeId: string) => {
    setSwitchingMap(true);
    try {
      const updated = await api.post<BattleState>('/battle/map-theme', {
        mapTheme: mapThemeId,
      });
      setBattleState(updated);
    } catch (err) {
      console.error('Map switch error:', err);
    } finally {
      setSwitchingMap(false);
    }
  };

  const [switchingEngine, setSwitchingEngine] = useState(false);

  const handleEngineChange = async (engine: '2d' | '3d') => {
    setSwitchingEngine(true);
    try {
      const updated = await api.post<BattleState>('/battle/render-engine', {
        renderEngine: engine,
      });
      setBattleState(updated);
    } catch (err) {
      console.error('Engine switch error:', err);
    } finally {
      setSwitchingEngine(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Bạn có chắc muốn đặt lại toàn bộ hiệp đấu 4 Vương Quốc?')) return;
    try {
      const updated = await api.post<BattleState>('/battle/reset', {});
      setBattleState(updated);
    } catch (err) {
      console.error('Reset error:', err);
    }
  };

  const copyObsUrl = () => {
    if (!publicToken) return;
    let origin = window.location.origin;
    if (process.env.NEXT_PUBLIC_OVERLAY_URL) {
      origin = process.env.NEXT_PUBLIC_OVERLAY_URL.replace(/\/$/, '');
    }
    const url = `${origin}/overlays/battle?token=${publicToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPreviewHref = () => {
    let origin = typeof window === 'undefined' ? '' : window.location.origin;
    if (process.env.NEXT_PUBLIC_OVERLAY_URL) {
      origin = process.env.NEXT_PUBLIC_OVERLAY_URL.replace(/\/$/, '');
    }
    return publicToken ? `${origin}/overlays/battle?token=${publicToken}` : `${origin}/overlays/battle`;
  };

  const currentTeam: BattleTeamState =
    battleState?.teams.find((t) => t.key === selectedTeamKey) ||
    battleState?.teams[0] || {
      key: 'cat',
      name: 'Vương quốc Mèo 🐱',
      color: '#a855f7',
      score: 0,
      energy: 100,
      castleHp: 1000,
      maxHp: 1000,
      giftNames: [],
    };

  const activeMapId = battleState?.mapTheme || 'fantasy_kingdoms';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minHeight: '100%' }}>
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid hsl(var(--border))',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 34,
                height: 34,
                borderRadius: 'var(--radius-sm)',
                background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                color: '#fff',
              }}
            >
              <Icon name="versus" size={20} weight="bold" />
            </span>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, color: 'hsl(var(--foreground))' }}>
              Đại Chiến 4 Vương Quốc (Kingdom War Live Simulator)
            </h1>
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
            Trình mô phỏng chiến sự chia 4 phe (Mèo 🐱 vs Chó 🐶 vs Gấu 🐻 vs Capybara 🦫), hỗ trợ đổi bản đồ AI Gen, triệu hồi rồng nước, ném bom và bắn đại bác.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <button
            type="button"
            onClick={handleReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.5rem 0.875rem',
              borderRadius: 'var(--radius)',
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Icon name="rotate" size={16} />
            <span>Đặt lại hiệp đấu</span>
          </button>

          {publicToken && (
            <button
              type="button"
              onClick={copyObsUrl}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.5rem 0.875rem',
                borderRadius: 'var(--radius)',
                border: '1px solid hsl(var(--primary))',
                background: 'hsl(var(--accent-surface))',
                color: 'hsl(var(--primary-hover))',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Icon name={copied ? 'check' : 'copy'} size={16} />
              <span>{copied ? 'Đã sao chép link OBS!' : 'Sao chép link OBS'}</span>
            </button>
          )}

          <a
            href={getPreviewHref()}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.5rem 0.875rem',
              borderRadius: 'var(--radius)',
              background: 'linear-gradient(135deg, hsl(var(--primary)), #ec4899)',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 700,
              textDecoration: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <Icon name="preview" size={16} />
            <span>Mở toàn màn hình OBS</span>
          </a>
        </div>
      </div>

      {/* ── RENDER ENGINE SELECTOR TOOLBAR ──────────────────────────────────── */}
      <div
        className="card"
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🎮</span>
            <div>
              <strong style={{ fontSize: '0.95rem', color: 'hsl(var(--foreground))' }}>
                Động Cơ Đồ Họa (Render Engine Mode)
              </strong>
              <div style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' }}>
                Chuyển đổi giữa 2D AI Sprite Sheet (siêu mượt 60 FPS) và 3D Low-Poly WebGL (Three.js sống động)
              </div>
            </div>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'hsl(var(--primary))', fontWeight: 600 }}>
            {switchingEngine ? 'Đang chuyển đổi động cơ...' : `Đang chạy: ${battleState?.renderEngine === '3d' ? '🪐 3D Three.js' : '🎮 2D Canvas (Mặc định)'}`}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {/* 2D Option */}
          <button
            type="button"
            disabled={switchingEngine}
            onClick={() => handleEngineChange('2d')}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.875rem',
              padding: '0.875rem',
              borderRadius: 'var(--radius)',
              border: (battleState?.renderEngine || '2d') === '2d' ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
              background: (battleState?.renderEngine || '2d') === '2d' ? 'hsl(var(--accent-surface))' : 'hsl(var(--background))',
              boxShadow: (battleState?.renderEngine || '2d') === '2d' ? '0 0 16px hsl(var(--primary) / 0.25)' : 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #a855f7, #3b82f6)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '1.4rem',
                flexShrink: 0,
              }}
            >
              🏃
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'hsl(var(--foreground))' }}>
                  2D AI Sprite Sheets (Mặc định)
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'hsl(var(--primary) / 0.15)',
                    color: 'hsl(var(--primary))',
                  }}
                >
                  Khuyên dùng
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.4 }}>
                Hoạt ảnh 6 khung hình sải bước chạy, thanh máu mini trên đầu, tối ưu CPU OBS dưới 2%, 60 FPS mượt mà.
              </span>
            </div>
          </button>

          {/* 3D Option */}
          <button
            type="button"
            disabled={switchingEngine}
            onClick={() => handleEngineChange('3d')}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.875rem',
              padding: '0.875rem',
              borderRadius: 'var(--radius)',
              border: battleState?.renderEngine === '3d' ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
              background: battleState?.renderEngine === '3d' ? 'hsl(var(--accent-surface))' : 'hsl(var(--background))',
              boxShadow: battleState?.renderEngine === '3d' ? '0 0 16px hsl(var(--primary) / 0.25)' : 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #06b6d4, #6366f1)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '1.4rem',
                flexShrink: 0,
              }}
            >
              🪐
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'hsl(var(--foreground))' }}>
                  3D Three.js WebGL (Tùy chọn 2)
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#6366f1',
                  }}
                >
                  Đồ họa 3D
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.4 }}>
                4 lâu đài 3D phát sáng, đài tinh thể năng lượng lơ lửng, lính 3D chibi chém kiếm, hỗ trợ camera Cinematic 3D.
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* ── MAP THEME SELECTOR TOOLBAR ──────────────────────────────────────── */}
      <div
        className="card"
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🗺️</span>
            <strong style={{ fontSize: '0.95rem', color: 'hsl(var(--foreground))' }}>
              Chọn Bản Đồ Chiến Trường (AI Gen Map Themes)
            </strong>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))' }}>
            {switchingMap ? 'Đang cập nhật bản đồ...' : 'Thay đổi ngay lập tức trên OBS & Livestream'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
          {BATTLE_MAP_PRESETS.map((preset) => {
            const isActive = activeMapId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={switchingMap}
                onClick={() => handleMapChange(preset.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.625rem',
                  borderRadius: 'var(--radius)',
                  border: isActive ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
                  background: isActive ? 'hsl(var(--accent-surface))' : 'hsl(var(--background))',
                  boxShadow: isActive ? '0 0 16px hsl(var(--primary) / 0.25)' : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ position: 'relative', width: 64, height: 48, borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0 }}>
                  <img
                    src={preset.thumbnail}
                    alt={preset.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {isActive && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(124, 58, 237, 0.4)',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                      }}
                    >
                      ✓
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isActive ? 'hsl(var(--primary-hover))' : 'hsl(var(--foreground))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {preset.name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.15rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {preset.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MAIN WORKSPACE: BATTLEFIELD ARENA + SIMULATION CONTROLS ────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
        {/* ── LEFT: 4-WAY BATTLE ARENA VIEWFINDER ──────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              position: 'relative',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              background: '#07110d',
              border: '2px solid hsl(var(--border))',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)',
              // 9:16, because that is what TikTok Live is. The preview used to
              // be 16/10, so every layout decision on this page was reviewed at
              // a shape the broadcast never has — which is how four castles
              // ended up cropped off the map without anyone noticing.
              aspectRatio: '9/16',
              maxHeight: '78vh',
              margin: '0 auto',
            }}
          >
            {loading ? (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#94a3b8' }}>
                Đang khởi tạo chiến trường 4 Vương quốc...
              </div>
            ) : (
              <Suspense fallback={<div>Đang tải đồ họa...</div>}>
                <BattleOverlayContent
                  customState={battleState || undefined}
                  onCardClick={(actionKey, giftName) => handleSimulate(selectedTeamKey, 'GIFT', giftName, 1)}
                />
              </Suspense>
            )}
          </div>

          {/* ── LIVE COMBAT FEED ─────────────────────────────────────────── */}
          <div
            style={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
              padding: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', color: 'hsl(var(--foreground))' }}>
                <Icon name="spark" size={18} />
                <span>Nhật ký Chiến sự Trực tiếp</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                {battleState?.recentEvents?.length || 0} hành động gần nhất
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '160px', overflowY: 'auto' }}>
              {!battleState?.recentEvents || battleState.recentEvents.length === 0 ? (
                <div style={{ fontSize: '0.825rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center', padding: '1rem' }}>
                  Chưa có hành động nào. Hãy chọn phe và bấm các kỹ năng bên phải để xuất binh!
                </div>
              ) : (
                battleState.recentEvents.map((evt) => {
                  const team = battleState.teams.find((t) => t.key === evt.teamKey);
                  return (
                    <div
                      key={evt.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'hsl(var(--accent-surface))',
                        borderLeft: `4px solid ${team?.color || '#a855f7'}`,
                        fontSize: '0.825rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: 'hsl(var(--foreground))' }}>{evt.sender}</span>
                        <span style={{ color: 'hsl(var(--muted-foreground))' }}>đã buff cho</span>
                        <span style={{ fontWeight: 700, color: team?.color || 'hsl(var(--foreground))' }}>
                          {team?.name || evt.teamKey}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 800 }}>
                        <span>{evt.giftName || evt.actionKey}</span>
                        <span style={{ color: 'hsl(var(--primary))' }}>+{evt.powerAdded} pts</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: SIMULATION CONTROLS FOR 4 KINGDOMS ───────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* 1. Sender Account Selector */}
          <div
            style={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
              padding: '1rem',
            }}
          >
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'hsl(var(--foreground))' }}>
              Tên khán giả Giả lập
            </label>
            <input
              type="text"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="VD: @meo_cutee"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                fontSize: '0.875rem',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />

            {/* Quick Sender Presets */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.5rem' }}>
              {['@meo_cutee', '@doggo_boss', '@gau_truc_no1', '@capy_chill', `@${user?.email?.split('@')[0] || 'streamer'}`].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setSender(chip)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid hsl(var(--border))',
                    background: sender === chip ? 'hsl(var(--accent-surface))' : 'transparent',
                    color: sender === chip ? 'hsl(var(--primary-hover))' : 'hsl(var(--muted-foreground))',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Kingdom Selector (4 Tabs) */}
          <div
            style={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
              padding: '1rem',
            }}
          >
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'hsl(var(--foreground))' }}>
              Chọn vương quốc Tác động
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {[
                { key: 'cat', name: 'Mèo 🐱', color: '#a855f7', label: 'Tây Bắc' },
                { key: 'dog', name: 'Chó 🐶', color: '#3b82f6', label: 'Đông Bắc' },
                { key: 'bear', name: 'Gấu 🐻', color: '#ea580c', label: 'Tây Nam' },
                { key: 'capy', name: 'Capy 🦫', color: '#10b981', label: 'Đông Nam' },
              ].map((k) => {
                const isSelected = selectedTeamKey === k.key;
                return (
                  <button
                    key={k.key}
                    type="button"
                    onClick={() => setSelectedTeamKey(k.key)}
                    style={{
                      padding: '0.625rem',
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected ? `2px solid ${k.color}` : '1px solid hsl(var(--border))',
                      background: isSelected ? `${k.color}22` : 'hsl(var(--background))',
                      color: isSelected ? k.color : 'hsl(var(--foreground))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    <span>{k.name}</span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{k.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Skill & Gift Actions */}
          <div
            style={{
              background: 'hsl(var(--card))',
              border: `1.5px solid ${currentTeam.color}66`,
              borderRadius: 'var(--radius)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>⚡</span>
                <span style={{ fontWeight: 800, color: currentTeam.color }}>
                  Kỹ năng Vương quốc {currentTeam.name}
                </span>
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>
                Điểm: {currentTeam.score || 0}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={simulating}
                onClick={() => handleSimulate(selectedTeamKey, 'GIFT', 'Rose', 1)}
                style={{
                  padding: '0.625rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>🐱</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Triệu hồi lính (+1)</span>
                <span style={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))' }}>🌹 Hoa hồng</span>
              </button>

              <button
                type="button"
                disabled={simulating}
                onClick={() => handleSimulate(selectedTeamKey, 'GIFT', 'Perfume', 1)}
                style={{
                  padding: '0.625rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>🏰</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Xây thành (+10)</span>
                <span style={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))' }}>🌸 Nước hoa</span>
              </button>

              <button
                type="button"
                disabled={simulating}
                onClick={() => handleSimulate(selectedTeamKey, 'GIFT', 'Donut', 1)}
                style={{
                  padding: '0.625rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>💣</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Ném bom (+50)</span>
                <span style={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))' }}>🍩 Bánh Donut</span>
              </button>

              <button
                type="button"
                disabled={simulating}
                onClick={() => handleSimulate(selectedTeamKey, 'GIFT', 'Dragon', 1)}
                style={{
                  padding: '0.625rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #10b981',
                  background: 'linear-gradient(135deg, #10b98122, #05966911)',
                  color: '#10b981',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>🐉</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>Gọi Rồng Nước (+99)</span>
                <span style={{ fontSize: '0.65rem' }}>🐲 Thần Rồng</span>
              </button>

              <button
                type="button"
                disabled={simulating}
                onClick={() => handleSimulate(selectedTeamKey, 'GIFT', 'Cannon', 1)}
                style={{
                  padding: '0.625rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #f59e0b',
                  background: 'linear-gradient(135deg, #f59e0b22, #d9770611)',
                  color: '#d97706',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>💥</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>Bắn đại bác (+199)</span>
                <span style={{ fontSize: '0.65rem' }}>🎆 Pháo hoa</span>
              </button>

              <button
                type="button"
                disabled={simulating}
                onClick={() => handleSimulate(selectedTeamKey, 'GIFT', 'Universe', 1)}
                style={{
                  padding: '0.625rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #ec4899',
                  background: 'linear-gradient(135deg, #ec489922, #db277711)',
                  color: '#db2777',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>☄️</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>Thiên thạch (+999)</span>
                <span style={{ fontSize: '0.65rem' }}>🌌 Vũ trụ diệt thế</span>
              </button>
            </div>
          </div>

          {/* 4. Live Room Actions */}
          <div
            style={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
              ⚡ Tương tác Phòng Live (Like / Share / Follow)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={simulating}
                onClick={() => handleSimulate(selectedTeamKey, 'LIKE', undefined, 1)}
                style={{
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--background))',
                  color: '#f43f5e',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem',
                }}
              >
                <span>❤️ Like (+1)</span>
              </button>

              <button
                type="button"
                disabled={simulating}
                onClick={() => handleSimulate(selectedTeamKey, 'SHARE', undefined, 1)}
                style={{
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--background))',
                  color: '#0ea5e9',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem',
                }}
              >
                <span>🔁 Share (+3)</span>
              </button>

              <button
                type="button"
                disabled={simulating}
                onClick={() => handleSimulate(selectedTeamKey, 'FOLLOW', undefined, 1)}
                style={{
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--background))',
                  color: '#10b981',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem',
                }}
              >
                <span>➕ Follow (+10)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── VS CONFIGURATION ──────────────────────────────────────────────── */}
      <div className="card" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <VsConfig />
      </div>
    </div>
  );
}
