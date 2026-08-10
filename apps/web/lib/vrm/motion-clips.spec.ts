import { AvatarMotionKind } from '@livenova/shared';
import { blendPose, clipCycleMs, idlePose, samplePose, type Pose } from './motion-clips';

const ALL = Object.values(AvatarMotionKind);

/** Tổng độ lệch tuyệt đối giữa hai tư thế — dùng làm "hai tư thế này khác nhau". */
function distance(a: Pose, b: Pose): number {
  const keys = new Set([...Object.keys(a.rot), ...Object.keys(b.rot)]);
  let d = Math.abs(a.hipsY - b.hipsY);
  keys.forEach((k) => {
    const x = a.rot[k as keyof Pose['rot']] ?? [0, 0, 0];
    const y = b.rot[k as keyof Pose['rot']] ?? [0, 0, 0];
    d += Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]);
  });
  return d;
}

function isFinitePose(p: Pose): boolean {
  if (!Number.isFinite(p.hipsY)) return false;
  return Object.values(p.rot).every((r) => r.every((v) => Number.isFinite(v)));
}

describe('idlePose', () => {
  it('keeps moving — a character frozen mid-frame reads as a crashed source', () => {
    expect(distance(idlePose({ t: 0, time: 0, intensity: 1 }), idlePose({ t: 0, time: 0.9, intensity: 1 })))
      .toBeGreaterThan(0.01);
  });

  it('brings the arms down out of the T-pose the model loads in', () => {
    const pose = idlePose({ t: 0, time: 0, intensity: 1 });
    expect(pose.rot.leftUpperArm?.[2]).toBeGreaterThan(0.8);
    expect(pose.rot.rightUpperArm?.[2]).toBeLessThan(-0.8);
  });
});

describe('samplePose', () => {
  it.each(ALL)('%s produces a finite pose across the whole clip', (clip) => {
    for (let i = 0; i <= 20; i += 1) {
      const pose = samplePose(clip, { t: i / 20, time: i * 0.05, intensity: 1 });
      expect(isFinitePose(pose)).toBe(true);
    }
  });

  it.each(ALL)('%s actually departs from the resting pose', (clip) => {
    // A clip that never leaves idle is indistinguishable from a broken one, and
    // the viewer who paid for it sees nothing happen.
    const idle = idlePose({ t: 0, time: 0.5, intensity: 1 });
    const peak = Math.max(
      ...Array.from({ length: 21 }, (_, i) =>
        distance(idle, samplePose(clip, { t: i / 20, time: 0.5, intensity: 1 })),
      ),
    );
    expect(peak).toBeGreaterThan(0.2);
  });

  it.each(ALL)('%s scales with intensity', (clip) => {
    const idle = idlePose({ t: 0, time: 0.5, intensity: 1 });
    const at = (intensity: number) =>
      Math.max(
        ...Array.from({ length: 21 }, (_, i) =>
          distance(idle, samplePose(clip, { t: i / 20, time: 0.5, intensity })),
        ),
      );
    expect(at(1)).toBeGreaterThan(at(0));
  });

  it('spin ends where it began so the blend back does not unwind a whole turn', () => {
    // Leaving the final angle at 2π means interpolating from 2π to ~0 during the
    // 200ms fade out — a full reverse spin, on screen, every time.
    const end = samplePose(AvatarMotionKind.SPIN, { t: 1, time: 0, intensity: 1 });
    expect(end.rot.hips?.[1]).toBeCloseTo(0, 5);
  });

  it('bow returns to standing at both ends of a one-shot', () => {
    const start = samplePose(AvatarMotionKind.BOW, { t: 0, time: 0, intensity: 1 });
    const end = samplePose(AvatarMotionKind.BOW, { t: 1, time: 0, intensity: 1 });
    expect(start.rot.spine?.[0]).toBeCloseTo(0, 5);
    expect(end.rot.spine?.[0]).toBeCloseTo(0, 5);
  });

  it.each(ALL)('%s declares a usable cycle length', (clip) => {
    expect(clipCycleMs(clip)).toBeGreaterThan(0);
  });
});

describe('blendPose', () => {
  it('returns the base pose at weight 0', () => {
    const a = idlePose({ t: 0, time: 1, intensity: 1 });
    const b = samplePose(AvatarMotionKind.JUMP, { t: 0.5, time: 1, intensity: 1 });
    expect(distance(blendPose(a, b, 0), a)).toBeCloseTo(0, 6);
  });

  it('returns the target pose at weight 1', () => {
    const a = idlePose({ t: 0, time: 1, intensity: 1 });
    const b = samplePose(AvatarMotionKind.JUMP, { t: 0.5, time: 1, intensity: 1 });
    expect(distance(blendPose(a, b, 1), b)).toBeCloseTo(0, 6);
  });

  it('interpolates bones that exist on only one side', () => {
    // The idle pose has no legs; the jump does. Without treating the missing
    // side as zero, the legs would snap to full extension on the first frame.
    const a: Pose = { hipsY: 0, rot: { hips: [0, 0, 0] } };
    const b: Pose = { hipsY: 1, rot: { leftUpperLeg: [1, 0, 0] } };
    const mid = blendPose(a, b, 0.5);
    expect(mid.rot.leftUpperLeg?.[0]).toBeCloseTo(0.5, 6);
    expect(mid.rot.hips?.[0]).toBeCloseTo(0, 6);
    expect(mid.hipsY).toBeCloseTo(0.5, 6);
  });
});
