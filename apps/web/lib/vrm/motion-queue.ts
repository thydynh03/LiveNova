import {
  AVATAR_MOTION_LIMITS,
  AvatarExpression,
  AvatarMotionKind,
  type AvatarMotionPayload,
} from '@livenova/shared';

/**
 * Lịch diễn động tác của nhân vật.
 *
 * Toàn bộ file này là logic thuần, không chạm Three.js — vì đây là chỗ hỏng
 * đắt nhất và là chỗ duy nhất kiểm thử được mà không cần WebGL. Ba quy tắc
 * dưới đây là lý do nó tồn tại thay vì cứ gọi thẳng `play()` mỗi khi có quà:
 *
 * 1. **Hợp nhất.** Hai mươi bông hồng trong một giây là hai mươi hành động.
 *    Diễn tuần tự nghĩa là bốn mươi giây sau nhân vật vẫn đang vẫy tay với một
 *    món quà không ai còn nhớ. Cùng một động tác đến trong cửa sổ hợp nhất thì
 *    gộp làm một lượt *to hơn*, không phải nhiều lượt nối đuôi.
 * 2. **Ưu tiên.** Quà đắt phải cắt ngang quà rẻ đang diễn, không xếp hàng sau.
 * 3. **Hoà trộn hai lớp.** Khi cắt ngang, lớp cũ mờ dần trong lúc lớp mới hiện
 *    lên. Bỏ lớp cũ ngay lập tức làm nhân vật giật một cái rất rõ trên sóng.
 */

export interface MotionLayer {
  clip: AvatarMotionKind;
  /** Tiến độ 0..1 qua lượt diễn hiện tại. */
  t: number;
  /** 0..1, trọng số hoà trộn với tư thế nghỉ. */
  weight: number;
  intensity: number;
}

export interface MotionSample {
  /** Lớp cũ trước, lớp đang diễn sau — người gọi trộn theo đúng thứ tự này. */
  layers: MotionLayer[];
  expression: { name: AvatarExpression; weight: number } | null;
}

interface Entry {
  id: string;
  payload: AvatarMotionPayload;
  /** Số thứ tự đến, để hai mục cùng ưu tiên vẫn diễn theo đúng thứ tự. */
  seq: number;
}

interface Active extends Entry {
  startedAt: number;
  /** Có thể dài ra khi hợp nhất, nên không đọc thẳng từ payload. */
  durationMs: number;
  intensity: number;
}

interface Fading {
  clip: AvatarMotionKind;
  t: number;
  intensity: number;
  /** Trọng số tại thời điểm bị cắt ngang — mốc để mờ dần từ đó. */
  fromWeight: number;
  startedAt: number;
  blendMs: number;
}

const EMPTY: MotionSample = { layers: [], expression: null };

function clamp01(v: number) {
  return Math.min(Math.max(v, 0), 1);
}

export class MotionQueue {
  private active: Active | null = null;
  private fading: Fading | null = null;
  private queue: Entry[] = [];
  private seq = 0;

  /** Chỉ để hiển thị trong studio — số lượt đã bị bỏ vì hàng đợi đầy. */
  private droppedCount = 0;

  get pendingCount(): number {
    return this.queue.length;
  }

  get dropped(): number {
    return this.droppedCount;
  }

  get activeClip(): AvatarMotionKind | null {
    return this.active?.payload.clip ?? null;
  }

  push(id: string, payload: AvatarMotionPayload, now: number): void {
    // ── 1. Hợp nhất ────────────────────────────────────────────────────
    const a = this.active;
    if (
      a &&
      a.payload.clip === payload.clip &&
      now - a.startedAt < AVATAR_MOTION_LIMITS.MERGE_WINDOW_MS
    ) {
      a.intensity = clamp01(a.intensity + payload.intensity * 0.35);
      const remaining = a.durationMs - (now - a.startedAt);
      a.durationMs =
        now -
        a.startedAt +
        Math.min(
          remaining + payload.durationMs * 0.5,
          AVATAR_MOTION_LIMITS.MAX_DURATION_MS,
        );
      if (payload.priority > a.payload.priority) {
        a.payload = { ...a.payload, priority: payload.priority };
      }
      // Biểu cảm của món quà mới thắng: nó là thứ vừa xảy ra.
      if (payload.expression) {
        a.payload = { ...a.payload, expression: payload.expression };
      }
      return;
    }

    const entry: Entry = { id, payload, seq: this.seq++ };

    // ── 2. Không có gì đang diễn ───────────────────────────────────────
    if (!a) {
      this.activate(entry, now);
      return;
    }

    // ── 3. Cắt ngang ───────────────────────────────────────────────────
    if (payload.priority > a.payload.priority) {
      this.fadeOutActive(now);
      this.activate(entry, now);
      return;
    }

    // ── 4. Xếp hàng ────────────────────────────────────────────────────
    this.queue.push(entry);
    this.queue.sort((x, y) => y.payload.priority - x.payload.priority || x.seq - y.seq);
    if (this.queue.length > AVATAR_MOTION_LIMITS.MAX_QUEUE_LENGTH) {
      // Bỏ từ cuối: đó là mục ưu tiên thấp nhất và đến muộn nhất.
      this.droppedCount += this.queue.length - AVATAR_MOTION_LIMITS.MAX_QUEUE_LENGTH;
      this.queue.length = AVATAR_MOTION_LIMITS.MAX_QUEUE_LENGTH;
    }
  }

