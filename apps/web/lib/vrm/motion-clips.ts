import { AvatarMotionKind } from '@livenova/shared';

/**
 * Động tác procedural cho nhân vật VRM.
 *
 * Đây là bước đệm có chủ đích, không phải giải pháp cuối. Định dạng `.vrma`
 * (qua `@pixiv/three-vrm-animation`) mới là nơi các động tác phức tạp nên nằm,
 * nhưng nó kéo theo một gói phụ thuộc nữa và một kho asset phải dựng, phải
 * host, phải phiên bản hoá. Viết tay sáu động tác cho phép toàn bộ đường ống
 * quà tặng → sân khấu chạy thật ngay hôm nay, và khi `.vrma` vào thì chỉ có
 * `sample()` bên dưới bị thay — hàng đợi, độ ưu tiên, hoà trộn và biểu cảm ở
 * `motion-queue.ts` không đổi một dòng.
 *
 * Mọi góc xoay là radian, trong không gian xương *chuẩn hoá* của VRM
 * (`getNormalizedBoneNode`), nên cùng một tư thế cho ra cùng một dáng trên mọi
 * mô hình bất kể tỉ lệ xương gốc.
 */

export type BoneKey =
  | 'hips'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'leftUpperArm'
  | 'leftLowerArm'
  | 'rightUpperArm'
  | 'rightLowerArm'
  | 'leftUpperLeg'
  | 'rightUpperLeg';

/** Euler XYZ, radian. */
export type Euler3 = [number, number, number];

export interface Pose {
  rot: Partial<Record<BoneKey, Euler3>>;
  /** Dịch chuyển hông theo chiều dọc, mét. */
  hipsY: number;
}

export interface SampleContext {
  /** Tiến độ 0..1 qua một lượt diễn. */
  t: number;
  /** Giây kể từ khi trang mở — dành cho những chuyển động không theo lượt. */
  time: number;
  /** 0..1, nhân vào biên độ. */
  intensity: number;
}

/**
 * Tay ở tư thế nghỉ.
 *
 * Mô hình VRM đứng ở tư thế chữ T, tay dang ngang. Không có hằng số này thì
 * "tư thế mặc định" là dang tay, và mọi động tác phải tự nhớ hạ tay xuống.
 */
const ARM_REST_L = 1.05;
const ARM_REST_R = -1.05;

const TAU = Math.PI * 2;

/** Biên độ: cường độ 0 vẫn thấy được, cường độ 1 là hết cỡ. */
function amp(intensity: number) {
  return 0.45 + 0.55 * Math.min(Math.max(intensity, 0), 1);
}

/**
 * Tư thế nền — thở, đảo người rất nhẹ.
 *
 * Chạy theo đồng hồ tường chứ không theo tiến độ lượt diễn: đây là trạng thái
 * nhân vật luôn ở trong, không phải một lượt có đầu có cuối.
 */
export function idlePose({ time }: SampleContext): Pose {
  return {
    hipsY: Math.sin(time * 2.2) * 0.02,
    rot: {
      hips: [0, Math.sin(time * 0.9) * 0.12, 0],
      spine: [0, 0, Math.sin(time * 1.1) * 0.05],
      head: [0, 0, Math.sin(time * 0.7) * 0.06],
      leftUpperArm: [0, 0, ARM_REST_L + Math.sin(time * 2.0) * 0.08],
      rightUpperArm: [0, 0, ARM_REST_R - Math.sin(time * 2.0 + 1) * 0.08],
    },
  };
}

/** 0 → 1 → 0, mượt hai đầu. Dùng cho động tác một lượt. */
function arc(t: number) {
  return Math.sin(Math.min(Math.max(t, 0), 1) * Math.PI);
}

/** Lên nhanh, giữ, xuống nhanh — cho động tác cần "giữ dáng" ở giữa. */
function hold(t: number, edge = 0.22) {
  const up = Math.min(1, t / edge);
  const down = Math.min(1, (1 - t) / edge);
  return Math.min(Math.max(Math.min(up, down), 0), 1);
}

type Sampler = (ctx: SampleContext) => Pose;

interface ClipDef {
  sample: Sampler;
  /** Độ dài tự nhiên của một lượt, ms. Chỉ dùng khi `loop` bật. */
  cycleMs: number;
}

