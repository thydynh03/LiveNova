import {
  AVATAR_MOTION_LIMITS,
  AvatarExpression,
  AvatarMotionKind,
  readAvatarMotionPayload,
} from './index';

describe('readAvatarMotionPayload', () => {
  const base = { clip: AvatarMotionKind.WAVE };

  describe('clip', () => {
    it('accepts every known clip', () => {
      Object.values(AvatarMotionKind).forEach((clip) => {
        expect(readAvatarMotionPayload({ clip })?.clip).toBe(clip);
      });
    });

    it('rejects an unknown clip — there is nothing to play', () => {
      expect(readAvatarMotionPayload({ clip: 'moonwalk' })).toBeNull();
      expect(readAvatarMotionPayload({})).toBeNull();
      expect(readAvatarMotionPayload(null)).toBeNull();
    });
  });

  describe('durationMs', () => {
    it('clamps a duration that would pin the character for the broadcast', () => {
      expect(readAvatarMotionPayload({ ...base, durationMs: 999_999_999 })?.durationMs).toBe(
        AVATAR_MOTION_LIMITS.MAX_DURATION_MS,
      );
    });

    it('raises a duration too short to be seen', () => {
      expect(readAvatarMotionPayload({ ...base, durationMs: 5 })?.durationMs).toBe(
        AVATAR_MOTION_LIMITS.MIN_DURATION_MS,
      );
    });

    it('falls back on a non-numeric duration', () => {
      [undefined, null, 'soon', NaN, Infinity].forEach((durationMs) => {
        expect(readAvatarMotionPayload({ ...base, durationMs })?.durationMs).toBe(
          AVATAR_MOTION_LIMITS.DEFAULT_DURATION_MS,
        );
      });
    });
  });

  describe('priority', () => {
    it('clamps out-of-range values instead of letting one rule outrank everything', () => {
      expect(readAvatarMotionPayload({ ...base, priority: 9999 })?.priority).toBe(
        AVATAR_MOTION_LIMITS.MAX_PRIORITY,
      );
      expect(readAvatarMotionPayload({ ...base, priority: -50 })?.priority).toBe(
        AVATAR_MOTION_LIMITS.MIN_PRIORITY,
      );
    });
  });

  describe('blendMs', () => {
    it('never lets the two blends exceed the motion they wrap', () => {
      // Without this the clip never reaches full weight and every gift, however
      // expensive, produces the same faint twitch.
      const result = readAvatarMotionPayload({ ...base, durationMs: 600, blendMs: 1000 });
      expect(result?.blendMs).toBe(300);
      expect((result?.blendMs ?? 0) * 2).toBeLessThanOrEqual(result?.durationMs ?? 0);
    });

    it('leaves a blend that already fits alone', () => {
      expect(readAvatarMotionPayload({ ...base, durationMs: 4000, blendMs: 250 })?.blendMs).toBe(250);
    });
  });

  describe('intensity', () => {
    it('clamps to 0..1', () => {
      expect(readAvatarMotionPayload({ ...base, intensity: 12 })?.intensity).toBe(1);
      expect(readAvatarMotionPayload({ ...base, intensity: -3 })?.intensity).toBe(0);
    });
  });

  describe('expression', () => {
    it('keeps a known expression', () => {
      expect(readAvatarMotionPayload({ ...base, expression: 'happy' })?.expression).toBe(
        AvatarExpression.HAPPY,
      );
    });

    it('drops an unknown expression rather than failing the motion', () => {
      // A neutral face is a far smaller loss than a character that does not move.
      const result = readAvatarMotionPayload({ ...base, expression: 'smug' });
      expect(result).not.toBeNull();
      expect(result?.expression).toBeUndefined();
    });
  });

  describe('loop', () => {
    it('only loops on an explicit true', () => {
      expect(readAvatarMotionPayload({ ...base, loop: true })?.loop).toBe(true);
      expect(readAvatarMotionPayload({ ...base, loop: 'yes' })?.loop).toBe(false);
      expect(readAvatarMotionPayload(base)?.loop).toBe(false);
    });
  });
});
