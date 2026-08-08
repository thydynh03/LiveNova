'use client';

import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { SPRITE_SHEET } from '@livenova/shared';
import { getImage } from '../../lib/image-cache';
import { CASTLE_ANCHORS, CLASH_POINT, type LaneKey } from './BattleMap';
import { prepareSheet } from './sprite-sheet-prep';

/**
 * Every marching unit, on one canvas.
 *
 * The previous renderer gave each troop its own `<div>` and advanced them with
 * a 30ms `setInterval` that called `setState`. That is a full React
 * reconciliation 33 times a second over a few hundred elements, on a machine
 * that is simultaneously encoding 1080p60 — and when an OBS overlay competes
 * with the encoder it is the *broadcast* that stutters, which is the one
 * failure a streamer will not tolerate.
 *
 * So: one element, one `requestAnimationFrame` loop, and the troop list lives
 * in a ref. React renders this component once.
 */

export interface Troop {
  id: string;
  teamKey: string;
  lane: LaneKey;
  /** Action tier — decides colour and size. */
  type: string;
  colour: string;
  /** 0 at the castle, 1 at the clash point. */
  progress: number;
  speed: number;
  /** Small vertical scatter so a squad does not march as one dot. */
  offset: number;
  /** Walk-cycle sheet for this kingdom, when the template supplies one. */
  spriteUrl?: string;
  /**
   * Per-unit health, for the pip drawn over its head.
   *
   * Optional because nothing on the server tracks a single soldier yet — a
   * gift buys score and castle damage, not a unit with its own hit points. When
   * absent the pip falls back to draining as the unit nears the clash, which is
   * a depiction, not a reading of state.
   */
  hp?: number;
  maxHp?: number;
}

export interface TroopCanvasHandle {
  spawn: (troops: Troop[]) => void;
  /** Live count, for a caller that wants to enforce its own ceiling. */
  count: () => number;
}

interface Props {
  /**
   * Hard ceiling on units drawn at once.
   *
   * A viral broadcast can produce gifts faster than troops can cross the map.
   * Without a cap the list only grows and the overlay dies exactly when the
   * audience is largest. Oldest are dropped first: a unit that has nearly
   * arrived matters less than the one that just cost somebody money.
   */
  maxTroops?: number;
}

export const TroopCanvas = forwardRef<TroopCanvasHandle, Props>(function TroopCanvas(
  { maxTroops = 220 },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const troopsRef = useRef<Troop[]>([]);
  const frameRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    spawn(incoming: Troop[]) {
      const next = troopsRef.current.concat(incoming);
      troopsRef.current =
        next.length > maxTroops ? next.slice(next.length - maxTroops) : next;
    },
    count() {
      return troopsRef.current.length;
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      // Backing store at device resolution, CSS box unchanged, or the sprites
      // are soft on the high-DPI displays streamers actually use.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let last = performance.now();

    const draw = (now: number) => {
      // Advance by elapsed time, not per frame. A dropped frame otherwise slows
      // the march down, so the same gift takes longer to land when the machine
      // is busy — which is precisely when it is busiest.
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      ctx.clearRect(0, 0, width, height);

      const survivors: Troop[] = [];
      for (const troop of troopsRef.current) {
        const progress = troop.progress + troop.speed * dt;
        if (progress >= 1) continue;

        const from = CASTLE_ANCHORS[troop.lane] ?? CASTLE_ANCHORS.cat;
        const x = ((from.x + (CLASH_POINT.x - from.x) * progress) / 100) * width;
        const y =
          ((from.y + (CLASH_POINT.y - from.y) * progress) / 100) * height + troop.offset;

        drawUnit(ctx, x, y, troop, now);
        survivors.push({ ...troop, progress });
      }
      troopsRef.current = survivors;

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 35,
      }}
    />
  );
});

/**
 * Walk-cycle sheets with the kingdom rim already burned in.
 *
 * The rim has to be a blur, and `shadowBlur` is the most expensive thing in the
 * 2D context. Applying it per unit per frame measured at 9.2ms for a full field
 * of 220 troops — over half the 16.7ms budget, on a machine that is also
 * encoding the broadcast. Baked once per (sheet, colour, size) it is 2.9ms,
 * because the draw loop is back to one plain `drawImage` per unit.
 *
 * Keyed on all three inputs: two kingdoms may share a sheet and differ only in
 * colour, and the big tiers differ only in size.
 */
const rimCache = new Map<string, { canvas: HTMLCanvasElement; cell: number; frames: number } | null>();

