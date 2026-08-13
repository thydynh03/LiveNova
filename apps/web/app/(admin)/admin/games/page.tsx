'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdminPageHeader, Panel, StatTile } from '../../../../components/admin/AdminShell';
import { api } from '../../../../lib/api-client';
import { BattleState } from '@livenova/shared';

export default function AdminGamesPage() {
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [sender, setSender] = useState('@admin_tester');
  const [teamKey, setTeamKey] = useState('cat');
  const [simulating, setSimulating] = useState(false);
  const [engineUpdating, setEngineUpdating] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const data = await api.get<BattleState>('/battle/state');
      setBattleState(data);
    } catch (_err) {
      console.error('Failed to fetch battle state:', _err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const handleSimulate = async (type: 'GIFT' | 'LIKE') => {
    try {
      setSimulating(true);
      await api.post('/battle/simulate', {
        sender,
        teamKey,
        eventType: type,
        amount: type === 'GIFT' ? 10 : 1,
      });
      await fetchState();
    } catch (_err) {
      console.error('Simulation failed:', _err);
      alert('Gọi lính thất bại');
    } finally {
      setSimulating(false);
    }
  };

  const handleSwitchEngine = async (mode: '2d' | '3d') => {
    try {
      setEngineUpdating(true);
      await api.post('/battle/render-engine', { renderEngine: mode });
      await fetchState();
    } catch {
      alert('Lỗi chuyển chế độ Render');
    } finally {
      setEngineUpdating(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Bạn có chắc chắn muốn reset toàn bộ trạng thái Game?')) return;
    try {
      await api.post('/battle/reset', {});
      await fetchState();
    } catch {
      alert('Lỗi reset trận');
    }
  };


  return (
    <main className="admin-page">
      <AdminPageHeader
        title="Game Control Panel"
        description="Quản lý và điều khiển trạng thái Đấu trường 4-Way toàn cầu."
        actions={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={handleReset}>
              🔄 Reset Trận Đấu
            </button>
          </div>
        }
      />

      <div className="admin-split">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Panel title="Điều khiển Game" subtitle="Thao tác trực tiếp vào trận đấu đang diễn ra">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="text-sm text-[var(--muted-foreground)] font-semibold block mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  1. Render Engine (Đồ hoạ)
                </label>
                <div className="admin-segmented" style={{ width: '100%', display: 'flex' }}>
                  <button
                    className={battleState?.renderEngine !== '3d' ? 'is-active' : ''}
                    onClick={() => handleSwitchEngine('2d')}
                    disabled={engineUpdating}
                    style={{ flex: 1 }}
                  >
                    🚀 2D Sprite (Tối ưu)
                  </button>
                  <button
                    className={battleState?.renderEngine === '3d' ? 'is-active' : ''}
                    onClick={() => handleSwitchEngine('3d')}
                    disabled={engineUpdating}
                    style={{ flex: 1 }}
                  >
                    🌟 3D Three.js
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-[var(--muted-foreground)] font-semibold block mb-2" style={{ color: 'var(--muted-foreground)' }}>
                  2. Thả lính (Mô phỏng sự kiện)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="input"
                    value={sender}
                    onChange={(e) => setSender(e.target.value)}
                    placeholder="Tên người gửi"
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
                  />
                  <select
                    className="input"
                    value={teamKey}
                    onChange={(e) => setTeamKey(e.target.value)}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
                  >
                    <option value="cat">Phe Mèo (Đỏ)</option>
                    <option value="dog">Phe Chó (Xanh)</option>
                    <option value="bear">Phe Gấu (Tím)</option>
                    <option value="capy">Phe Capy (Vàng)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    className="btn-primary"
                    onClick={() => handleSimulate('GIFT')}
                    disabled={simulating}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    🎁 Gọi lính tinh nhuệ
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => handleSimulate('LIKE')}
                    disabled={simulating}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}
                  >
                    ❤️ Gọi bộ binh (Like)
                  </button>
                </div>
              </div>
            </div>
          </Panel>
          
          <Panel title="Trạng thái hiện tại" tone="muted">
            {loading ? (
              <p style={{ color: 'var(--foreground)' }}>Đang tải...</p>
            ) : battleState ? (
              <div className="admin-tile-grid">
                <StatTile icon="users" label="Lính phe Mèo" value={String(battleState.teams.find(t => t.key === 'cat')?.soldierCount || 0)} />
                <StatTile icon="users" label="Lính phe Chó" value={String(battleState.teams.find(t => t.key === 'dog')?.soldierCount || 0)} />
                <StatTile icon="users" label="Lính phe Gấu" value={String(battleState.teams.find(t => t.key === 'bear')?.soldierCount || 0)} />
                <StatTile icon="users" label="Lính phe Capy" value={String(battleState.teams.find(t => t.key === 'capy')?.soldierCount || 0)} />
              </div>
            ) : (
              <p style={{ color: 'var(--foreground)' }}>Chưa có dữ liệu trận đấu.</p>
            )}
          </Panel>
        </div>

        <div style={{ flex: 1 }}>
          <Panel title="Live Preview">
            <div style={{ aspectRatio: '16/9', background: '#000', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <iframe
                src={`/overlays/battle?token=${battleState?.battleId || 'admin'}`}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Battle Preview"
                allowTransparency
              />
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-2 text-center" style={{ color: 'var(--muted-foreground)' }}>
              Khung hình hiển thị 16:9, tương đương 1920x1080 trên OBS.
            </p>
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  let origin = typeof window !== 'undefined' ? window.location.origin : '';
                  if (process.env.NEXT_PUBLIC_OVERLAY_URL) {
                    origin = process.env.NEXT_PUBLIC_OVERLAY_URL.replace(/\/$/, '');
                  }
                  const url = `${origin}/overlays/battle?token=${battleState?.battleId || 'admin'}`;
                  navigator.clipboard.writeText(url).then(() => alert('Đã chép link OBS: ' + url));
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  background: 'var(--secondary)',
                  color: 'var(--secondary-foreground)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer'
                }}
              >
                📋 Sao chép link OBS
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}
