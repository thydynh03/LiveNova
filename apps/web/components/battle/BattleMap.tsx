'use client';

import React from 'react';
import { BATTLE_MAP_PRESETS } from '@livenova/shared';

/**
 * The battlefield background.
 *
 * Supports high-resolution generated map illustrations (Fantasy Kingdoms, Lava & Frost, Classic Cartoon),
 * custom admin uploads, or a lightweight fallback SVG vector river.
 */

export const CASTLE_ANCHORS: Record<string, { x: number; y: number }> = {
  cat: { x: 16, y: 20 },
  dog: { x: 84, y: 20 },
  bear: { x: 16, y: 74 },
  capy: { x: 84, y: 74 },
};

export const CLASH_POINT = { x: 50, y: 47 };

export type LaneKey = keyof typeof CASTLE_ANCHORS;

const GRASS_LIGHT = '#27452f';

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

      {/* 4 Diagonal Stone Bridges */}
      <line x1="150" y1="100" x2="500" y2="500" stroke="#c084fc" strokeWidth="8" strokeDasharray="14,10" opacity="0.75" />
      <line x1="850" y1="100" x2="500" y2="500" stroke="#60a5fa" strokeWidth="8" strokeDasharray="14,10" opacity="0.75" />
      <line x1="150" y1="900" x2="500" y2="500" stroke="#fb923c" strokeWidth="8" strokeDasharray="14,10" opacity="0.75" />
      <line x1="850" y1="900" x2="500" y2="500" stroke="#34d399" strokeWidth="8" strokeDasharray="14,10" opacity="0.75" />

      {/* Cross Rivers flowing under bridges */}
      <path d="M 440,0 Q 530,280 480,500 T 560,1000 L 460,1000 Q 380,720 420,500 T 360,0 Z" fill="url(#ln-river-v)" opacity="0.9" />
      <path d="M 0,440 Q 280,530 500,480 T 1000,560 L 1000,460 Q 720,380 500,420 T 0,360 Z" fill="url(#ln-river-h)" opacity="0.9" />

      {/* Central Nexus Arena Pedestal */}
      <circle cx="500" cy="500" r="100" fill="#1e293b" stroke="#f59e0b" strokeWidth="5" />
      <circle cx="500" cy="500" r="85" fill="#0f172a" stroke="#38bdf8" strokeWidth="3" strokeDasharray="12,8" />
      <circle cx="500" cy="500" r="68" fill="#020617" />
    </svg>
  );
}