function rimmedSheet(
  sheet: CanvasImageSource & { width: number; height: number },
  key: string,
  colour: string,
  size: number,
) {
  const cacheKey = `${key}|${colour}|${size}`;
  if (rimCache.has(cacheKey)) return rimCache.get(cacheKey) ?? null;

  // Measure and re-cut first. Everything below assumes square, registered
  // cells, which the generated sheets are not until this has run.
  const prepared = prepareSheet(sheet, size);
  if (!prepared) {
    rimCache.set(cacheKey, null);
    return null;
  }

  const glow = size > 60 ? 18 : 12;
  const pad = Math.ceil(glow * 1.5);
  const cell = size + pad * 2;

  const canvas = document.createElement('canvas');
  canvas.width = cell * prepared.frames;
  canvas.height = cell;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    rimCache.set(cacheKey, null);
    return null;
  }

  for (let f = 0; f < prepared.frames; f += 1) {
    const blit = () =>
      ctx.drawImage(
        prepared.canvas,
        f * prepared.cell,
        0,
        prepared.cell,
        prepared.cell,
        f * cell + pad,
        pad,
        size,
        size,
      );

    // Dark pass first, to separate the figure from bright water and stone;
    // then the kingdom colour, which is what carries over dark forest.
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = glow * 0.5;
    blit();

    ctx.shadowColor = colour;
    ctx.shadowBlur = glow;
    blit();
    blit();
  }

  const entry = { canvas, cell, frames: prepared.frames };
  rimCache.set(cacheKey, entry);
  return entry;
}

/**
 * One unit.
 *
 * Blits a frame from the kingdom's walk-cycle sheet when the template supplies
 * one, and falls back to a drawn shape otherwise. The fallback is not a
 * placeholder to be embarrassed about: a template with no artwork still has to
 * produce a readable battle, and a shape that reads correctly beats a missing
 * image.
 */
function drawMiniHealthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  hpRatio: number,
  teamColour: string,
) {
  const halfW = width / 2;
  const barX = x - halfW;
  const barY = y;
  const radius = 2;

  ctx.save();
  ctx.shadowBlur = 0;

  // Dark border frame
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(barX - 1, barY - 1, width + 2, height + 2, radius);
  } else {
    ctx.rect(barX - 1, barY - 1, width + 2, height + 2);
  }
  ctx.fill();

  // Dark background slot
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(barX, barY, width, height, radius);
  } else {
    ctx.rect(barX, barY, width, height);
  }
  ctx.fill();

  // Active Health fill
  const clampedRatio = Math.max(0.05, Math.min(1, hpRatio));
  const fillWidth = Math.max(1.5, width * clampedRatio);
  
  // Health color palette: Green -> Amber -> Red or Team Color
  const hpColor = clampedRatio > 0.5 ? '#22c55e' : clampedRatio > 0.25 ? '#f59e0b' : '#ef4444';
  ctx.fillStyle = hpColor;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(barX, barY, fillWidth, height, radius);
  } else {
    ctx.rect(barX, barY, fillWidth, height);
  }
  ctx.fill();

  // Mini Team faction pip (left side dot)
  ctx.fillStyle = teamColour;
  ctx.beginPath();
  ctx.arc(barX - 3.5, barY + height / 2, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * One unit.
 *
 * Blits a frame from the kingdom's walk-cycle sheet when the template supplies
 * one, and falls back to a drawn shape otherwise.
 */
function drawUnit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  troop: Troop,
  now: number,
) {
  const big = troop.type === 'meteor' || troop.type === 'dragon' || troop.type === 'cannon';
  const sheet = getImage(troop.spriteUrl);

  // Calculate HP ratio: default to full or smoothly take damage near clash point
  let hpRatio = troop.hp !== undefined ? troop.hp / (troop.maxHp || 100) : 1;
  if (troop.hp === undefined && troop.progress > 0.65) {
    hpRatio = Math.max(0.15, 1 - (troop.progress - 0.65) * 2.4);
  }

  if (sheet && sheet.height > 0) {
    const size = big ? 78 : 52;
    const rimmed = rimmedSheet(sheet, troop.spriteUrl ?? troop.teamKey, troop.colour, size);

    if (rimmed) {
      // Frame count comes from counting figures in the artwork, not from its
      // aspect ratio. The shipped sheets are 1376x768, which the ratio rule
      // read as two frames — half a picture of three soldiers per "frame".
      const frames = Math.max(1, Math.min(SPRITE_SHEET.MAX_FRAMES, rimmed.frames));
      const phase = troop.id.length;
      const frame = Math.floor((now / 1000) * SPRITE_SHEET.FPS + phase) % frames;

      ctx.drawImage(
        rimmed.canvas,
        frame * rimmed.cell,
        0,
        rimmed.cell,
        rimmed.cell,
        x - rimmed.cell / 2,
        y - rimmed.cell / 2,
        rimmed.cell,
        rimmed.cell,
      );

      const barW = big ? 38 : 26;
      const barH = big ? 4.5 : 3.5;
      drawMiniHealthBar(ctx, x, y - size / 2 - barH - 4, barW, barH, hpRatio, troop.colour);
      return;
    }

    // Sheet could not be measured — a cross-origin upload, or no 2D context.
    // Fall through to the drawn shape rather than blitting an unregistered
    // image, which is what produced three soldiers in one frame.
  }

  // Fallback geometric shape
  const radius = big ? 14 : 8;

  ctx.save();
  ctx.shadowColor = troop.colour;
  ctx.shadowBlur = big ? 18 : 8;

  ctx.fillStyle = troop.colour;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  if (big) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  // Draw mini HP bar above the shape
  const barW = big ? 30 : 20;
  const barH = big ? 4 : 3;
  const barY = y - radius - barH - 5;
  drawMiniHealthBar(ctx, x, barY, barW, barH, hpRatio, troop.colour);
}

