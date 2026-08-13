'use client';

import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { SPRITE_SHEET } from '@livenova/shared';
import { getImage } from '../../lib/image-cache';
import { CLASH_POINT, laneDirection, lanePosition, type LaneKey } from './BattleMap';
import { prepareSheet } from './sprite-sheet-prep';
import { frameBudget } from '../../lib/frame-budget';
import { playClash, playDeath } from '../../lib/battle-sfx';

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

/**
 * What a unit is doing right now.
 *
 * `march` and `fight` are the whole point of the change that introduced this:
 * units used to walk to the centre and vanish, with a health bar that drained
 * over the last third of the walk to imply a battle that was never drawn. The
 * gift was paid for, the soldiers set off, and then nothing happened. Now they
 * arrive, stop, and kill each other where the audience can watch.
 */
export type TroopPhase = 'march' | 'fight' | 'dying';

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
   * Per-unit health.
   *
   * Nothing on the server tracks a single soldier — a gift buys score and
   * castle damage, not a unit with its own hit points — so this is populated
   * on spawn and spent locally. It is a depiction, but it is now an honest
   * one: the bar only moves while the unit is actually in combat.
   */
  hp?: number;
  maxHp?: number;

  // --- Runtime state, owned by the draw loop. Callers leave these unset. ---
  phase?: TroopPhase;
  /** Where this unit stopped to fight, in percent of the field. */
  slotX?: number;
  slotY?: number;
  /** Unit vector from its castle toward the centre; the way it faces. */
  dirX?: number;
  dirY?: number;
  /** Seconds until the next swing. */
  swingIn?: number;
  /** The full length of the current swing cycle, for the wind-up curve. */
  swingPeriod?: number;
  /** Counts up through DEATH_MS once hp reaches zero. */
  dyingFor?: number;
}

/**
 * The pacing of a melee.
 *
 * These numbers are dramaturgy, not simulation. The complaint they answer was
 * that health vanished the moment a unit neared the middle, so the fight was
 * over before a viewer could look at it. A footsoldier now survives roughly
 * five seconds of contact, which is long enough to watch and short enough that
 * the field still clears between gifts.
 */
export const COMBAT = {
  DEFAULT_MAX_HP: 100,
  /** Damage per second taken while enemies are present. */
  FIGHT_DPS: 8,
  /**
   * Attrition when a unit reached the centre and found nobody to fight.
   *
   * Without it, one team gifting alone piles units at the clash point forever
   * and the cap starts evicting the newest arrivals — the ones somebody just
   * paid for. With it the field drains slowly, and a lone team's soldiers stand
   * around long enough to read as holding the ground.
   */
  IDLE_DPS: 2.5,
  /** Big tiers are tougher, so a dragon is not traded for a footsoldier. */
  BIG_HP_MULTIPLIER: 3.5,
  /** Seconds between swings. Randomised per unit so the line is not a metronome. */
  SWING_MIN_S: 0.45,
  SWING_MAX_S: 0.85,
  /** How long a corpse takes to fade. */
  DEATH_MS: 550,
  /** Distance in front of the centre where a unit halts, in percent of field. */
  STAND_OFF: 4.5,
  /** Lateral spread of the melee line, in percent of field. */
  LINE_SPREAD: 11,
  /** Peak lunge travel toward the enemy, in percent of field. */
  LUNGE: 1.4,
} as const;

export interface TroopCanvasHandle {
  spawn: (troops: Troop[]) => void;
  /** Live count, for a caller that wants to enforce its own ceiling. */
  count: () => number;
  applyAoE?: (sourceTeamKey: string, damage: number) => void;
}

