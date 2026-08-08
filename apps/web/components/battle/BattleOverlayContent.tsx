'use client';

/*
 * Extracted from app/overlays/battle/page.tsx.
 *
 * A Next.js page module may only export `default` plus a fixed set of route
 * options; exporting the component as well made `next build` fail. The
 * simulator needs the same renderer, so it lives here and both import it.
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { OverlayState, BattleState, CINEMATIC_ACTIONS, troopSpriteUrl } from '@livenova/shared';
import { useOverlaySocket } from '../../lib/use-overlay-socket';
import { BattleMap, type LaneKey } from './BattleMap';
import { TroopCanvas, type TroopCanvasHandle, type Troop } from './TroopCanvas';
import { CastleLayer } from './CastleLayer';
import { preload } from '../../lib/image-cache';
import { SkillCinematic, type CinematicRequest } from './SkillCinematic';

/** Lane each kingdom marches down, and the colour its units are drawn in. */
const LANE_OF: Record<string, string> = {
  cat: 'cat',
  dog: 'dog',
  bear: 'bear',
  capy: 'capy',
};

const TEAM_COLOUR: Record<string, string> = {
  cat: '#c084fc',
  dog: '#60a5fa',
  bear: '#fb923c',
  capy: '#34d399',
};

interface Shockwave {
  id: string;
  x: number;
  y: number;
  type: 'clash' | 'bomb' | 'dragon' | 'meteor' | 'cannon';
  createdAt: number;
}

interface FloatingText {
  id: string;
  text: string;
  color: string;
  x: number;
  y: number;
  createdAt: number;
}

const DEFAULT_4_KINGDOMS_STATE: BattleState = {
  kind: 'battle',
  battleId: 'demo_kingdom_war',
  title: 'CUỘC CHIẾN 4 VƯƠNG QUỐC',
  teams: [
    {
      key: 'cat',
      name: 'VƯƠNG QUỐC MÈO',
      color: '#c084fc',
      score: 3400,
      energy: 85,
      castleHp: 1000,
      maxHp: 1000,
      giftNames: ['Rose', 'Hoa Hồng'],
      quote: 'MEOW~ ĐỨA NÀO CẢN BỔN TỌA? 😼',
      motto: 'ĂN CHƠI KHÔNG SỢ MƯA RƠI 🐾',
      position: 'top-left',
      soldierCount: 1000,
    },
    {
      key: 'dog',
      name: 'VƯƠNG QUỐC CHÓ',
      color: '#60a5fa',
      score: 2200,
      energy: 70,
      castleHp: 1000,
      maxHp: 1000,
      giftNames: ['Perfume', 'Nước Hoa'],
      quote: 'GÂU GÂU! ĐẾN ĐÂY XEM AI GÂU HƠN! 🐶',
      motto: 'ĐOÀN KẾT LÀ SỨC MẠNH GÂU! 💪',
      position: 'top-right',
      soldierCount: 650,
    },
    {
      key: 'bear',
      name: 'VƯƠNG QUỐC GẤU',
      color: '#fb923c',
      score: 2400,
      energy: 90,
      castleHp: 1000,
      maxHp: 1000,
      giftNames: ['Donut', 'Bánh Donut'],
      quote: 'GRÙÙÙ! AI ĐỤNG VÀO LÀ ĐẬP NÁT! 🐻',
      motto: 'GẤU CHỐNG NGẠI AI? CHỈ NGẠI ĐÓI!',
      position: 'bottom-left',
      soldierCount: 800,
    },
    {
      key: 'capy',
      name: 'VƯƠNG QUỐC CAPYBARA',
      color: '#34d399',
      score: 2000,
      energy: 100,
      castleHp: 1000,
      maxHp: 1000,
      giftNames: ['Dragon', 'Thần Rồng'],
      quote: 'BÌNH TĨNH SỐNG CHILL PHÁ LÀNG TỪ TỪ... 🌿',
      motto: 'CHILL LÀ SỨC MẠNH CAPY! 😎',
      position: 'bottom-right',
      soldierCount: 500,
    },
  ],
  topDonors: [
    { username: '@meo_cutee', nickname: 'MèoCutee', teamKey: 'cat', totalScore: 25600 },
    { username: '@doggo_boss', nickname: 'DoggoBoss', teamKey: 'dog', totalScore: 18700 },
    { username: '@gau_truc_no1', nickname: 'GấuTrúcNo1', teamKey: 'bear', totalScore: 15300 },
    { username: '@capy_chill', nickname: 'CapyChill', teamKey: 'capy', totalScore: 12900 },
  ],
  recentEvents: [],
  winnerTeamKey: null,
  endsAtMs: Date.now() + 1127000, // 00:18:47
  active: true,
};

