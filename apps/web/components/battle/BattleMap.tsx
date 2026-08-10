'use client';

import React from 'react';
import { BATTLE_MAP_PRESETS } from '@livenova/shared';

/**
 * The battlefield background.
 *
 * Supports high-resolution generated map illustrations (Fantasy Kingdoms, Lava & Frost, Classic Cartoon),
 * custom admin uploads, or a lightweight fallback SVG vector river.
 */

/**
 * Where each stronghold stands, in percent of the field.
 *
 * These are not free choices — they are measured off the painted map, which
 * already has four castles on it. The overlay's job is to label the artwork,
 * not to draw a second castle on top of it. Read from
 * `map_kingdom_fantasy.jpg` (768x1376): purple keep upper-left, blue upper-
 * right, timber hall lower-left, green citadel lower-right.
 *
 * The numbers only line up in portrait. TikTok Live is 1080x1920 and the map
 * art is cut for it; viewed in a landscape window the browser crops away the
 * top and bottom thirds, taking all four castles with them.
 */
export const CASTLE_ANCHORS: Record<string, { x: number; y: number }> = {
  cat: { x: 18, y: 20 },
  dog: { x: 82, y: 18 },
  bear: { x: 20, y: 77 },
  capy: { x: 81, y: 78 },
};

export const CLASH_POINT = { x: 50, y: 47 };

/**
 * Where each lane's bridge meets dry land, in percent of the field.
 *
 * The map is a cross of rivers with a runic plaza in the middle, and the only
 * way in is over one of four diagonal stone bridges. Troops used to walk a
 * straight line from their keep to the centre, which on this artwork means
 * stepping off the bank and marching *through the water* beside the bridge —
 * the bridges sit at a different angle to the castle-to-centre diagonal, so the
 * two never coincided.
 *
 * Fitted against `map_kingdom_fantasy.jpg` (768x1376) rather than eyeballed:
 * each point is the waypoint that minimises how much of the keep-to-centre walk
 * lands on water-coloured pixels. All four routes come out at 0% water, against
 * 6–12% for the straight lines they replace. The other shipped maps use the
 * same four-keeps-around-a-crossroads composition, so these carry over; a map
 * that does not can override them per preset later.
 */
export const BRIDGE_HEADS: Record<string, { x: number; y: number }> = {
  cat: { x: 36.5, y: 39 },
  dog: { x: 68, y: 36.5 },
  bear: { x: 34.5, y: 61.5 },
  capy: { x: 75, y: 60 },
};

export type LaneKey = keyof typeof CASTLE_ANCHORS;

export interface Point {
  x: number;
  y: number;
}

export function castleAnchor(lane: string): Point {
  return CASTLE_ANCHORS[lane] ?? CASTLE_ANCHORS.cat;
}

export function bridgeHead(lane: string): Point {
  return BRIDGE_HEADS[lane] ?? BRIDGE_HEADS.cat;
}

/**
 * The direction a unit is facing once it is on the bridge.
 *
 * Taken from the bridge, not from the keep. The two differ by a good twenty
 * degrees on this map, and it is the bridge that decides which way a soldier is
 * pointing when it arrives — so it is also what decides where the melee line
 * forms and which way the lunge goes.
 */