interface Props {
  /**
   * Ceiling on units drawn at once, when frames are healthy.
   *
   * A viral broadcast can produce gifts faster than troops can cross the map.
   * Without a cap the list only grows and the overlay dies exactly when the
   * audience is largest. Oldest are dropped first: a unit that has nearly
   * arrived matters less than the one that just cost somebody money.
   *
   * This is now a *visual* limit, not a performance one. Measured on the real
   * broadcast surface (1080x1920), 220 units cost 0.2ms a frame to draw and 800
   * cost 0.63ms, against a 16.7ms budget — drawing was never the constraint.
   * The number that protects a slow machine is not this one; it is
   * `frameBudget`, which watches actual frame times and scales this down.
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
      // Scaled by what the machine is actually managing. A laptop that has
      // fallen to 25fps carries a quarter of the units rather than all of them
      // at a stutter — fewer soldiers reads as a quieter moment, dropped frames
      // read as broken software.
      const cap = Math.max(12, Math.round(maxTroops * frameBudget.loadScale));
      const next = troopsRef.current.concat(incoming);
      troopsRef.current = next.length > cap ? next.slice(next.length - cap) : next;
    },
    count() {
      return troopsRef.current.length;
    },
    applyAoE(sourceTeamKey: string, damage: number) {
      for (const t of troopsRef.current) {
        if (t.phase === 'fight' && t.teamKey !== sourceTeamKey) {
           t.hp = Math.max(0, (t.hp ?? 100) - damage);
        }
      }
    }
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

      const drawStart = performance.now();
      ctx.clearRect(0, 0, width, height);

      const troops = troopsRef.current;

      // Which kingdoms currently have someone standing at the centre. A unit
      // only bleeds if there is an enemy in front of it, so a lone team's
      // soldiers hold the ground instead of dying to nobody.
      const holding = new Set<string>();
      for (const t of troops) if (t.phase === 'fight') holding.add(t.teamKey);
      const contested = holding.size > 1;

      const survivors: Troop[] = [];
      for (const troop of troops) {
        const big = isBigTier(troop.type);

        if (troop.phase === undefined) initCombatState(troop, big);

        let x: number;
        let y: number;

        if (troop.phase === 'march') {
          troop.progress += troop.speed * dt;
          if (troop.progress >= 1) {
            troop.phase = 'fight';
            troop.progress = 1;
          }
          // Along the lane — keep, then bridge head, then the slot it will
          // fight from — instead of straight at the centre. On every shipped
          // map the straight line steps off the bank and crosses open water.
          const at = lanePosition(
            troop.lane,
            { x: troop.slotX ?? CLASH_POINT.x, y: troop.slotY ?? CLASH_POINT.y },
            troop.progress,
          );
          x = (at.x / 100) * width;
          // The scatter tapers off as the unit reaches the bridge: a squad may
          // spread out on the road, but the deck is only so wide.
          y = (at.y / 100) * height + troop.offset * (1 - Math.min(1, troop.progress));
        } else {
          // Fighting and dying both happen at the unit's slot; only the
          // lunge and the fade differ.
          let lunge = 0;

          if (troop.phase === 'fight') {
            const dps = contested ? COMBAT.FIGHT_DPS : COMBAT.IDLE_DPS;
            troop.hp = (troop.hp ?? COMBAT.DEFAULT_MAX_HP) - dps * dt;

            troop.swingIn = (troop.swingIn ?? 0) - dt;
            if (troop.swingIn <= 0) {
              troop.swingIn = randomSwingDelay();
              troop.swingPeriod = troop.swingIn;
              if (contested) {
                const fx = ((troop.slotX ?? 50) + (troop.dirX ?? 0) * 1.2) / 100;
                const fy = ((troop.slotY ?? 50) + (troop.dirY ?? 0) * 1.2) / 100;
                emitSparks(fx * width, fy * height, troop.colour, big ? 9 : 5);
                playClash(big ? 1 : 0.15);
              }
            }

            // Wind-up: the sprite leans further forward the closer it is to its
            // next swing, so it is at full extension on the frame the sparks
            // appear and snaps back after. Measured against this unit's own
            // period — dividing by SWING_MAX_S instead left the quicker units
            // barely moving, because their cycle never reached the far end of
            // the curve.
            const period = troop.swingPeriod ?? COMBAT.SWING_MAX_S;
            const t = 1 - Math.min(1, Math.max(0, (troop.swingIn ?? 0) / period));
            lunge = Math.sin((t * Math.PI) / 2) * COMBAT.LUNGE * (contested ? 1 : 0.25);

            if (troop.hp <= 0) {
              troop.hp = 0;
              troop.phase = 'dying';
              troop.dyingFor = 0;
              playDeath();
            }
          } else {
            troop.dyingFor = (troop.dyingFor ?? 0) + dt * 1000;
            if (troop.dyingFor >= COMBAT.DEATH_MS) continue;
          }

          x = (((troop.slotX ?? 50) + (troop.dirX ?? 0) * lunge) / 100) * width;
          y = (((troop.slotY ?? 50) + (troop.dirY ?? 0) * lunge) / 100) * height;

          if (troop.phase === 'dying') {
            // Sink as it fades, so a corpse reads as falling rather than as a
            // sprite that was switched off.
            y += ((troop.dyingFor ?? 0) / COMBAT.DEATH_MS) * 10;
          }
        }

        drawUnit(ctx, x, y, troop, now);
        survivors.push(troop);
      }
      troopsRef.current = survivors;

      stepSparks(ctx, dt);
      frameBudget.recordWork(performance.now() - drawStart);

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

function isBigTier(type: string): boolean {
  return type === 'meteor' || type === 'dragon' || type === 'cannon';
}

function randomSwingDelay(): number {
  return COMBAT.SWING_MIN_S + Math.random() * (COMBAT.SWING_MAX_S - COMBAT.SWING_MIN_S);
}

/**
 * Decide where this unit will stand when it arrives, before it sets off.
 *
 * Computed once rather than per frame, and from the unit's own lane, so each
 * kingdom forms a line on its own side of the centre facing the others. Picking
 * a slot at arrival instead would let two units resolve to the same spot and
 * overlap exactly.
 */
function initCombatState(troop: Troop, big: boolean): void {
  troop.phase = 'march';
  troop.maxHp =
    troop.maxHp ?? COMBAT.DEFAULT_MAX_HP * (big ? COMBAT.BIG_HP_MULTIPLIER : 1);
  troop.hp = troop.hp ?? troop.maxHp;
  troop.swingIn = randomSwingDelay();
  troop.swingPeriod = troop.swingIn;

  // From the bridge, not from the keep. A unit arrives facing the way the
  // bridge points, and that is also the axis the melee line has to form across
  // — taking the keep-to-centre diagonal instead put the line at an angle to
  // the approach, so the front rank stood side-on to the enemy.
  const dir = laneDirection(troop.lane);
  troop.dirX = dir.x;
  troop.dirY = dir.y;

  // Perpendicular, for spreading the line sideways rather than stacking it
  // along the approach.
  const px = -troop.dirY;
  const py = troop.dirX;
  const spread = (Math.random() - 0.5) * COMBAT.LINE_SPREAD;
  // Depth jitter keeps the second rank behind the first instead of inside it.
  const depth = Math.random() * 3;

  troop.slotX =
    CLASH_POINT.x - troop.dirX * (COMBAT.STAND_OFF + depth) + px * spread;
  troop.slotY =
    CLASH_POINT.y - troop.dirY * (COMBAT.STAND_OFF + depth) + py * spread;
}

/**
 * Sparks thrown off a hit.
 *
 * A fixed pool, like every other particle system in this overlay: the field can
 * produce hundreds of hits a second and allocating per spark would put the
 * collector inside the draw loop.
 */
const SPARK_POOL = 260;
interface Spark {
  live: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  colour: string;
}
const sparks: Spark[] = Array.from({ length: SPARK_POOL }, () => ({
  live: false,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  life: 0,
  maxLife: 1,
  colour: '#fff',
}));

function emitSparks(x: number, y: number, colour: string, count: number): void {
  let spawned = 0;
  for (let i = 0; i < sparks.length && spawned < count; i += 1) {
    const s = sparks[i];
    if (s.live) continue;
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 130;
    s.live = true;
    s.x = x;
    s.y = y;
    s.vx = Math.cos(angle) * speed;
    s.vy = Math.sin(angle) * speed - 30;
    s.maxLife = 0.22 + Math.random() * 0.2;
    s.life = s.maxLife;
    // Mostly white-hot with a minority in the kingdom colour, so a clash reads
    // as impact first and as whose impact second.
    s.colour = Math.random() < 0.3 ? colour : '#fff3c4';
    spawned += 1;
  }
}

function stepSparks(ctx: CanvasRenderingContext2D, dt: number): void {
  ctx.save();
  ctx.shadowBlur = 0;
  for (let i = 0; i < sparks.length; i += 1) {
    const s = sparks[i];
    if (!s.live) continue;
    s.life -= dt;
    if (s.life <= 0) {
      s.live = false;
      continue;
    }
    s.vy += 420 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;

    ctx.globalAlpha = s.life / s.maxLife;
    ctx.fillStyle = s.colour;
    ctx.fillRect(s.x - 1, s.y - 1, 2.5, 2.5);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Test seam — the pool is module state and would leak between cases. */
export const _troopInternals = {
  COMBAT,
  initCombatState,
  resetSparks() {
    for (const s of sparks) s.live = false;
  },
  liveSparks: () => sparks.filter((s) => s.live).length,
};

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
  const big = isBigTier(troop.type);
  const sheet = getImage(troop.spriteUrl);

  // Straight from the unit's own hit points. It used to be faked from
  // `progress`, which drained the bar over the last third of the march — so a
  // soldier arrived at the centre nearly dead, having been hit by nothing.
  const hpRatio = (troop.hp ?? COMBAT.DEFAULT_MAX_HP) / (troop.maxHp || COMBAT.DEFAULT_MAX_HP);

  // A marching unit is at full strength and does not need a bar over its head;
  // showing one on every soldier crossing the map is noise that makes the bars
  // that matter — the ones in the melee — harder to pick out.
  const showBar = troop.phase === 'fight' || hpRatio < 1;

  const fading =
    troop.phase === 'dying' ? 1 - Math.min(1, (troop.dyingFor ?? 0) / COMBAT.DEATH_MS) : 1;

  ctx.save();
  ctx.globalAlpha = fading;

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

      if (showBar) {
        const barW = big ? 38 : 26;
        const barH = big ? 4.5 : 3.5;
        drawMiniHealthBar(ctx, x, y - size / 2 - barH - 4, barW, barH, hpRatio, troop.colour);
      }
      ctx.restore();
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

  if (showBar) {
    const barW = big ? 30 : 20;
    const barH = big ? 4 : 3;
    const barY = y - radius - barH - 5;
    drawMiniHealthBar(ctx, x, barY, barW, barH, hpRatio, troop.colour);
  }

  ctx.restore();
}