export function BattleOverlayContent({
  customState,
  onCardClick,
}: {
  customState?: BattleState;
  onCardClick?: (actionKey: string, giftName: string, power: number) => void;
}) {
  const searchParams = useSearchParams();
  const token = searchParams ? searchParams.get('token') : null;
  const [battle, setBattle] = useState<BattleState>(customState || DEFAULT_4_KINGDOMS_STATE);
  const troopCanvasRef = useRef<TroopCanvasHandle | null>(null);
  const [cinematic, setCinematic] = useState<CinematicRequest | null>(null);
  const cinematicQueueRef = useRef<CinematicRequest[]>([]);
  const [shockwaves, setShockwaves] = useState<Shockwave[]>([]);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [screenShake, setScreenShake] = useState(false);
  const [activeSpeech, setActiveSpeech] = useState<Record<string, string>>({});
  const lastEventCountRef = useRef(0);

  useEffect(() => {
    if (customState) {
      setBattle(customState);
    }
  }, [customState]);

  useEffect(() => {
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
  }, []);

  const handleState = useCallback((state: OverlayState) => {
    if (state.kind === 'battle') {
      setBattle(state);
    }
  }, []);

  const noop = useCallback(() => undefined, []);
  useOverlaySocket(token, {
    onAction: noop,
    onState: handleState,
  });

  // Calculate percentage of each kingdom
  const teamCat = battle.teams.find((t) => t.key === 'cat') || battle.teams[0];
  const teamDog = battle.teams.find((t) => t.key === 'dog') || battle.teams[1];
  const teamBear = battle.teams.find((t) => t.key === 'bear') || battle.teams[2];
  const teamCapy = battle.teams.find((t) => t.key === 'capy') || battle.teams[3];

  const totalScore = Math.max(1, (teamCat?.score || 0) + (teamDog?.score || 0) + (teamBear?.score || 0) + (teamCapy?.score || 0));
  const catPct = Math.round(((teamCat?.score || 0) / totalScore) * 100);
  const bearPct = Math.round(((teamBear?.score || 0) / totalScore) * 100);
  const dogPct = Math.round(((teamDog?.score || 0) / totalScore) * 100);
  const capyPct = Math.max(0, 100 - (catPct + bearPct + dogPct));

  // Spawn troops & floating texts on recent events
  useEffect(() => {
    if (battle.recentEvents.length > lastEventCountRef.current) {
      const newEvt = battle.recentEvents[0];
      if (newEvt) {
        let startX = 22;
        let startY = 22;

        if (newEvt.teamKey === 'dog') {
          startX = 78;
          startY = 22;
        } else if (newEvt.teamKey === 'bear') {
          startX = 22;
          startY = 72;
        } else if (newEvt.teamKey === 'capy') {
          startX = 78;
          startY = 72;
        }

        // Stage 2 of the response: the march. This is where the audience sees
        // a gift turn into force, so it starts immediately and takes a second
        // or two rather than snapping to the middle.
        const colour = TEAM_COLOUR[newEvt.teamKey] ?? '#e2e8f0';
        const isBig = CINEMATIC_ACTIONS.includes(newEvt.actionKey);
        const squad: Troop[] = Array.from({ length: isBig ? 6 : 3 }).map((_, i) => ({
          id: `${newEvt.id}_${i}`,
          teamKey: newEvt.teamKey,
          lane: (LANE_OF[newEvt.teamKey] ?? 'cat') as LaneKey,
          type: newEvt.actionKey || 'soldier',
          colour,
          // Negative start staggers the squad so it reads as a column, not a dot.
          progress: i * -0.08,
          speed: isBig ? 0.85 : 0.55,
          offset: (Math.random() - 0.5) * 22,
          spriteUrl: troopSpriteUrl(newEvt.teamKey, battle.assets),
        }));
        troopCanvasRef.current?.spawn(squad);

        // Stage 3 for the expensive tiers: the screen itself reacts. Queued so
        // two whales in the same second do not fight over the video element.
        const fxUrl = battle.assets?.[`fx_${newEvt.actionKey}`];
        if (isBig && fxUrl) {
          cinematicQueueRef.current.push({
            id: newEvt.id,
            actionKey: newEvt.actionKey,
            videoUrl: fxUrl,
            senderLabel: `${newEvt.sender} · ${newEvt.giftName ?? ''}`.trim(),
          });
          setCinematic((current) => current ?? cinematicQueueRef.current.shift() ?? null);
        }

        // Spawn floating combat text
        const powerText = newEvt.actionKey === 'meteor' ? '☄️ METEOR +999!' : newEvt.actionKey === 'dragon' ? '🐉 DRAGON +99!' : newEvt.actionKey === 'bomb' ? '💣 BOOM +50!' : `+${newEvt.powerAdded} ⚔️`;
        const color = newEvt.teamKey === 'cat' ? '#c084fc' : newEvt.teamKey === 'dog' ? '#60a5fa' : newEvt.teamKey === 'bear' ? '#fb923c' : '#34d399';
        
        setFloatingTexts((prev) => [
          ...prev.slice(-8),
          {
            id: `ft_${Date.now()}_${Math.random()}`,
            text: powerText,
            color,
            x: startX + (Math.random() - 0.5) * 6,
            y: startY + (Math.random() - 0.5) * 6,
            createdAt: Date.now(),
          },
        ]);

        // Pop speech bubble
        if (newEvt.quote) {
          setActiveSpeech((prev) => ({ ...prev, [newEvt.teamKey]: newEvt.quote || '' }));
          setTimeout(() => {
            setActiveSpeech((prev) => {
              const updated = { ...prev };
              delete updated[newEvt.teamKey];
              return updated;
            });
          }, 3500);
        }

        // Action shockwave & screen tremor
        if (['bomb', 'dragon', 'cannon', 'meteor'].includes(newEvt.actionKey)) {
          setScreenShake(true);
          setTimeout(() => setScreenShake(false), 450);
          setShockwaves((prev) => [
            ...prev.slice(-4),
            { id: `shock_${Date.now()}`, x: 50, y: 50, type: newEvt.actionKey as Shockwave['type'], createdAt: Date.now() },
          ]);
        }
      }
    }
    lastEventCountRef.current = battle.recentEvents.length;
  }, [battle.recentEvents]);

  // Housekeeping only. Motion lives in TroopCanvas, driven by
  // requestAnimationFrame — the old 30ms setInterval re-rendered the whole
  // React tree 33 times a second while OBS was encoding.
  useEffect(() => {
    const timer = setInterval(() => {
      setFloatingTexts((prev) => prev.filter((ft) => Date.now() - ft.createdAt < 1500));
      setShockwaves((prev) => prev.filter((sw) => Date.now() - sw.createdAt < 1000));
    }, 200);
    return () => clearInterval(timer);
  }, []);

  // Decode the artwork while the round is quiet. A dragon that finishes
  // loading after the gift summoning it has passed may as well not exist.
  const assetKey = Object.values(battle.assets ?? {}).join('|');
  useEffect(() => {
    preload(Object.values(battle.assets ?? {}));
    // Compared by value through assetKey; depending on the object itself would
    // re-run on every state frame the socket delivers.
  }, [assetKey]);

  const handleCinematicDone = useCallback(() => {
    setCinematic(cinematicQueueRef.current.shift() ?? null);
  }, []);

  // Format time mm:ss
  const formatTime = (endsAt: number) => {
    const remaining = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '100%',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        userSelect: 'none',
        color: '#ffffff',
        background: 'radial-gradient(circle at center, #132b20 0%, #0c1a14 55%, #050d0a 100%)',
        transform: screenShake ? 'translate(3px, -3px)' : 'none',
        transition: 'transform 0.05s ease',
      }}
    >
      {/* Layer 1: the battlefield. High-res generated map or vector fallback */}
      <BattleMap backgroundUrl={battle.assets?.map_background} mapTheme={battle.mapTheme} />

      {/* Layer 2: the four strongholds, drawn at their map anchors. */}
      <CastleLayer teams={battle.teams} assets={battle.assets} />

      {/* Layer 4: the moment an expensive gift buys. */}
      <SkillCinematic request={cinematic} onDone={handleCinematicDone} />

      <style>{`
        @keyframes runeSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes dragonHover {
          0% { transform: translate(-50%, -50%) translateY(-5px) scale(1); }
          50% { transform: translate(-50%, -50%) translateY(5px) scale(1.05); }
          100% { transform: translate(-50%, -50%) translateY(-5px) scale(1); }
        }
        @keyframes shockwavePulse {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
        }
        @keyframes floatUpFade {
          0% { transform: translate(-50%, 0) scale(0.85); opacity: 0; }
          20% { transform: translate(-50%, -6px) scale(1.08); opacity: 1; }
          100% { transform: translate(-50%, -32px) scale(0.9); opacity: 0; }
        }
        @keyframes crownShine {
          0% { filter: drop-shadow(0 0 4px #facc15); }
          50% { filter: drop-shadow(0 0 14px #f59e0b); }
          100% { filter: drop-shadow(0 0 4px #facc15); }
        }
      `}</style>

      {/* ── TOP HEADER HUD: LIVE STATS & FLOATING SCORE CLASH CAPSULE ──────── */}
      <header
        style={{
          position: 'absolute',
          top: 8,
          left: 12,
          right: 12,
          zIndex: 60,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {/* Top Info Row: Channel (Left) - Timer & Title (Center) - Top Donors (Right) */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Left: Streamer Profile Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(15, 23, 42, 0.8)',
              backdropFilter: 'blur(12px)',
              padding: '3px 10px',
              borderRadius: 18,
              border: '1px solid rgba(255, 255, 255, 0.18)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '0.7rem',
              }}
            >
              👑
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.72rem', color: '#f8fafc' }}>Kingdom War</div>
              <div style={{ fontSize: '0.6rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                ❤️ 97.8K
              </div>
            </div>
          </div>

          {/* Center: Match Title & Timer Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(15, 23, 42, 0.88)',
              backdropFilter: 'blur(12px)',
              padding: '3px 14px',
              borderRadius: 18,
              border: '1px solid rgba(245, 158, 11, 0.45)',
              boxShadow: '0 0 14px rgba(245, 158, 11, 0.25)',
            }}
          >
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fde047' }}>⏱️ {formatTime(battle.endsAtMs)}</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#ffffff', letterSpacing: '0.04em' }}>
              {battle.title || 'CUỘC CHIẾN 4 VƯƠNG QUỐC'}
            </span>
          </div>

          {/* Right: Top Donors Capsule */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(15, 23, 42, 0.8)',
              backdropFilter: 'blur(12px)',
              padding: '3px 8px',
              borderRadius: 18,
              border: '1px solid rgba(255, 255, 255, 0.18)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#facc15' }}>🎁 TOP</span>
            <div style={{ display: 'flex', gap: 3 }}>
              {battle.topDonors.slice(0, 3).map((d, idx) => (
                <div
                  key={d.username + idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    fontSize: '0.62rem',
                    background: 'rgba(255,255,255,0.08)',
                    padding: '1px 5px',
                    borderRadius: 6,
                  }}
                >
                  <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                  <span style={{ fontWeight: 700, color: '#fde047' }}>{d.nickname}</span>
                  <span style={{ color: '#6ee7b7' }}>{(d.totalScore / 1000).toFixed(1)}k</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Floating Score Tug-of-War Bar (Score Clash Bar) - Compact Responsive Width */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 'clamp(280px, 45vw, 440px)',
            height: '20px',
            borderRadius: '10px',
            overflow: 'hidden',
            background: 'rgba(15, 23, 42, 0.92)',
            display: 'flex',
            border: '1.5px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.6)',
          }}
        >
          {/* MÈO (Purple) */}
          <div
            style={{
              width: `${catPct}%`,
              background: 'linear-gradient(90deg, #7c3aed, #c084fc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.62rem',
              transition: 'width 0.4s ease',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}
          >
            {catPct > 12 ? `${catPct}% Mèo` : `${catPct}%`}
          </div>

          {/* GẤU (Orange) */}
          <div
            style={{
              width: `${bearPct}%`,
              background: 'linear-gradient(90deg, #ea580c, #fb923c)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.62rem',
              transition: 'width 0.4s ease',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}
          >
            {bearPct > 12 ? `${bearPct}% Gấu` : `${bearPct}%`}
          </div>

          {/* CHÓ (Blue) */}
          <div
            style={{
              width: `${dogPct}%`,
              background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.62rem',
              transition: 'width 0.4s ease',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}
          >
            {dogPct > 12 ? `${dogPct}% Chó` : `${dogPct}%`}
          </div>

          {/* CAPYBARA (Green) */}
          <div
            style={{
              width: `${capyPct}%`,
              background: 'linear-gradient(90deg, #059669, #34d399)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.62rem',
              transition: 'width 0.4s ease',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}
          >
            {capyPct > 12 ? `${capyPct}% Capy` : `${capyPct}%`}
          </div>

          {/* Center VS Emblem */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#dc2626',
              border: '1.5px solid #ffffff',
              borderRadius: '50%',
              width: 18,
              height: 18,
              display: 'grid',
              placeItems: 'center',
              fontSize: '0.55rem',
              fontWeight: 900,
              boxShadow: '0 0 8px #dc2626',
            }}
          >
            VS
          </div>
        </div>
      </header>

      {/* ── 4 CORNER FORTRESS BASTIONS (VƯƠNG QUỐC 4 GÓC - ZERO OVERLAP) ────── */}

      {/* 1. TOP-LEFT: VƯƠNG QUỐC MÈO 🐱 */}
      <div
        style={{
          position: 'absolute',
          top: 64,
          left: 12,
          zIndex: 45,
          width: 'clamp(170px, 20vw, 210px)',
          background: 'rgba(15, 23, 42, 0.84)',
          backdropFilter: 'blur(12px)',
          border: '1.5px solid #c084fc',
          borderRadius: 12,
          padding: '6px 8px',
          boxShadow: '0 6px 20px rgba(192, 132, 252, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {/* Header Row: Avatar & Kingdom Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #7c3aed, #4c1d95)',
              border: '1.5px solid #c084fc',
              display: 'grid',
              placeItems: 'center',
              fontSize: '1.3rem',
              boxShadow: '0 0 10px rgba(192, 132, 252, 0.5)',
            }}
          >
            👑😼
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: '0.78rem', color: '#c084fc', textShadow: '0 1px 4px #7e22ce' }}>
              VƯƠNG QUỐC MÈO
            </div>
            <div style={{ fontSize: '0.58rem', color: '#e9d5ff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              🐾 {teamCat?.motto || 'ĂN CHƠI KHÔNG SỢ MƯA RƠI'}
            </div>
          </div>
        </div>

        {/* Castle HP Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', fontWeight: 700 }}>
            <span style={{ color: '#e9d5ff' }}>🏰 Máu Thành</span>
            <span style={{ color: '#c084fc' }}>{teamCat?.castleHp || 1000}/1000 HP</span>
          </div>
          <div style={{ height: 5, background: 'rgba(0,0,0,0.6)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.max(5, ((teamCat?.castleHp || 1000) / (teamCat?.maxHp || 1000)) * 100)}%`,
                background: 'linear-gradient(90deg, #7c3aed, #c084fc)',
                borderRadius: 3,
              }}
            />
          </div>
        </div>

        {/* Dynamic Speech Bubble or Troop Count */}
        <div
          style={{
            background: activeSpeech['cat'] ? '#ffffff' : 'rgba(255,255,255,0.08)',
            color: activeSpeech['cat'] ? '#1e1b4b' : '#e9d5ff',
            padding: '2px 6px',
            borderRadius: 6,
            fontSize: '0.6rem',
            fontWeight: 800,
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {activeSpeech['cat'] ? `💬 ${activeSpeech['cat']}` : `⚔️ Quân lực: ${teamCat?.soldierCount || 1000} lính`}
        </div>
      </div>

      {/* 2. TOP-RIGHT: VƯƠNG QUỐC CHÓ 🐶 */}
      <div
        style={{
          position: 'absolute',
          top: 64,
          right: 12,
          zIndex: 45,
          width: 'clamp(170px, 20vw, 210px)',
          background: 'rgba(15, 23, 42, 0.84)',
          backdropFilter: 'blur(12px)',
          border: '1.5px solid #60a5fa',
          borderRadius: 12,
          padding: '6px 8px',
          boxShadow: '0 6px 20px rgba(96, 165, 250, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {/* Header Row: Kingdom Title & Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
            <div style={{ fontWeight: 900, fontSize: '0.78rem', color: '#60a5fa', textShadow: '0 1px 4px #1d4ed8' }}>
              VƯƠNG QUỐC CHÓ
            </div>
            <div style={{ fontSize: '0.58rem', color: '#bfdbfe', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              💪 {teamDog?.motto || 'ĐOÀN KẾT LÀ SỨC MẠNH GÂU'}
            </div>
          </div>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #2563eb, #1e3a8a)',
              border: '1.5px solid #60a5fa',
              display: 'grid',
              placeItems: 'center',
              fontSize: '1.3rem',
              boxShadow: '0 0 10px rgba(96, 165, 250, 0.5)',
            }}
          >
            👑🐶
          </div>
        </div>

        {/* Castle HP Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', fontWeight: 700 }}>
            <span style={{ color: '#60a5fa' }}>{teamDog?.castleHp || 1000}/1000 HP</span>
            <span style={{ color: '#bfdbfe' }}>🏰 Máu Thành</span>
          </div>
          <div style={{ height: 5, background: 'rgba(0,0,0,0.6)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.max(5, ((teamDog?.castleHp || 1000) / (teamDog?.maxHp || 1000)) * 100)}%`,
                background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
                borderRadius: 3,
              }}
            />
          </div>
        </div>

        {/* Dynamic Speech Bubble or Troop Count */}
        <div
          style={{
            background: activeSpeech['dog'] ? '#ffffff' : 'rgba(255,255,255,0.08)',
            color: activeSpeech['dog'] ? '#1e3a8a' : '#bfdbfe',
            padding: '2px 6px',
            borderRadius: 6,
            fontSize: '0.6rem',
            fontWeight: 800,
            textAlign: 'right',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {activeSpeech['dog'] ? `💬 ${activeSpeech['dog']}` : `⚔️ Quân lực: ${teamDog?.soldierCount || 650} lính`}
        </div>
      </div>

      {/* 3. BOTTOM-LEFT: VƯƠNG QUỐC GẤU 🐻 (Positioned Safely Above Chat) */}
      <div
        style={{
          position: 'absolute',
          bottom: 'clamp(75px, 12vh, 105px)',
          left: 12,
          zIndex: 45,
          width: 'clamp(170px, 20vw, 210px)',
          background: 'rgba(15, 23, 42, 0.84)',
          backdropFilter: 'blur(12px)',
          border: '1.5px solid #fb923c',
          borderRadius: 12,
          padding: '6px 8px',
          boxShadow: '0 6px 20px rgba(251, 146, 60, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {/* Dynamic Speech Bubble or Troop Count */}
        <div
          style={{
            background: activeSpeech['bear'] ? '#ffffff' : 'rgba(255,255,255,0.08)',
            color: activeSpeech['bear'] ? '#7c2d12' : '#fed7aa',
            padding: '2px 6px',
            borderRadius: 6,
            fontSize: '0.6rem',
            fontWeight: 800,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {activeSpeech['bear'] ? `💬 ${activeSpeech['bear']}` : `⚔️ Quân lực: ${teamBear?.soldierCount || 800} lính`}
        </div>

        {/* Castle HP Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', fontWeight: 700 }}>
            <span style={{ color: '#fed7aa' }}>🏰 Máu Thành</span>
            <span style={{ color: '#fb923c' }}>{teamBear?.castleHp || 1000}/1000 HP</span>
          </div>
          <div style={{ height: 5, background: 'rgba(0,0,0,0.6)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.max(5, ((teamBear?.castleHp || 1000) / (teamBear?.maxHp || 1000)) * 100)}%`,
                background: 'linear-gradient(90deg, #c2410c, #fb923c)',
                borderRadius: 3,
              }}
            />
          </div>
        </div>

        {/* Header Row: Avatar & Kingdom Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #c2410c, #7c2d12)',
              border: '1.5px solid #fb923c',
              display: 'grid',
              placeItems: 'center',
              fontSize: '1.3rem',
              boxShadow: '0 0 10px rgba(251, 146, 60, 0.5)',
            }}
          >
            👑🐻
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: '0.78rem', color: '#fb923c', textShadow: '0 1px 4px #9a3412' }}>
              VƯƠNG QUỐC GẤU
            </div>
            <div style={{ fontSize: '0.58rem', color: '#fed7aa', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              🔥 {teamBear?.motto || 'GẤU CHỈ NGẠI ĐÓI'}
            </div>
          </div>
        </div>
      </div>

      {/* 4. BOTTOM-RIGHT: VƯƠNG QUỐC CAPYBARA 🦫 (Positioned Safely Above Minimap) */}
      <div
        style={{
          position: 'absolute',
          bottom: 'clamp(75px, 12vh, 105px)',
          right: 12,
          zIndex: 45,
          width: 'clamp(170px, 20vw, 210px)',
          background: 'rgba(15, 23, 42, 0.84)',
          backdropFilter: 'blur(12px)',
          border: '1.5px solid #34d399',
          borderRadius: 12,
          padding: '6px 8px',
          boxShadow: '0 6px 20px rgba(52, 211, 153, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {/* Dynamic Speech Bubble or Troop Count */}
        <div
          style={{
            background: activeSpeech['capy'] ? '#ffffff' : 'rgba(255,255,255,0.08)',
            color: activeSpeech['capy'] ? '#064e3b' : '#a7f3d0',
            padding: '2px 6px',
            borderRadius: 6,
            fontSize: '0.6rem',
            fontWeight: 800,
            textAlign: 'right',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {activeSpeech['capy'] ? `💬 ${activeSpeech['capy']}` : `⚔️ Quân lực: ${teamCapy?.soldierCount || 500} lính`}
        </div>

        {/* Castle HP Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', fontWeight: 700 }}>
            <span style={{ color: '#34d399' }}>{teamCapy?.castleHp || 1000}/1000 HP</span>
            <span style={{ color: '#a7f3d0' }}>🏰 Máu Thành</span>
          </div>
          <div style={{ height: 5, background: 'rgba(0,0,0,0.6)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.max(5, ((teamCapy?.castleHp || 1000) / (teamCapy?.maxHp || 1000)) * 100)}%`,
                background: 'linear-gradient(90deg, #059669, #34d399)',
                borderRadius: 3,
              }}
            />
          </div>
        </div>

        {/* Header Row: Kingdom Title & Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
            <div style={{ fontWeight: 900, fontSize: '0.78rem', color: '#34d399', textShadow: '0 1px 4px #047857' }}>
              VƯƠNG QUỐC CAPYBARA
            </div>
            <div style={{ fontSize: '0.58rem', color: '#a7f3d0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              🌿 {teamCapy?.motto || 'CHILL LÀ SỨC MẠNH CAPY'}
            </div>
          </div>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #059669, #064e3b)',
              border: '1.5px solid #34d399',
              display: 'grid',
              placeItems: 'center',
              fontSize: '1.3rem',
              boxShadow: '0 0 10px rgba(52, 211, 153, 0.5)',
            }}
          >
            👑🦫
          </div>
        </div>
      </div>

      {/* ── CENTER ARENA: RIVER GUARDIAN DRAGON & RUNIC PEDESTAL ──────────── */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 40,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Runic Spinning Ring */}
        <div
          style={{
            position: 'absolute',
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            border: '2px dashed rgba(56, 189, 248, 0.6)',
            animation: 'runeSpin 12s linear infinite',
          }}
        />

        {/* River Sea Dragon Monster with Hover Animation */}
        <div
          style={{
            fontSize: '4rem',
            filter: 'drop-shadow(0 0 20px #38bdf8)',
            animation: 'dragonHover 2.5s ease-in-out infinite',
            zIndex: 2,
          }}
        >
          🐉
        </div>

        {/* Central Clash Sparks */}
        <div
          style={{
            position: 'absolute',
            fontSize: '2.2rem',
            animation: 'crownShine 1s infinite alternate',
            filter: 'drop-shadow(0 0 14px #f59e0b)',
            zIndex: 3,
          }}
        >
          💥
        </div>

        {/* Dynamic Expanding Shockwaves */}
        {shockwaves.map((sw) => (
          <div
            key={sw.id}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: '110px',
              height: '110px',
              borderRadius: '50%',
              border: sw.type === 'meteor' ? '4px solid #ec4899' : sw.type === 'dragon' ? '4px solid #38bdf8' : '4px solid #f59e0b',
              boxShadow: sw.type === 'meteor' ? '0 0 30px #ec4899' : sw.type === 'dragon' ? '0 0 30px #38bdf8' : '0 0 30px #f59e0b',
              animation: 'shockwavePulse 0.9s ease-out forwards',
            }}
          />
        ))}
      </div>

      {/* ── MARCHING TROOPS SPRITES ALONG 4 BRIDGES ───────────────────────── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 35,
        }}
      >
        {/* Layer 3: every marching unit on one canvas. */}
        <TroopCanvas ref={troopCanvasRef} />


        {/* Floating Combat Text */}
        {floatingTexts.map((ft) => (
          <div
            key={ft.id}
            style={{
              position: 'absolute',
              left: `${ft.x}%`,
              top: `${ft.y}%`,
              color: ft.color,
              fontWeight: 900,
              fontSize: '0.9rem',
              textShadow: '0 2px 6px rgba(0,0,0,0.9), 0 0 10px currentColor',
              animation: 'floatUpFade 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
            }}
          >
            {ft.text}
          </div>
        ))}
      </div>

      {/* ── BOTTOM HUD: INTERACTION DECK & LIVE CHAT & MINIMAP ─────────────── */}
      <footer
        style={{
          position: 'absolute',
          bottom: 6,
          left: 12,
          right: 12,
          zIndex: 55,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        {/* Left: Compact Glassmorphic Live Chat */}
        <div
          style={{
            width: 'clamp(140px, 20vw, 200px)',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(12px)',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            padding: '5px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            maxHeight: 75,
            overflowY: 'hidden',
            boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ fontSize: '0.58rem', fontWeight: 800, color: '#facc15' }}>💬 BÌNH LUẬN</div>
          <div style={{ fontSize: '0.6rem', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: '#c084fc', fontWeight: 700 }}>Meow:</span> MÈO VÔ ĐỊCH! 😼🔥
          </div>
          <div style={{ fontSize: '0.6rem', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: '#60a5fa', fontWeight: 700 }}>Doggo:</span> CHÓ GÂU GÂU! 🐶💣
          </div>
        </div>

        {/* Center: 6 Skill Gift Cards & Big Action Button */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {/* Big Highlight Action Button: NÉM BOM 💣 */}
          <button
            type="button"
            onClick={() => onCardClick?.('bomb', 'Bomb', 50)}
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#000000',
              border: '1.5px solid #fef08a',
              borderRadius: 12,
              padding: '4px 18px',
              fontSize: '0.78rem',
              fontWeight: 900,
              letterSpacing: '0.03em',
              boxShadow: '0 0 16px rgba(245, 158, 11, 0.7)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'transform 0.1s ease',
            }}
          >
            <span>🔥 NÉM BOM KHẨN CẤP</span>
            <span style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 5px', borderRadius: 6, fontSize: '0.68rem' }}>🪙 199</span>
          </button>

          {/* 6 Skill Gift Cards */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { key: 'soldier', name: 'Triệu hồi lính', icon: '🐱', cost: '🌹 1', power: 1, gift: 'Rose', border: '#c084fc' },
              { key: 'castle', name: 'Xây thành', icon: '🏰', cost: '🌸 10', power: 10, gift: 'Perfume', border: '#60a5fa' },
              { key: 'bomb', name: 'Ném bom', icon: '💣', cost: '🍩 50', power: 50, gift: 'Donut', border: '#fb923c' },
              { key: 'dragon', name: 'Gọi rồng', icon: '🐉', cost: '🐲 99', power: 99, gift: 'Dragon', border: '#34d399' },
              { key: 'cannon', name: 'Bắn đại bác', icon: '💥', cost: '🎆 199', power: 199, gift: 'Cannon', border: '#facc15' },
              { key: 'meteor', name: 'Thiên thạch', icon: '☄️', cost: '🌌 999', power: 999, gift: 'Meteor', border: '#ec4899' },
            ].map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => onCardClick?.(card.key, card.gift, card.power)}
                style={{
                  background: 'rgba(15, 23, 42, 0.88)',
                  backdropFilter: 'blur(8px)',
                  border: `1.5px solid ${card.border}`,
                  borderRadius: 8,
                  padding: '3px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  color: '#ffffff',
                  boxShadow: `0 2px 6px ${card.border}33`,
                  transition: 'all 0.15s ease',
                  minWidth: 'clamp(48px, 6vw, 62px)',
                }}
              >
                <span style={{ fontSize: '0.55rem', fontWeight: 800, color: card.border }}>{card.name}</span>
                <span style={{ fontSize: '1rem' }}>{card.icon}</span>
                <span
                  style={{
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    background: 'rgba(255,255,255,0.1)',
                    padding: '1px 4px',
                    borderRadius: 4,
                  }}
                >
                  {card.cost}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Minimap Radar */}
        <div
          style={{
            width: 'clamp(90px, 12vw, 120px)',
            height: 75,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(12px)',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#facc15', textAlign: 'center' }}>🧭 BẢN ĐỒ</div>
          <div
            style={{
              flex: 1,
              background: '#07110d',
              borderRadius: 6,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
              gap: 2,
              padding: 2,
              position: 'relative',
            }}
          >
            <div style={{ background: 'rgba(192, 132, 252, 0.25)', borderRadius: 3, display: 'grid', placeItems: 'center', fontSize: '0.58rem' }}>
              🐱
            </div>
            <div style={{ background: 'rgba(96, 165, 250, 0.25)', borderRadius: 3, display: 'grid', placeItems: 'center', fontSize: '0.58rem' }}>
              🐶
            </div>
            <div style={{ background: 'rgba(251, 146, 60, 0.25)', borderRadius: 3, display: 'grid', placeItems: 'center', fontSize: '0.58rem' }}>
              🐻
            </div>
            <div style={{ background: 'rgba(52, 211, 153, 0.25)', borderRadius: 3, display: 'grid', placeItems: 'center', fontSize: '0.58rem' }}>
              🦫
            </div>
            {/* Center Blip */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#f59e0b',
                boxShadow: '0 0 5px #f59e0b',
              }}
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
