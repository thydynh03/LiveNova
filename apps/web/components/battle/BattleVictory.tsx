'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BattleState } from '@livenova/shared';

/**
 * The payoff.
 *
 * A round already closed correctly in the data — `active` flipped to false and
 * `winnerTeamKey` was written — but the overlay just froze on the last frame of
 * the fight. The audience that spent a whole session pushing one kingdom got no
 * moment back. This is that moment.
 *
 * Staged rather than dumped all at once: the screen settles, the winner lands,
 * then the people who paid for it are named. Each beat needs to survive being
 * clipped into a 15-second highlight, so the winner is legible from the first
 * frame it appears and the donor roll never depends on the beat before it.
 */

type Stage = 'settle' | 'crown' | 'donors';

const SETTLE_MS = 900;
const CROWN_MS = 1700;

/** Confetti is decoration, so it must not cost a frame of the crown landing. */
const CONFETTI_COUNT = 44;

/**
 * Seeded, not `Math.random()`. The overlay renders on the server first, and a
 * random layout there disagrees with the client's on hydration — React throws
 * the markup away and the first frame of the celebration flickers.
 */
function seededPieces(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const next = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
  return Array.from({ length: CONFETTI_COUNT }).map((_, i) => ({
    id: `c${i}`,
    left: next() * 100,
    delay: next() * 2.2,
    duration: 2.6 + next() * 2.2,
    drift: (next() - 0.5) * 120,
    size: 8 + next() * 10,
    rotate: next() * 360,
  }));
}