const CLIPS: Record<AvatarMotionKind, ClipDef> = {
  [AvatarMotionKind.WAVE]: {
    cycleMs: 900,
    sample: ({ t, intensity }) => {
      const a = amp(intensity);
      const swing = Math.sin(t * TAU);
      return {
        hipsY: 0,
        rot: {
          spine: [0, 0, -0.06 * a],
          head: [0, 0.12 * a, -0.1 * a],
          leftUpperArm: [0, 0, ARM_REST_L],
          rightUpperArm: [-0.18 * a, 0, ARM_REST_R + 0.75 * a],
          rightLowerArm: [0, 0.35 + swing * 0.6 * a, 0],
        },
      };
    },
  },

  [AvatarMotionKind.BOW]: {
    cycleMs: 1400,
    sample: ({ t, intensity }) => {
      const a = arc(t) * amp(intensity);
      return {
        hipsY: -0.09 * a,
        rot: {
          spine: [0.55 * a, 0, 0],
          chest: [0.22 * a, 0, 0],
          head: [0.26 * a, 0, 0],
          leftUpperArm: [0.22 * a, 0, ARM_REST_L - 0.1 * a],
          rightUpperArm: [0.22 * a, 0, ARM_REST_R + 0.1 * a],
        },
      };
    },
  },

  [AvatarMotionKind.JUMP]: {
    cycleMs: 680,
    sample: ({ t, intensity }) => {
      const a = amp(intensity);
      // Nửa hình sin: chân rời đất rồi chạm lại trong một lượt, không lơ lửng.
      const hop = Math.max(0, Math.sin(t * Math.PI)) * a;
      return {
        hipsY: 0.3 * hop,
        rot: {
          head: [-0.12 * hop, 0, 0],
          chest: [-0.08 * hop, 0, 0],
          leftUpperArm: [0, 0, ARM_REST_L - 0.95 * hop],
          rightUpperArm: [0, 0, ARM_REST_R + 0.95 * hop],
          leftUpperLeg: [-0.55 * hop, 0, 0],
          rightUpperLeg: [-0.55 * hop, 0, 0],
        },
      };
    },
  },

  [AvatarMotionKind.CLAP]: {
    cycleMs: 460,
    sample: ({ t, intensity }) => {
      const a = amp(intensity);
      const c = (Math.sin(t * TAU) + 1) / 2;
      return {
        hipsY: 0.01 * c * a,
        rot: {
          chest: [0.07 * a, 0, 0],
          head: [0.06 * a, 0, 0],
          leftUpperArm: [0.4 * a, 0, ARM_REST_L - 0.5 * a],
          // Khuỷu tay gập quanh trục Y vì cánh tay chuẩn hoá nằm dọc trục X.
          leftLowerArm: [0, -1.05 - 0.3 * c * a, 0],
          rightUpperArm: [0.4 * a, 0, ARM_REST_R + 0.5 * a],
          rightLowerArm: [0, 1.05 + 0.3 * c * a, 0],
        },
      };
    },
  },

  [AvatarMotionKind.HEART]: {
    cycleMs: 2000,
    sample: ({ t, intensity, time }) => {
      const a = hold(t) * amp(intensity);
      const sway = Math.sin(time * 2.4) * 0.05 * a;
      return {
        hipsY: 0.01 * a,
        rot: {
          spine: [0, 0, sway],
          head: [-0.14 * a, 0, sway * 1.5],
          leftUpperArm: [0, 0, ARM_REST_L - 1.35 * a],
          leftLowerArm: [0, -0.95 * a, 0],
          rightUpperArm: [0, 0, ARM_REST_R + 1.35 * a],
          rightLowerArm: [0, 0.95 * a, 0],
        },
      };
    },
  },

  [AvatarMotionKind.SPIN]: {
    cycleMs: 1200,
    sample: ({ t, intensity }) => {
      const a = amp(intensity);
      // Quy về [0, 2π): tại t = 1 giá trị là 0, cùng một hướng nhìn với 2π.
      // Nếu để nguyên 2π thì lúc hoà trộn về tư thế nghỉ, phép nội suy sẽ quay
      // ngược cả vòng trong 200ms.
      const angle = (t * TAU) % TAU;
      return {
        hipsY: Math.sin(t * TAU * 2) * 0.03 * a,
        rot: {
          hips: [0, angle, 0],
          spine: [0, 0, 0.06 * a],
          leftUpperArm: [0, 0, ARM_REST_L - 0.3 * a],
          rightUpperArm: [0, 0, ARM_REST_R + 0.3 * a],
        },
      };
    },
  },
};

export function clipCycleMs(clip: AvatarMotionKind): number {
  return CLIPS[clip].cycleMs;
}

export function samplePose(clip: AvatarMotionKind, ctx: SampleContext): Pose {
  return CLIPS[clip].sample(ctx);
}

/** Trộn `b` vào `a` theo trọng số `w`. Xương chỉ có ở một bên vẫn được nội suy. */
export function blendPose(a: Pose, b: Pose, w: number): Pose {
  if (w <= 0) return a;
  const keys = new Set<BoneKey>([
    ...(Object.keys(a.rot) as BoneKey[]),
    ...(Object.keys(b.rot) as BoneKey[]),
  ]);

  const rot: Partial<Record<BoneKey, Euler3>> = {};
  keys.forEach((k) => {
    const from = a.rot[k] ?? [0, 0, 0];
    const to = b.rot[k] ?? [0, 0, 0];
    rot[k] = [
      from[0] + (to[0] - from[0]) * w,
      from[1] + (to[1] - from[1]) * w,
      from[2] + (to[2] - from[2]) * w,
    ];
  });

  return { hipsY: a.hipsY + (b.hipsY - a.hipsY) * w, rot };
}
