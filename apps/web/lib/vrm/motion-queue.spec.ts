import {
  AVATAR_MOTION_LIMITS,
  AvatarExpression,
  AvatarMotionKind,
  type AvatarMotionPayload,
} from '@livenova/shared';
import { MotionQueue } from './motion-queue';

const cycleMs = () => 1000;

function motion(over: Partial<AvatarMotionPayload> = {}): AvatarMotionPayload {
  return {
    clip: AvatarMotionKind.WAVE,
    loop: false,
    durationMs: 2000,
    priority: 1,
    intensity: 0.5,
    blendMs: 200,
    ...over,
  };
}

describe('MotionQueue', () => {
  describe('merging', () => {
    it('folds a gift spam into one bigger motion instead of a queue', () => {
      // Twenty roses in a second is the case that decides whether the stage
      // survives peak hour: played sequentially the character is still waving
      // forty seconds after the gifts stopped.
      const q = new MotionQueue();
      for (let i = 0; i < 20; i += 1) {
        q.push(`g${i}`, motion({ clip: AvatarMotionKind.WAVE }), 1000 + i * 50);
      }

      expect(q.pendingCount).toBe(0);
      expect(q.activeClip).toBe(AvatarMotionKind.WAVE);
    });

    it('raises intensity when it merges', () => {
      const q = new MotionQueue();
      q.push('a', motion({ intensity: 0.2 }), 0);
      const before = q.sample(100, cycleMs).layers[0].intensity;

      q.push('b', motion({ intensity: 0.8 }), 200);
      const after = q.sample(300, cycleMs).layers[0].intensity;

      expect(after).toBeGreaterThan(before);
      expect(after).toBeLessThanOrEqual(1);
    });

    it('never lets a merge run past the hard duration ceiling', () => {
      const q = new MotionQueue();
      q.push('a', motion({ durationMs: AVATAR_MOTION_LIMITS.MAX_DURATION_MS }), 0);
      for (let i = 0; i < 30; i += 1) {
        q.push(`b${i}`, motion({ durationMs: AVATAR_MOTION_LIMITS.MAX_DURATION_MS }), 100 + i);
      }

      const past = AVATAR_MOTION_LIMITS.MAX_DURATION_MS * 2;
      expect(q.sample(past, cycleMs).layers.every((l) => l.weight === 0 || l.clip)).toBe(true);
      expect(q.activeClip).toBeNull();
    });

    it('does not merge a different clip', () => {
      const q = new MotionQueue();
      q.push('a', motion({ clip: AvatarMotionKind.WAVE }), 0);
      q.push('b', motion({ clip: AvatarMotionKind.BOW }), 100);

      expect(q.pendingCount).toBe(1);
    });

    it('does not merge once the window has passed', () => {
      const q = new MotionQueue();
      q.push('a', motion({ durationMs: 10_000 }), 0);
      q.push('b', motion(), AVATAR_MOTION_LIMITS.MERGE_WINDOW_MS + 1);

      expect(q.pendingCount).toBe(1);
    });
  });

  describe('priority', () => {
    it('interrupts a cheaper motion rather than queueing behind it', () => {
      const q = new MotionQueue();
      q.push('cheap', motion({ clip: AvatarMotionKind.WAVE, priority: 1 }), 0);
      q.push('rich', motion({ clip: AvatarMotionKind.SPIN, priority: 9 }), 100);

      expect(q.activeClip).toBe(AvatarMotionKind.SPIN);
      expect(q.pendingCount).toBe(0);
    });

    it('crossfades the interrupted motion out instead of cutting it', () => {
      const q = new MotionQueue();
      q.push('cheap', motion({ clip: AvatarMotionKind.WAVE, priority: 1 }), 0);
      q.push('rich', motion({ clip: AvatarMotionKind.SPIN, priority: 9 }), 500);

      const layers = q.sample(550, cycleMs).layers;
      expect(layers).toHaveLength(2);
      expect(layers[0].clip).toBe(AvatarMotionKind.WAVE);
      expect(layers[0].weight).toBeGreaterThan(0);
      expect(layers[1].clip).toBe(AvatarMotionKind.SPIN);
    });

    it('queues an equal or lower priority motion', () => {
      const q = new MotionQueue();
      q.push('a', motion({ clip: AvatarMotionKind.WAVE, priority: 5 }), 0);
      q.push('b', motion({ clip: AvatarMotionKind.BOW, priority: 5 }), 100);

      expect(q.activeClip).toBe(AvatarMotionKind.WAVE);
      expect(q.pendingCount).toBe(1);
    });

    it('runs the highest-priority waiting motion first', () => {
      const q = new MotionQueue();
      q.push('active', motion({ clip: AvatarMotionKind.WAVE, priority: 9, durationMs: 1000 }), 0);
      q.push('low', motion({ clip: AvatarMotionKind.CLAP, priority: 1 }), 10);
      q.push('high', motion({ clip: AvatarMotionKind.HEART, priority: 8 }), 20);

      q.sample(1100, cycleMs);
      expect(q.activeClip).toBe(AvatarMotionKind.HEART);
    });
  });

  describe('queue depth', () => {
    it('drops the lowest-priority waiting motion rather than growing forever', () => {
      const q = new MotionQueue();
      q.push('active', motion({ clip: AvatarMotionKind.WAVE, priority: 10 }), 0);
      for (let i = 0; i < 20; i += 1) {
        q.push(`q${i}`, motion({ clip: AvatarMotionKind.BOW, priority: 1 }), 100 + i * 2000);
      }

      expect(q.pendingCount).toBeLessThanOrEqual(AVATAR_MOTION_LIMITS.MAX_QUEUE_LENGTH);
      expect(q.dropped).toBeGreaterThan(0);
    });
  });

  describe('weights', () => {
    it('ramps in and out so the motion never snaps on or off', () => {
      const q = new MotionQueue();
      q.push('a', motion({ durationMs: 2000, blendMs: 200 }), 0);

      expect(q.sample(0, cycleMs).layers[0].weight).toBeCloseTo(0, 5);
      expect(q.sample(100, cycleMs).layers[0].weight).toBeCloseTo(0.5, 5);
      expect(q.sample(1000, cycleMs).layers[0].weight).toBe(1);
      expect(q.sample(1900, cycleMs).layers[0].weight).toBeCloseTo(0.5, 5);
    });

    it('holds full weight when there is no blend', () => {
      const q = new MotionQueue();
      q.push('a', motion({ blendMs: 0 }), 0);
      expect(q.sample(0, cycleMs).layers[0].weight).toBe(1);
    });
  });

  describe('progress', () => {
    it('repeats a looping clip on its natural cycle', () => {
      const q = new MotionQueue();
      q.push('a', motion({ loop: true, durationMs: 5000 }), 0);

      expect(q.sample(250, cycleMs).layers[0].t).toBeCloseTo(0.25, 5);
      expect(q.sample(1250, cycleMs).layers[0].t).toBeCloseTo(0.25, 5);
    });

    it('spreads a one-shot clip across its whole duration', () => {
      const q = new MotionQueue();
      q.push('a', motion({ loop: false, durationMs: 4000 }), 0);
      expect(q.sample(1000, cycleMs).layers[0].t).toBeCloseTo(0.25, 5);
    });
  });

  describe('expression', () => {
    it('tracks the active motion weight so the face fades with the body', () => {
      const q = new MotionQueue();
      q.push('a', motion({ expression: AvatarExpression.HAPPY, durationMs: 2000, blendMs: 200 }), 0);

      const s = q.sample(100, cycleMs);
      expect(s.expression?.name).toBe(AvatarExpression.HAPPY);
      expect(s.expression?.weight).toBeCloseTo(0.5, 5);
    });

    it('reports no expression once nothing is playing', () => {
      const q = new MotionQueue();
      q.push('a', motion({ expression: AvatarExpression.HAPPY, durationMs: 500 }), 0);
      expect(q.sample(5000, cycleMs).expression).toBeNull();
    });
  });

  describe('lifecycle', () => {
    it('falls back to nothing when the queue empties', () => {
      const q = new MotionQueue();
      q.push('a', motion({ durationMs: 500 }), 0);
      q.sample(600, cycleMs);
      expect(q.activeClip).toBeNull();
      expect(q.sample(2000, cycleMs).layers).toHaveLength(0);
    });

    it('clear() drops everything', () => {
      const q = new MotionQueue();
      q.push('a', motion({ clip: AvatarMotionKind.WAVE }), 0);
      q.push('b', motion({ clip: AvatarMotionKind.BOW }), 100);
      q.clear();

      expect(q.activeClip).toBeNull();
      expect(q.pendingCount).toBe(0);
    });
  });
});