export function laneDirection(lane: string): Point {
  const head = bridgeHead(lane);
  const dx = CLASH_POINT.x - head.x;
  const dy = CLASH_POINT.y - head.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/**
 * Position along a lane at `t` in [0, 1]: keep → bridge head → `end`.
 *
 * Parameterised by arc length rather than by leg, so a unit does not slow down
 * or speed up as it steps onto the bridge.
 */
export function lanePosition(lane: string, end: Point, t: number): Point {
  const from = castleAnchor(lane);
  const head = bridgeHead(lane);

  const legA = Math.hypot(head.x - from.x, head.y - from.y);
  const legB = Math.hypot(end.x - head.x, end.y - head.y);
  const total = legA + legB || 1;

  const clamped = Math.min(1, Math.max(0, t));
  const travelled = clamped * total;

  if (travelled <= legA) {
    const k = legA === 0 ? 0 : travelled / legA;
    return { x: from.x + (head.x - from.x) * k, y: from.y + (head.y - from.y) * k };
  }
  const k = legB === 0 ? 1 : (travelled - legA) / legB;
  return { x: head.x + (end.x - head.x) * k, y: head.y + (end.y - head.y) * k };
}

const GRASS_LIGHT = '#27452f';

/** Kingdom colours for the vector fallback, in the same order as the anchors. */
const LANE_STYLE: { lane: LaneKey; colour: string }[] = [
  { lane: 'cat', colour: '#c084fc' },
  { lane: 'dog', colour: '#60a5fa' },
  { lane: 'bear', colour: '#fb923c' },
  { lane: 'capy', colour: '#34d399' },
];

export function BattleMap({
  backgroundUrl,
  mapTheme = 'fantasy_kingdoms',
}: {
  backgroundUrl?: string;
  mapTheme?: string;
}) {
  let resolvedUrl = backgroundUrl;
  if (!resolvedUrl) {
    const preset = BATTLE_MAP_PRESETS.find((p) => p.id === mapTheme);
    if (preset?.backgroundUrl) {
      resolvedUrl = preset.backgroundUrl;
    }
  }

  if (resolvedUrl && mapTheme !== 'vector_runic_river') {
    return (
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${resolvedUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: 0,
        }}
      >
        {/* Subtle dark vignette overlay for optimal text & HUD contrast */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.45) 80%, rgba(0,0,0,0.7) 100%)',
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
    >
      <defs>
        <radialGradient id="ln-field" cx="50%" cy="47%" r="72%">
          <stop offset="0%" stopColor={GRASS_LIGHT} />
          <stop offset="100%" stopColor="#0d1a12" />
        </radialGradient>
        <linearGradient id="ln-river-v" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="30%" stopColor="#0369a1" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="70%" stopColor="#0369a1" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="ln-river-h" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="30%" stopColor="#0369a1" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="70%" stopColor="#0369a1" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      <rect width="1000" height="1000" fill="url(#ln-field)" />

      {/* Decorative Terrain Contours */}
      <circle cx="200" cy="200" r="160" fill="#162e24" />
      <circle cx="800" cy="200" r="160" fill="#162e24" />
      <circle cx="200" cy="800" r="160" fill="#162e24" />
      <circle cx="800" cy="800" r="160" fill="#162e24" />

      {/* Roads from each keep down to its bridge head. Dirt, not stone: this
          half of the walk is over open ground. */}
      {LANE_STYLE.map(({ lane, colour }) => {
        const from = castleAnchor(lane);
        const head = bridgeHead(lane);
        return (
          <line
            key={`road-${lane}`}
            x1={from.x * 10}
            y1={from.y * 10}
            x2={head.x * 10}
            y2={head.y * 10}
            stroke={colour}
            strokeWidth="6"
            strokeDasharray="10,14"
            opacity="0.35"
          />
        );
      })}

      {/* Cross rivers. Drawn before the bridges, so the bridges are over the
          water rather than under it. */}
      <path d="M 440,0 Q 530,280 480,500 T 560,1000 L 460,1000 Q 380,720 420,500 T 360,0 Z" fill="url(#ln-river-v)" opacity="0.9" />
      <path d="M 0,440 Q 280,530 500,480 T 1000,560 L 1000,460 Q 720,380 500,420 T 0,360 Z" fill="url(#ln-river-h)" opacity="0.9" />

      {/* The four bridges, from the same constants the troops march along.
          Drawing them from their own hard-coded endpoints is what let the art
          and the pathing drift apart in the first place. */}
      {LANE_STYLE.map(({ lane, colour }) => {
        const head = bridgeHead(lane);
        return (
          <g key={`bridge-${lane}`}>
            <line
              x1={head.x * 10}
              y1={head.y * 10}
              x2={CLASH_POINT.x * 10}
              y2={CLASH_POINT.y * 10}
              stroke="#94a3b8"
              strokeWidth="26"
              strokeLinecap="round"
            />
            <line
              x1={head.x * 10}
              y1={head.y * 10}
              x2={CLASH_POINT.x * 10}
              y2={CLASH_POINT.y * 10}
              stroke={colour}
              strokeWidth="6"
              strokeDasharray="14,10"
              opacity="0.85"
            />
          </g>
        );
      })}

      {/* Central Nexus Arena Pedestal, centred on the point the lanes converge
          on rather than on the middle of the viewBox. */}
      <circle cx={CLASH_POINT.x * 10} cy={CLASH_POINT.y * 10} r="100" fill="#1e293b" stroke="#f59e0b" strokeWidth="5" />
      <circle cx={CLASH_POINT.x * 10} cy={CLASH_POINT.y * 10} r="85" fill="#0f172a" stroke="#38bdf8" strokeWidth="3" strokeDasharray="12,8" />
      <circle cx={CLASH_POINT.x * 10} cy={CLASH_POINT.y * 10} r="68" fill="#020617" />
    </svg>
  );
}
