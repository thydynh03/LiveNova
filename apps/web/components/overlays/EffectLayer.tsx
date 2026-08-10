'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { EffectPayload, StageEffectKind, STAGE_EFFECT_LIMITS } from '@livenova/shared';

export interface ActiveEffect {
  /** OverlayAction.id — unique per dispatch. */
  id: string;
  payload: EffectPayload;
  /** performance.now() at the moment the action arrived. */
  startedAt: number;
}

interface EffectLayerProps {
  effects: ActiveEffect[];
  /** Set by the page from a media query; passed in so the page can also use it. */
  reducedMotion?: boolean;
}

/** Fallback palettes, used when the rule author did not pick a colour. */
const DEFAULT_COLORS: Record<StageEffectKind, string[]> = {
  [StageEffectKind.CONFETTI]: ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff'],
  [StageEffectKind.FIREWORKS]: ['#ffd166', '#ff4d6d', '#4cc9f0', '#ffffff'],
  [StageEffectKind.SMOKE]: ['#cfd8dc'],
  [StageEffectKind.STROBE]: ['#ffffff'],
  [StageEffectKind.SHAKE]: ['#ffffff'],
  [StageEffectKind.HYPE]: ['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0'],
};

/**
 * Preallocated once and reused for the life of the page.
 *
 * Allocating inside the draw loop is what turns a busy stream into a stuttering
 * browser source: the collector runs during frames rather than between them.
 */
const POOL_SIZE = 700;

/** Emission rate at intensity 1. Scaled linearly by intensity. */
const CONFETTI_PER_SECOND = 140;
const FIREWORK_INTERVAL_MS = 420;
const FIREWORK_PARTICLES = 70;

const GRAVITY = 420; // px/s²
const DRAG = 0.55; // per second

interface Particle {
  live: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds remaining. */
  life: number;
  maxLife: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  /** Confetti draws as a tumbling rectangle, fireworks as a fading dot. */
  ribbon: boolean;
}

function makePool(): Particle[] {
  return Array.from({ length: POOL_SIZE }, () => ({
    live: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 0,
    rot: 0,
    vr: 0,
    color: '#fff',
    ribbon: false,
  }));
}

interface Emitter {
  kind: StageEffectKind;
  endsAt: number;
  intensity: number;
  colors: string[];
  /** Carries the fractional part of "particles owed this frame". */
  debt: number;
  nextBurstAt: number;
}

function pickColor(colors: string[]): string {
  return colors[(Math.random() * colors.length) | 0] ?? '#ffffff';
}

/**
 * Canvas particles plus the CSS-driven layers, for one OBS browser source.
 *
 * Everything animated shares a single requestAnimationFrame loop. Per-effect
 * timers were the alternative and they do not survive a long broadcast: each
 * effect would install its own interval, and a dropped cleanup leaks one timer
 * per gift for the length of the stream.
 */