  /** Bỏ mọi thứ đang diễn và đang chờ. Dùng khi studio đổi cảnh. */
  clear(): void {
    this.active = null;
    this.fading = null;
    this.queue = [];
  }

  sample(now: number, cycleMsOf: (clip: AvatarMotionKind) => number): MotionSample {
    // Lượt đang diễn hết hạn thì nhường chỗ, và mờ dần chứ không tắt phụt.
    if (this.active && now - this.active.startedAt >= this.active.durationMs) {
      this.fadeOutActive(now);
      const next = this.queue.shift();
      if (next) this.activate(next, now);
      else this.active = null;
    }

    if (this.fading && now - this.fading.startedAt >= this.fading.blendMs) {
      this.fading = null;
    }

    const layers: MotionLayer[] = [];

    if (this.fading) {
      const f = this.fading;
      const progress = f.blendMs > 0 ? clamp01((now - f.startedAt) / f.blendMs) : 1;
      layers.push({
        clip: f.clip,
        t: f.t,
        weight: f.fromWeight * (1 - progress),
        intensity: f.intensity,
      });
    }

    if (this.active) {
      const a = this.active;
      const elapsed = now - a.startedAt;
      layers.push({
        clip: a.payload.clip,
        t: this.progressOf(a, elapsed, cycleMsOf),
        weight: this.weightOf(a, elapsed),
        intensity: a.intensity,
      });
    }

    if (layers.length === 0) return EMPTY;

    const a = this.active;
    const expression =
      a && a.payload.expression
        ? { name: a.payload.expression, weight: this.weightOf(a, now - a.startedAt) }
        : null;

    return { layers, expression };
  }

  private activate(entry: Entry, now: number): void {
    this.active = {
      ...entry,
      startedAt: now,
      durationMs: entry.payload.durationMs,
      intensity: entry.payload.intensity,
    };
  }

  private fadeOutActive(now: number): void {
    const a = this.active;
    if (!a) return;
    const elapsed = now - a.startedAt;
    this.fading = {
      clip: a.payload.clip,
      t: this.progressOf(a, elapsed, clipCycleFallback),
      intensity: a.intensity,
      fromWeight: this.weightOf(a, elapsed),
      startedAt: now,
      blendMs: Math.max(a.payload.blendMs, 1),
    };
    this.active = null;
  }

  /**
   * Trọng số hình thang: lên trong `blendMs`, giữ, rồi xuống trong `blendMs`.
   * `readAvatarMotionPayload` đã bảo đảm hai đoạn hoà trộn không dài hơn cả
   * lượt diễn, nên đoạn giữ luôn tồn tại.
   */
  private weightOf(a: Active, elapsed: number): number {
    const blend = a.payload.blendMs;
    if (blend <= 0) return 1;
    const rampIn = clamp01(elapsed / blend);
    const rampOut = clamp01((a.durationMs - elapsed) / blend);
    return Math.min(rampIn, rampOut);
  }

  private progressOf(
    a: Active,
    elapsed: number,
    cycleMsOf: (clip: AvatarMotionKind) => number,
  ): number {
    if (a.payload.loop) {
      const cycle = Math.max(1, cycleMsOf(a.payload.clip));
      return (elapsed % cycle) / cycle;
    }
    return clamp01(elapsed / a.durationMs);
  }
}

/**
 * `fadeOutActive` cần tiến độ tại đúng khoảnh khắc bị cắt, nhưng nó được gọi
 * từ `push()` — nơi không có sẵn bảng độ dài lượt. Chốt tiến độ theo tỉ lệ
 * thời gian là đủ đúng: lớp này chỉ còn sống thêm vài trăm mili-giây nữa và
 * tiến độ của nó bị đóng băng trong suốt khoảng đó.
 */
function clipCycleFallback(): number {
  return 1000;
}
