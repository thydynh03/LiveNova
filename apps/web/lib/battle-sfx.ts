'use client';

/**
 * Combat sound for the battle overlay, synthesised rather than loaded.
 *
 * Every alternative meant shipping audio files: another upload for the admin to
 * curate, another asset that can 404 mid-broadcast, another few hundred KB an
 * OBS browser source has to fetch before the first clash makes a noise. A sword
 * hit is a noise burst and a short metallic ring — the Web Audio API already
 * has both, and a synthesised one is never missing.
 *
 * ## Why the throttle is not optional
 *
 * Two hundred units meeting in the middle produce hundreds of hits a second. As
 * individual sounds that is not a battle, it is white noise, and it arrives on
 * the streamer's broadcast where they cannot mute it without muting themselves.
 * So hits share a token bucket: the field gets a *rate* of clashing, and past
 * that rate extra hits are folded into the ones already playing rather than
 * layered on top.
 */

const CLASH_LIMITS = {
  /** Hits per second that actually reach the speakers. */
  MAX_PER_SEC: 7,
  /** Never two sounds closer than this, even inside the budget. */
  MIN_GAP_MS: 70,
  /** Master ceiling. Rules and templates may only go below this. */
  MAX_VOLUME: 0.5,
} as const;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let enabled = true;
let volume = 0.28;

/**
 * Token bucket, refilled continuously at MAX_PER_SEC.
 *
 * `null` means "not yet", which is not the same as "at time zero" — a plain 0
 * made the very first clash of a broadcast fall inside MIN_GAP_MS of an event
 * that never happened, so the first sword swing of the fight was silent.
 */
let tokens: number = CLASH_LIMITS.MAX_PER_SEC;
let lastRefill: number | null = null;
let lastPlay: number | null = null;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : 0;
}

/**
 * Lazily build the graph.
 *
 * Returns null anywhere Web Audio is absent — jsdom under test, and any browser
 * that refuses to construct a context before a gesture. A silent battle is a
 * degraded battle; a battle that throws is a black overlay.
 */
function audio(): { ctx: AudioContext; master: GainNode } | null {
  if (!enabled) return null;
  if (ctx && master) {
    // OBS suspends the context when a scene is not visible and does not always
    // resume it on the way back, which is heard as sound that works until the
    // first scene change and never again.
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return { ctx, master };
  }

  const Ctor =
    typeof window !== 'undefined'
      ? window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!Ctor) return null;

  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = Math.min(volume, CLASH_LIMITS.MAX_VOLUME);
    master.connect(ctx.destination);

    // One second of white noise, reused by every hit. Generating it per clash
    // would allocate a fresh Float32Array inside the draw loop.
    const frames = Math.floor(ctx.sampleRate * 0.4);
    noiseBuffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;

    return { ctx, master };
  } catch {
    ctx = null;
    master = null;
    return null;
  }
}

/** Take a token if the rate allows it. */
function claim(): boolean {
  const t = now();
  if (lastRefill === null) lastRefill = t;

  tokens = Math.min(
    CLASH_LIMITS.MAX_PER_SEC,
    tokens + ((t - lastRefill) / 1000) * CLASH_LIMITS.MAX_PER_SEC,
  );
  lastRefill = t;

  if (tokens < 1) return false;
  if (lastPlay !== null && t - lastPlay < CLASH_LIMITS.MIN_GAP_MS) return false;

  tokens -= 1;
  lastPlay = t;
  return true;
}

/**
 * One sword hit.
 *
 * `weight` 0..1 separates a footsoldier from a dragon: it lengthens the ring
 * and drops its pitch, which is what makes a heavy unit sound heavy without a
 * second sample.
 */
export function playClash(weight = 0): void {
  const a = audio();
  if (!a || !noiseBuffer) return;
  if (!claim()) return;

  const w = Math.min(Math.max(weight, 0), 1);
  const t0 = a.ctx.currentTime;
  const ring = 0.09 + w * 0.16;

  try {
    // Impact: filtered noise, very short. This is the "hit" the ear localises.
    const noise = a.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const band = a.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2400 - w * 900;
    band.Q.value = 0.9;

    const noiseGain = a.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);

    noise.connect(band).connect(noiseGain).connect(a.master);
    noise.start(t0);
    noise.stop(t0 + 0.08);

    // Ring: two detuned partials. The beat between them is what reads as metal
    // rather than as a click.
    for (const [mult, level] of [
      [1, 0.5],
      [1.48, 0.28],
    ] as const) {
      const osc = a.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime((1750 - w * 620) * mult, t0);
      osc.frequency.exponentialRampToValueAtTime((1180 - w * 430) * mult, t0 + ring);

      const gain = a.ctx.createGain();
      gain.gain.setValueAtTime(level, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + ring);

      osc.connect(gain).connect(a.master);
      osc.start(t0);
      osc.stop(t0 + ring + 0.02);
    }
  } catch {
    // A context that died mid-broadcast must not take the render loop with it.
  }
}

/** A unit falling. Duller and lower than a hit, so deaths read as separate. */
export function playDeath(): void {
  const a = audio();
  if (!a || !noiseBuffer) return;
  if (!claim()) return;

  const t0 = a.ctx.currentTime;
  try {
    const noise = a.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const low = a.ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.setValueAtTime(900, t0);
    low.frequency.exponentialRampToValueAtTime(160, t0 + 0.25);

    const gain = a.ctx.createGain();
    gain.gain.setValueAtTime(0.55, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);

    noise.connect(low).connect(gain).connect(a.master);
    noise.start(t0);
    noise.stop(t0 + 0.32);
  } catch {
    /* see playClash */
  }
}

/** Streamers who want silence get silence; the overlay keeps rendering. */
export function setBattleSfxEnabled(next: boolean): void {
  enabled = next;
  if (master) master.gain.value = next ? Math.min(volume, CLASH_LIMITS.MAX_VOLUME) : 0;
}

export function setBattleSfxVolume(next: number): void {
  volume = Math.min(Math.max(next, 0), CLASH_LIMITS.MAX_VOLUME);
  if (master && enabled) master.gain.value = volume;
}

export const _sfxInternals = {
  LIMITS: CLASH_LIMITS,
  claim,
  reset() {
    tokens = CLASH_LIMITS.MAX_PER_SEC;
    lastRefill = null;
    lastPlay = null;
    enabled = true;
    volume = 0.28;
    ctx = null;
    master = null;
    noiseBuffer = null;
  },
};
