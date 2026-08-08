'use client';

import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { CASTLE_ANCHORS, CLASH_POINT, type LaneKey } from './BattleMap';

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

        drawUnit(ctx, x, y, troop);
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
 * One unit.
 *
 * Drawn rather than blitted from a sprite sheet: there is no sprite sheet yet,
 * and a shape that reads correctly beats a placeholder image that does not.
 * Swapping this for `drawImage` later touches only this function.
 */
function drawUnit(ctx: CanvasRenderingContext2D, x: number, y: number, troop: Troop) {
  const big = troop.type === 'meteor' || troop.type === 'dragon' || troop.type === 'cannon';
  const radius = big ? 9 : 4.5;

  ctx.save();

  // Glow, so a unit stays visible over any background the map happens to use.
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
}