export function EffectLayer({ effects, reducedMotion = false }: EffectLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const poolRef = useRef<Particle[]>();
  const emittersRef = useRef<Map<string, Emitter>>(new Map());
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);

  if (!poolRef.current) poolRef.current = makePool();

  // Register/retire canvas emitters as effects come and go. Only CONFETTI,
  // FIREWORKS and HYPE draw particles; the rest are CSS layers below.
  useEffect(() => {
    const emitters = emittersRef.current;
    const seen = new Set<string>();

    for (const effect of effects) {
      const { kind, intensity, color, durationMs } = effect.payload;
      const emits =
        kind === StageEffectKind.CONFETTI ||
        kind === StageEffectKind.FIREWORKS ||
        kind === StageEffectKind.HYPE;
      if (!emits) continue;

      seen.add(effect.id);
      if (emitters.has(effect.id)) continue;

      emitters.set(effect.id, {
        kind,
        endsAt: effect.startedAt + durationMs,
        intensity,
        colors: color ? [color] : DEFAULT_COLORS[kind],
        debt: 0,
        nextBurstAt: effect.startedAt,
      });
    }

    for (const id of Array.from(emitters.keys())) {
      if (!seen.has(id)) emitters.delete(id);
    }
  }, [effects]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pool = poolRef.current!;
    const emitters = emittersRef.current;
    let disposed = false;

    const resize = () => {
      // OBS renders at a fixed size, but the dashboard preview does not, and a
      // canvas whose backing store never matches its box draws blurred.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const spawn = (init: (p: Particle) => void): boolean => {
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (p.live) continue;
        p.live = true;
        init(p);
        return true;
      }
      // Pool exhausted. Dropping the particle is the correct failure: growing
      // the pool under load is how a browser source runs out of memory.
      return false;
    };

    const spawnConfetti = (emitter: Emitter, width: number) => {
      spawn((p) => {
        p.x = Math.random() * width;
        p.y = -20;
        p.vx = (Math.random() - 0.5) * 120;
        p.vy = 60 + Math.random() * 140;
        p.maxLife = 2.6 + Math.random() * 1.4;
        p.life = p.maxLife;
        p.size = 5 + Math.random() * 7;
        p.rot = Math.random() * Math.PI;
        p.vr = (Math.random() - 0.5) * 9;
        p.color = pickColor(emitter.colors);
        p.ribbon = true;
      });
    };

    const spawnBurst = (emitter: Emitter, width: number, height: number) => {
      const cx = width * (0.15 + Math.random() * 0.7);
      const cy = height * (0.1 + Math.random() * 0.45);
      const count = Math.max(12, Math.round(FIREWORK_PARTICLES * emitter.intensity));
      const color = pickColor(emitter.colors);
      const speed = 140 + Math.random() * 160;

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.15;
        const v = speed * (0.6 + Math.random() * 0.5);
        const ok = spawn((p) => {
          p.x = cx;
          p.y = cy;
          p.vx = Math.cos(angle) * v;
          p.vy = Math.sin(angle) * v;
          p.maxLife = 1.1 + Math.random() * 0.7;
          p.life = p.maxLife;
          p.size = 2.5 + Math.random() * 2;
          p.rot = 0;
          p.vr = 0;
          p.color = color;
          p.ribbon = false;
        });
        if (!ok) break;
      }
    };

    const frame = (now: number) => {
      if (disposed) return;

      const last = lastFrameRef.current || now;
      // Clamped: a browser source that was throttled in a hidden tab returns
      // with a multi-second delta, and integrating that in one step teleports
      // every particle off screen.
      const dt = Math.min((now - last) / 1000, 1 / 20);
      lastFrameRef.current = now;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      for (const [id, emitter] of Array.from(emitters.entries())) {
        if (now >= emitter.endsAt) {
          emitters.delete(id);
          continue;
        }
        if (emitter.kind === StageEffectKind.FIREWORKS) {
          if (now >= emitter.nextBurstAt) {
            spawnBurst(emitter, width, height);
            emitter.nextBurstAt = now + FIREWORK_INTERVAL_MS / Math.max(emitter.intensity, 0.2);
          }
        } else {
          emitter.debt += CONFETTI_PER_SECOND * emitter.intensity * dt;
          const due = Math.floor(emitter.debt);
          emitter.debt -= due;
          for (let i = 0; i < due; i++) spawnConfetti(emitter, width);
        }
      }

      ctx.clearRect(0, 0, width, height);

      let alive = 0;
      const decay = Math.exp(-DRAG * dt);

      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (!p.live) continue;

        p.life -= dt;
        if (p.life <= 0) {
          p.live = false;
          continue;
        }
        alive++;

        p.vy += GRAVITY * dt * (p.ribbon ? 0.35 : 1);
        p.vx *= decay;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;

        if (p.y - p.size > height) {
          p.live = false;
          alive--;
          continue;
        }

        ctx.globalAlpha = Math.min(1, p.life / (p.maxLife * 0.35));
        ctx.fillStyle = p.color;

        if (p.ribbon) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      if (alive > 0 || emitters.size > 0) {
        frameRef.current = requestAnimationFrame(frame);
      } else {
        // Idle streams should cost nothing. The effects prop restarts us.
        frameRef.current = null;
        lastFrameRef.current = 0;
      }
    };

    const start = () => {
      if (frameRef.current === null && (emitters.size > 0 || !disposed)) {
        lastFrameRef.current = 0;
        frameRef.current = requestAnimationFrame(frame);
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
      } else {
        lastFrameRef.current = 0;
        start();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    start();

    return () => {
      disposed = true;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const p of pool) p.live = false;
      emitters.clear();
    };
  }, [effects]);

  const smoke = useMemo(
    () => effects.filter((e) => e.payload.kind === StageEffectKind.SMOKE),
    [effects],
  );

  const flashing = useMemo(
    () =>
      effects.filter(
        (e) =>
          e.payload.kind === StageEffectKind.STROBE || e.payload.kind === StageEffectKind.HYPE,
      ),
    [effects],
  );

  // One cycle at the hard frequency cap. `intensity` may lower the contrast,
  // never raise the rate — see STAGE_EFFECT_LIMITS.MAX_FLASH_HZ.
  const flashPeriodMs = 1000 / STAGE_EFFECT_LIMITS.MAX_FLASH_HZ;

  return (
    <>
      <style>{`
        @keyframes ln-strobe {
          0%, 100% { opacity: 0; }
          50%      { opacity: var(--ln-peak, 0.4); }
        }
        @keyframes ln-smoke-rise {
          from { transform: translate3d(0, 30%, 0) scale(1);   opacity: 0; }
          20%  { opacity: var(--ln-peak, 0.5); }
          to   { transform: translate3d(0, -60%, 0) scale(1.6); opacity: 0; }
        }
        @keyframes ln-fade-hold {
          0%   { opacity: 0; }
          15%  { opacity: var(--ln-peak, 0.4); }
          85%  { opacity: var(--ln-peak, 0.4); }
          100% { opacity: 0; }
        }
      `}</style>

      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />

      {smoke.map((effect) => {
        const color = effect.payload.color ?? DEFAULT_COLORS[StageEffectKind.SMOKE][0];
        const peak = 0.15 + effect.payload.intensity * 0.45;
        return (
          <div
            key={effect.id}
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              overflow: 'hidden',
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={
                  {
                    position: 'absolute',
                    bottom: '-25%',
                    left: `${i * 27 - 10}%`,
                    width: '55%',
                    height: '70%',
                    borderRadius: '50%',
                    background: `radial-gradient(circle at 50% 60%, ${color}, transparent 70%)`,
                    filter: 'blur(42px)',
                    '--ln-peak': peak,
                    animation: reducedMotion
                      ? `ln-fade-hold ${effect.payload.durationMs}ms ease-in-out forwards`
                      : `ln-smoke-rise ${2600 + i * 500}ms ease-out ${i * 180}ms infinite`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        );
      })}

      {flashing.map((effect) => {
        const color = effect.payload.color ?? '#ffffff';
        // Capped well below full white: a 100%-contrast flash at any rate is
        // the thing the frequency limit exists to avoid in the first place.
        const peak = Math.min(0.6, 0.15 + effect.payload.intensity * 0.45);
        // HYPE only flashes briefly; the rest of its duration is confetti.
        const runMs =
          effect.payload.kind === StageEffectKind.HYPE
            ? Math.min(800, effect.payload.durationMs)
            : effect.payload.durationMs;

        return (
          <div
            key={effect.id}
            aria-hidden
            style={
              {
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: color,
                mixBlendMode: 'screen',
                opacity: 0,
                '--ln-peak': peak,
                animation: reducedMotion
                  ? // Reduced motion gets one steady glow instead of a pulse.
                    `ln-fade-hold ${runMs}ms ease-in-out forwards`
                  : `ln-strobe ${flashPeriodMs}ms steps(1, end) ${Math.floor(
                      runMs / flashPeriodMs,
                    )}`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </>
  );
}

export default EffectLayer;
