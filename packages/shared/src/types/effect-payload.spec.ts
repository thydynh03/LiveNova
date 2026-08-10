import { readEffectPayload, StageEffectKind, STAGE_EFFECT_LIMITS } from './index';

describe('readEffectPayload', () => {
  it('accepts a well-formed payload unchanged', () => {
    expect(
      readEffectPayload({
        kind: 'fireworks',
        durationMs: 6000,
        intensity: 0.8,
        color: '#ff00aa',
        caption: 'Cảm ơn Nguyễn Văn A',
      }),
    ).toEqual({
      kind: StageEffectKind.FIREWORKS,
      durationMs: 6000,
      intensity: 0.8,
      color: '#ff00aa',
      caption: 'Cảm ơn Nguyễn Văn A',
    });
  });

  describe('kind', () => {
    it.each([undefined, null, '', 'lasers', 42, {}])(
      'rejects the payload outright when kind is %p',
      (kind) => {
        expect(readEffectPayload({ kind, durationMs: 3000 })).toBeNull();
      },
    );

    it('rejects a null payload', () => {
      expect(readEffectPayload(null)).toBeNull();
    });

    it('accepts every declared kind', () => {
      for (const kind of Object.values(StageEffectKind)) {
        expect(readEffectPayload({ kind })?.kind).toBe(kind);
      }
    });
  });

  describe('durationMs', () => {
    it('clamps a runaway duration to the ceiling', () => {
      // The case this whole function exists for: rule JSON is not validated,
      // so an unclamped value would pin the effect over the broadcast.
      expect(readEffectPayload({ kind: 'smoke', durationMs: 999_999_999 })?.durationMs).toBe(
        STAGE_EFFECT_LIMITS.MAX_DURATION_MS,
      );
    });

    it('raises a too-short duration to the floor', () => {
      expect(readEffectPayload({ kind: 'smoke', durationMs: 10 })?.durationMs).toBe(
        STAGE_EFFECT_LIMITS.MIN_DURATION_MS,
      );
    });

    it.each([undefined, 'soon', NaN, Infinity])(
      'falls back to the default when durationMs is %p',
      (durationMs) => {
        expect(readEffectPayload({ kind: 'smoke', durationMs })?.durationMs).toBe(
          STAGE_EFFECT_LIMITS.DEFAULT_DURATION_MS,
        );
      },
    );

    it('rounds a fractional duration', () => {
      expect(readEffectPayload({ kind: 'smoke', durationMs: 1234.7 })?.durationMs).toBe(1235);
    });
  });

  describe('intensity', () => {
    it.each([
      [5, 1],
      [-3, 0],
      [0.42, 0.42],
    ])('clamps %p to %p', (input, expected) => {
      expect(readEffectPayload({ kind: 'shake', intensity: input })?.intensity).toBe(expected);
    });

    it.each([undefined, 'loud', NaN])('defaults when intensity is %p', (intensity) => {
      expect(readEffectPayload({ kind: 'shake', intensity })?.intensity).toBe(
        STAGE_EFFECT_LIMITS.DEFAULT_INTENSITY,
      );
    });
  });

  describe('color', () => {
    it('keeps a valid #RRGGBB value', () => {
      expect(readEffectPayload({ kind: 'confetti', color: '#00FF88' })?.color).toBe('#00FF88');
    });

    it.each(['red', '#fff', '#00ff8', 'rgb(0,0,0)', '#ggghhh', 0x00ff88, ''])(
      'drops the field rather than failing the action when color is %p',
      (color) => {
        const result = readEffectPayload({ kind: 'confetti', color });
        expect(result).not.toBeNull();
        expect(result).not.toHaveProperty('color');
      },
    );

    it('does not let a colour smuggle in a CSS expression', () => {
      expect(
        readEffectPayload({ kind: 'confetti', color: 'red; animation: none' }),
      ).not.toHaveProperty('color');
    });
  });

  describe('caption', () => {
    it('truncates to the caption limit', () => {
      const caption = readEffectPayload({ kind: 'hype', caption: 'x'.repeat(500) })?.caption;
      expect(caption).toHaveLength(STAGE_EFFECT_LIMITS.MAX_CAPTION_LENGTH);
    });

    it.each([undefined, '', 123])('omits the field when caption is %p', (caption) => {
      expect(readEffectPayload({ kind: 'hype', caption })).not.toHaveProperty('caption');
    });

    it('passes markup through as text for the renderer to escape', () => {
      // Not sanitised here on purpose — the overlay renders captions as a React
      // text node. This asserts the value survives intact so that a caption
      // containing a bracket is not silently mangled; the stage overlay's own
      // test covers the fact that it never becomes markup.
      expect(readEffectPayload({ kind: 'hype', caption: '<img onerror=x>' })?.caption).toBe(
        '<img onerror=x>',
      );
    });
  });
});