export function BattleVictory({ battle }: { battle: BattleState }) {
  const [stage, setStage] = useState<Stage>('settle');

  const winner = battle.winnerTeamKey
    ? battle.teams.find((t) => t.key === battle.winnerTeamKey) ?? null
    : null;
  const isDraw = !winner;

  useEffect(() => {
    // Restart the sequence if a new round somehow ends while this is mounted.
    setStage('settle');
    const toCrown = setTimeout(() => setStage('crown'), SETTLE_MS);
    const toDonors = setTimeout(() => setStage('donors'), SETTLE_MS + CROWN_MS);
    return () => {
      clearTimeout(toCrown);
      clearTimeout(toDonors);
    };
  }, [battle.battleId, battle.winnerTeamKey]);

  const colour = winner?.color || '#facc15';
  const pieces = useMemo(
    () => seededPieces(`${battle.battleId}:${battle.winnerTeamKey ?? 'draw'}`),
    [battle.battleId, battle.winnerTeamKey],
  );

  // The winning kingdom's own backers, biggest first. A draw has no side to
  // celebrate, so it falls back to the whole board.
  const roll = useMemo(() => {
    const donors = winner
      ? battle.topDonors.filter((d) => d.teamKey === winner.key)
      : battle.topDonors;
    return [...donors].sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);
  }, [battle.topDonors, winner?.key]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 90,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        // Dim rather than hide: the battlefield the audience just fought over
        // stays visible underneath the result.
        background:
          stage === 'settle'
            ? 'rgba(2, 6, 23, 0)'
            : `radial-gradient(circle at center, ${colour}22 0%, rgba(2, 6, 23, 0.78) 55%, rgba(2, 6, 23, 0.92) 100%)`,
        transition: 'background 700ms ease-out',
      }}
    >
      <style>{`
        @keyframes victoryBannerIn {
          0% { transform: scale(2.4) translateY(-18px); opacity: 0; filter: blur(6px); }
          55% { transform: scale(0.94); opacity: 1; filter: blur(0); }
          75% { transform: scale(1.04); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes victoryRayspin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes victoryConfetti {
          0% { transform: translateY(-12vh) rotate(0deg); opacity: 0; }
          8% { opacity: 1; }
          100% { transform: translateY(112vh) translateX(var(--drift)) rotate(720deg); opacity: 0.9; }
        }
        @keyframes victoryDonorIn {
          from { transform: translateY(14px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes victoryPulse {
          0%, 100% { text-shadow: 0 0 12px currentColor, 0 4px 18px rgba(0,0,0,0.8); }
          50% { text-shadow: 0 0 30px currentColor, 0 4px 18px rgba(0,0,0,0.8); }
        }
      `}</style>

      {/* Falling colour, in the winner's palette plus gold. Suppressed on a
          draw, where celebrating would be the wrong note. */}
      {stage !== 'settle' && !isDraw && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          {pieces.map((p) => (
            <span
              key={p.id}
              style={
                {
                  position: 'absolute',
                  left: `${p.left}%`,
                  top: 0,
                  width: p.size,
                  height: p.size * 0.5,
                  borderRadius: 2,
                  background: p.left % 2 > 1 ? '#facc15' : colour,
                  opacity: 0,
                  '--drift': `${p.drift}px`,
                  animation: `victoryConfetti ${p.duration}s linear ${p.delay}s infinite`,
                  transform: `rotate(${p.rotate}deg)`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {/* Rays behind the banner, so the winner reads as lit rather than pasted. */}
      {stage !== 'settle' && !isDraw && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '46%',
            width: 620,
            height: 620,
            background: `conic-gradient(from 0deg, ${colour}00 0deg, ${colour}33 12deg, ${colour}00 24deg, ${colour}00 36deg, ${colour}33 48deg, ${colour}00 60deg)`,
            borderRadius: '50%',
            animation: 'victoryRayspin 18s linear infinite',
            maskImage: 'radial-gradient(circle, #000 25%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(circle, #000 25%, transparent 70%)',
          }}
        />
      )}

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            fontSize: '0.8rem',
            fontWeight: 800,
            letterSpacing: '0.35em',
            color: '#e2e8f0',
            opacity: stage === 'settle' ? 0 : 0.85,
            transition: 'opacity 500ms ease-out',
          }}
        >
          TRẬN ĐẤU KẾT THÚC
        </div>

        {stage !== 'settle' && (
          <>
            <div
              style={{
                fontSize: '3rem',
                lineHeight: 1,
                animation: 'victoryBannerIn 700ms cubic-bezier(0.2, 1.2, 0.3, 1) both',
              }}
            >
              {isDraw ? '⚖️' : '👑'}
            </div>

            <div
              style={{
                fontSize: 'clamp(1.6rem, 4.5vw, 3rem)',
                fontWeight: 900,
                letterSpacing: '0.04em',
                color: isDraw ? '#e2e8f0' : colour,
                animation:
                  'victoryBannerIn 700ms cubic-bezier(0.2, 1.2, 0.3, 1) 80ms both, victoryPulse 2.4s ease-in-out 800ms infinite',
                textAlign: 'center',
                padding: '0 16px',
              }}
            >
              {isDraw ? 'BẤT PHÂN THẮNG BẠI' : winner!.name}
            </div>

            {!isDraw && (
              <div
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: '#fde047',
                  animation: 'victoryBannerIn 700ms cubic-bezier(0.2, 1.2, 0.3, 1) 180ms both',
                }}
              >
                VÔ ĐỊCH · {winner!.score.toLocaleString('vi-VN')} điểm
              </div>
            )}

            {isDraw && (
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>
                Không phe nào vượt lên được — hiệp này không có vương.
              </div>
            )}
          </>
        )}
      </div>

      {/* The bill, paid publicly. Whoever carried the winning kingdom gets their
          name on screen while the confetti is still falling. */}
      {stage === 'donors' && roll.length > 0 && (
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            marginTop: 8,
            padding: '8px 16px',
            borderRadius: 14,
            background: 'rgba(15, 23, 42, 0.72)',
            border: `1px solid ${colour}66`,
            backdropFilter: 'blur(10px)',
            animation: 'victoryDonorIn 500ms ease-out both',
          }}
        >
          <div style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.2em', color: '#facc15' }}>
            {isDraw ? '🎁 TOP ỦNG HỘ' : '🎁 CÔNG THẦN VƯƠNG QUỐC'}
          </div>
          {roll.map((d, idx) => (
            <div
              key={d.username}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#f8fafc',
                animation: `victoryDonorIn 450ms ease-out ${idx * 180}ms both`,
              }}
            >
              <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
              <span>{d.nickname || d.username}</span>
              <span style={{ color: colour, fontWeight: 900 }}>
                {d.totalScore.toLocaleString('vi-VN')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
