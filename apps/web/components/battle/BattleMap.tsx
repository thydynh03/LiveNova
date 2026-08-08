'use client';

import React from 'react';

/**
 * The battlefield background.
 *
 * Two modes. When the template supplies a `map_background` asset that image is
 * used; otherwise this hand-authored SVG stands in.
 *
 * The SVG is deliberately a placeholder, not the goal. Painted artwork will
 * always beat vector shapes for a map like this, and it can be swapped without
 * touching code. What this file really provides is the **coordinate contract**:
 * castles at the four corners, lanes converging on a bridge in the middle. Real
 * artwork drawn to `LANES` and `CASTLE_ANCHORS` drops straight in, and the
 * troop canvas keeps working because it reads the same numbers.
 *
 * Percentages, not pixels: a Browser Source is a fixed 1920×1080 but the
 * simulator renders the same component in a smaller box.
 */

/** Where each kingdom sits, in percent of the viewport. */
export const CASTLE_ANCHORS: Record<string, { x: number; y: number }> = {
  cat: { x: 16, y: 20 },
  dog: { x: 84, y: 20 },
  bear: { x: 16, y: 74 },
  capy: { x: 84, y: 74 },
};

/** Where the armies meet. Everything marches here. */
export const CLASH_POINT = { x: 50, y: 47 };

export type LaneKey = keyof typeof CASTLE_ANCHORS;

const RIVER = '#1e3a5f';
const GRASS_DARK = '#1c3122';
const GRASS_LIGHT = '#27452f';
const STONE = '#6b6157';

export function BattleMap({ backgroundUrl }: { backgroundUrl?: string }) {
  if (backgroundUrl) {
    return (
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${backgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: 0,
        }}
      />
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
    >
      <defs>
        <radialGradient id="ln-field" cx="50%" cy="47%" r="72%">
          <stop offset="0%" stopColor={GRASS_LIGHT} />
          <stop offset="100%" stopColor="#0d1a12" />
        </radialGradient>
        <linearGradient id="ln-river" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2c5c8a" />
          <stop offset="100%" stopColor={RIVER} />
        </linearGradient>
        {/* Cheap paper grain. A flat fill reads as a placeholder even when the
            shapes are right. */}
        <filter id="ln-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.06" />
          </feComponentTransfer>
          <feComposite operator="over" in2="SourceGraphic" />
        </filter>
      </defs>

      <rect width="100" height="100" fill="url(#ln-field)" />

      {/* River: a cross through the middle, which is what makes four corners
          read as four separate kingdoms rather than one field. */}
      <rect x="0" y="43" width="100" height="9" fill="url(#ln-river)" opacity="0.85" />
      <rect x="45" y="0" width="9" height="100" fill="url(#ln-river)" opacity="0.85" />

      {/* Banks */}
      <rect x="0" y="42" width="100" height="1.2" fill={GRASS_DARK} />
      <rect x="0" y="51.8" width="100" height="1.2" fill={GRASS_DARK} />
      <rect x="43.8" y="0" width="1.2" height="100" fill={GRASS_DARK} />
      <rect x="53.8" y="0" width="1.2" height="100" fill={GRASS_DARK} />

      {/* The four march lanes, drawn so the troop canvas has something under it. */}
      {(Object.keys(CASTLE_ANCHORS) as LaneKey[]).map((key) => {
        const a = CASTLE_ANCHORS[key];
        return (
          <line
            key={key}
            x1={a.x}
            y1={a.y}
            x2={CLASH_POINT.x}
            y2={CLASH_POINT.y}
            stroke={STONE}
            strokeWidth="3.2"
            strokeLinecap="round"
            opacity="0.5"
          />
        );
      })}

      {/* Central bridge crossing */}
      <rect x="41" y="43.5" width="18" height="8" rx="1" fill={STONE} opacity="0.9" />
      <rect x="46" y="38" width="8" height="19" rx="1" fill={STONE} opacity="0.9" />

      <rect width="100" height="100" filter="url(#ln-grain)" opacity="0.5" />
    </svg>
  );
}
