'use client';

/**
 * Watches how fast frames are actually arriving, and says how much work the
 * overlay is allowed to do.
 *
 * The number this replaces was `maxTroops = 220`, picked by hand and never
 * measured. Measuring it here says 220 units cost 0.2ms a frame to draw and 800
 * cost 0.63ms, against a 16.7ms budget — so on this machine the cap was never a
 * performance limit at all. But "this machine" is an RTX 3050, and the machine
 * that matters is a streamer's laptop already encoding 1080p60. Picking a new
 * constant from a fast machine would repeat the original mistake with fresher
 * numbers.
 *
 * So nothing is hard-coded from a benchmark. The overlay watches its own frame
 * times and lowers its own ceiling when they slip, which is correct on hardware
 * nobody here can test on.
 */

export type QualityTier = 'full' | 'reduced' | 'minimal';

/** 60fps leaves 16.7ms. Sustained frames slower than this mean we are late. */
const TARGET_MS = 16.7;
const REDUCE_AT_MS = 24; // ~42fps
const MINIMAL_AT_MS = 40; // ~25fps

/**
 * Rises fast, falls slow.
 *
 * Degrading has to happen within a second or two of the drop, or the audience
 * watches the stutter. Recovering has to be reluctant, or the overlay oscillates
 * between tiers every time a big gift lands — and flickering density reads as a
 * bug, worse than simply staying conservative.
 */
const WORSE_ALPHA = 0.25;
const BETTER_ALPHA = 0.03;

/** Ignore the first frames: mount, image decode and shader compile are not steady state. */
const WARMUP_FRAMES = 30;

class FrameBudget {
  private averageMs = TARGET_MS;
  private workAverageMs = 0;
  private workSamples = 0;
  private tier: QualityTier = 'full';
  private frames = 0;
  private last = 0;
  private running = false;
  private raf = 0;

  /** Rolling average frame time in ms, for anyone who wants to display it. */
  get frameMs(): number {
    return this.averageMs;
  }

  get quality(): QualityTier {
    return this.tier;
  }

  /**
   * Rolling average of time spent inside our own drawing, in ms.
   *
   * Separate from `frameMs` because they answer different questions. A frame
   * time of 40ms with 2ms of work means the machine is busy with something else
   * — usually the encoder — and shedding our load will not help much. The same
   * 40ms with 30ms of work means we are the problem.
   *
   * It is also the only figure that survives a hidden window: browsers throttle
   * animation frames to about one a second when the page is not visible, which
   * makes `frameMs` meaningless there, but the cost of one render is the cost of
   * one render either way.
   */
  get workMs(): number {
    return this.workAverageMs;
  }

  /** Called by a renderer with the duration of its own draw. */
  recordWork(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    this.workSamples += 1;
    // Plain average over the first samples, then rolling, so an early reading
    // is not dominated by whatever the first frame happened to cost.
    const alpha = this.workSamples < 20 ? 1 / this.workSamples : 0.05;
    this.workAverageMs += (ms - this.workAverageMs) * alpha;
  }

  /**
   * Scale factor for anything counted per unit.
   *
   * Applied to the troop ceiling, so a struggling machine simply carries fewer
   * units rather than dropping frames with all of them.
   */
  get loadScale(): number {
    return this.tier === 'full' ? 1 : this.tier === 'reduced' ? 0.5 : 0.25;
  }

  start(): void {
    if (this.running || typeof window === 'undefined') return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = (now: number) => {
    const delta = now - this.last;
    this.last = now;

    // A hidden page has its animation frames throttled to roughly one a second
    // by the browser. Feeding that in would read as a catastrophic frame time
    // and drop the overlay to minimum quality — so that when the streamer
    // brought the window back it would be showing a quarter of the units for no
    // reason. Skip the sample instead.
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';

    if (!hidden && this.frames++ > WARMUP_FRAMES && delta > 0 && delta < 1000) {
      const alpha = delta > this.averageMs ? WORSE_ALPHA : BETTER_ALPHA;
      this.averageMs += (delta - this.averageMs) * alpha;

      // Hysteresis: the thresholds to come back are stricter than the ones to
      // fall, so a frame time hovering on a boundary does not flap.
      if (this.averageMs > MINIMAL_AT_MS) this.tier = 'minimal';
      else if (this.averageMs > REDUCE_AT_MS) this.tier = 'reduced';
      else if (this.averageMs < REDUCE_AT_MS * 0.8) this.tier = 'full';
    }

    if (this.running) this.raf = requestAnimationFrame(this.tick);
  };

  /** Test seam — the tier is otherwise only reachable by actually dropping frames. */
  _forFrameTime(ms: number): void {
    this.averageMs = ms;
    if (ms > MINIMAL_AT_MS) this.tier = 'minimal';
    else if (ms > REDUCE_AT_MS) this.tier = 'reduced';
    else if (ms < REDUCE_AT_MS * 0.8) this.tier = 'full';
  }

  _reset(): void {
    this.averageMs = TARGET_MS;
    this.workAverageMs = 0;
    this.workSamples = 0;
    this.tier = 'full';
    this.frames = 0;
  }
}

/**
 * One monitor for the whole overlay.
 *
 * Both renderers draw into the same window and compete for the same frame, so
 * two separate monitors would each see the other's cost and both degrade.
 */
export const frameBudget = new FrameBudget();

// Reachable from the browser console on purpose. When a streamer reports that
// the overlay stutters, the useful question is whether their frame time is bad
// because of our drawing or because the encoder has the machine — and the only
// way to ask it is on their machine, over a support chat.
if (typeof window !== 'undefined') {
  (window as unknown as { livenovaFrameBudget?: FrameBudget }).livenovaFrameBudget = frameBudget;
}
