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
  /**
   * The map artwork already has castles painted at the anchors.
   *
   * When it does, drawing our own sprite there puts a second, worse castle on
   * top of a good one. So the layer stops rendering buildings and renders only
   * what the painting cannot: whose keep it is and how much of it is left.
   */
  paintedCastles = false,
}: {
  teams: BattleTeamState[];
  assets?: Record<string, string>;
  paintedCastles?: boolean;
}) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none' }}>
      {teams.map((team) => {
        const anchor = CASTLE_ANCHORS[team.key];
        if (!anchor) return null;

        const maxHp = team.maxHp || 1000;
        const ratio = Math.max(0, Math.min(1, (team.castleHp ?? maxHp) / maxHp));
        const url = castleAssetKey(team.key, team.castleHp ?? maxHp, maxHp, assets);

        if (paintedCastles) {
          return <CastlePlate key={team.key} team={team} anchor={anchor} ratio={ratio} />;
        }

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
 * Name and health, sitting on the painted keep.
 *
 * This replaces the four glass panels that used to live in the screen corners.
 * They carried the same three facts, but they carried them a long way from the
 * castle they described — and at portrait they landed directly on top of it. A
 * plate under the keep ties the number to the building without hiding it.
 */
function CastlePlate({
  team,
  anchor,
  ratio,
}: {
  team: BattleTeamState;
  anchor: { x: number; y: number };
  ratio: number;
}) {
  const hp = team.castleHp ?? team.maxHp ?? 1000;
  const falling = ratio <= 0.33;
  // Plates hang below the two northern keeps and above the two southern ones.
  // A fixed downward offset put the bottom pair underneath the gift deck, where
  // the audience reads the health of a castle it cannot see.
  const below = anchor.y < 50;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${anchor.x}%`,
        top: `${anchor.y}%`,
        // Clear of the keep, not over it. The artwork is the thing being sold.
        transform: below ? 'translate(-50%, 46px)' : 'translate(-50%, -108px)',
        width: 'clamp(96px, 26vw, 150px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        padding: '4px 7px',
        borderRadius: 9,
        background: 'rgba(8, 12, 24, 0.72)',
        border: `1px solid ${team.color}99`,
        boxShadow: `0 3px 12px rgba(0,0,0,0.55)`,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 'clamp(0.56rem, 2.1vw, 0.72rem)',
          fontWeight: 900,
          color: team.color,
          textShadow: '0 1px 3px rgba(0,0,0,0.9)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {team.name}
      </div>

      <div style={{ height: 6, background: 'rgba(0,0,0,0.65)', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${ratio * 100}%`,
            // Red overrides the kingdom colour near the end: a castle about to
            // fall has to shout, and it must not be mistaken for a healthy bar
            // that merely happens to be short.
            background: falling ? '#ef4444' : team.color,
            transition: 'width 500ms ease-out',
          }}
        />
      </div>

      <div
        style={{
          fontSize: 'clamp(0.5rem, 1.8vw, 0.62rem)',
          fontWeight: 700,
          color: falling ? '#fca5a5' : '#e2e8f0',
        }}
      >
        🏰 {hp}/{team.maxHp || 1000}
        {typeof team.soldierCount === 'number' && <> · ⚔️ {team.soldierCount}</>}
      </div>
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
