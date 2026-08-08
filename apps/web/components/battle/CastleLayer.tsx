'use client';

import React from 'react';
import { castleAssetKey, type BattleTeamState } from '@livenova/shared';
import { CASTLE_ANCHORS } from './BattleMap';

/**
 * The four strongholds, standing on the map.
 *
 * Until now a castle existed only as a number in the HUD, so an audience
 * watching the map could not see which kingdom was losing — the thing the whole
 * game is about. Artwork changes across three damage tiers, and the tier is
 * chosen by `castleAssetKey`, which falls back through them: a template that
 * only ships the intact sprite still renders rather than blanking the castle at
 * the exact moment it is under attack.
 *
 * Rendered as DOM, not on the troop canvas. There are four of them, they change
 * slowly, and they carry text — all three point away from canvas.
 */

const FALLBACK_SIZE = 108;

export function CastleLayer({
  teams,
  assets,
}: {
  teams: BattleTeamState[];
  assets?: Record<string, string>;
}) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none' }}>
      {teams.map((team) => {
        const anchor = CASTLE_ANCHORS[team.key];
        if (!anchor) return null;

        const maxHp = team.maxHp || 1000;
        const ratio = Math.max(0, Math.min(1, (team.castleHp ?? maxHp) / maxHp));
        const url = castleAssetKey(team.key, team.castleHp ?? maxHp, maxHp, assets);

        return (
          <div
            key={team.key}
            style={{
              position: 'absolute',
              left: `${anchor.x}%`,
              top: `${anchor.y}%`,
              transform: 'translate(-50%, -50%)',
              width: FALLBACK_SIZE,
              height: FALLBACK_SIZE,
              display: 'grid',
              placeItems: 'center',
              // Damage reads before any number does: a failing castle desaturates
              // and darkens, so a glance at the map tells you who is losing.
              filter: `saturate(${0.35 + ratio * 0.65}) brightness(${0.55 + ratio * 0.45})`,
              transition: 'filter 600ms ease-out',
            }}
          >
            {url ? (
              /* Plain <img>: the URL is arbitrary admin-supplied Cloudinary
                 content, which next/image would need remote patterns for. */
              <img
                src={url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <FallbackCastle colour={team.color} ratio={ratio} />
            )}

            <HpPip ratio={ratio} colour={team.color} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Drawn castle, for a template with no artwork.
 *
 * Loses its towers as it takes damage, so the fallback still tells the story
 * the artwork would. A shape that reads correctly beats a missing image.
 */
function FallbackCastle({ colour, ratio }: { colour: string; ratio: number }) {
  const intact = ratio > 0.66;
  const standing = ratio > 0.33;

  return (
    <svg viewBox="0 0 64 64" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id={`stone-${colour.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b8178" />
          <stop offset="100%" stopColor="#4a443e" />
        </linearGradient>
      </defs>

      <rect x="16" y="28" width="32" height="26" fill={`url(#stone-${colour.replace('#', '')})`} rx="2" />

      {standing && (
        <>
          <rect x="10" y="20" width="12" height="34" fill={`url(#stone-${colour.replace('#', '')})`} rx="2" />
          <rect x="42" y="20" width="12" height="34" fill={`url(#stone-${colour.replace('#', '')})`} rx="2" />
        </>
      )}

      {intact && (
        <>
          <polygon points="16,20 22,10 28,20" fill={colour} />
          <polygon points="36,20 42,10 48,20" fill={colour} />
          <rect x="30" y="12" width="4" height="16" fill={colour} />
        </>
      )}

      <rect x="28" y="42" width="8" height="12" fill="#1c1917" rx="1" />

      {!standing && (
        // Rubble, so a fallen castle looks fallen rather than merely small.
        <g fill="#3f3a35">
          <circle cx="14" cy="52" r="3" />
          <circle cx="50" cy="53" r="4" />
          <circle cx="24" cy="55" r="2.5" />
        </g>
      )}
    </svg>
  );
}

/** A thin ring that empties as the castle falls. */
function HpPip({ ratio, colour }: { ratio: number; colour: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: -6,
        width: '72%',
        height: 5,
        borderRadius: 999,
        background: 'rgba(0,0,0,0.55)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${ratio * 100}%`,
          height: '100%',
          background: ratio > 0.33 ? colour : '#ef4444',
          transition: 'width 500ms ease-out',
        }}
      />
    </div>
  );
}
