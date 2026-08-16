import { LiveEventType } from '../types';

/**
 * Diễn giải sự kiện TikTok Live thành hành động sàn nhảy.
 *
 * Trước đây bộ luật này tồn tại song song ở `app/(dashboard)/disco/page.tsx` và
 * `app/overlays/disco/page.tsx`. Hai bản đã lệch nhau (nhánh quà "TikTok" chỉ có
 * một bên gọi broadcast), nên mọi lần sửa luật đều phải nhớ sửa hai chỗ. Tách ra
 * đây để chỉ còn một nguồn sự thật, và để test được mà không cần dựng WebGL.
 *
 * Hàm trong file này là hàm thuần: nhận sự kiện, trả về *ý định*. Việc áp ý định
 * đó lên engine 3D nằm ở `apply-disco-action.ts` phía web.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Kiểu dữ liệu
// ─────────────────────────────────────────────────────────────────────────────

/** Lệnh điều khiển nhân vật, phát ra từ comment. */
export type DiscoCommandKind = 'join' | 'jump' | 'change' | 'walk';

/**
 * Hiệu ứng quà. Đây là danh sách đóng — thêm loại quà mới nghĩa là thêm một
 * entry vào `GIFT_RULES` bên dưới, không phải thêm một nhánh `else if` nữa.
 */
export type DiscoGiftEffect =
  | 'TOP1_CORONATION'
  | 'ROSA_SPOTLIGHT'
  | 'TIKTOK_CHANGE'
  | 'ROSE_SPOTLIGHT'
  | 'GENERIC';

export interface DiscoSender {
  senderId: string;
  senderName: string;
  avatarUrl?: string;
}

export type DiscoAction =
  | ({ kind: DiscoCommandKind } & DiscoSender)
  | ({
      kind: 'gift';
      effect: DiscoGiftEffect;
      /** Điểm cộng cho người tặng. */
      points: number;
      /** Giá trị xu gốc, để engine xếp hàng quà thường. */
      coins: number;
    } & DiscoSender)
  | { kind: 'like' };

// ─────────────────────────────────────────────────────────────────────────────
// Chuẩn hoá tiếng Việt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bỏ dấu và hạ chữ thường. Người xem gõ trên điện thoại giữa lúc live thì hiếm
 * khi bỏ dấu đúng, nên "nhay", "quay", "vao" phải khớp như "nhảy", "quẩy", "vào".
 */
export function foldVietnamese(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Luật comment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Từ khoá cho từng lệnh, đã bỏ dấu.
 *
 * Thứ tự trong mảng này quyết định độ ưu tiên khi một comment khớp nhiều lệnh:
 * "1" đứng trước "2" nên "1 2" là lệnh vào sàn, không phải nhảy.
 */
const COMMAND_KEYWORDS: ReadonlyArray<readonly [DiscoCommandKind, readonly string[]]> = [
  ['join', ['hey', 'heyy', 'heyyy', 'join', '1', 'vao', 'nhap', 'quay']],
  ['jump', ['jump', '2', 'len', 'bat', 'nhun']],
  ['change', ['skin', 'change', '3', 'doi']],
  ['walk', ['walk', '4', 'di', 'dao']],
];

/**
 * Cụm từ nhiều chữ cho lệnh vào sàn. Kiểm tra riêng vì tách theo khoảng trắng
 * sẽ làm mất ngữ cảnh ("vào phòng" khác "vào" đứng một mình trong câu khác).
 */
const JOIN_PHRASES = ['vao phong', 'vao nhay', 'vao quay', 'vao san'];

/**
 * `nhay` cố ý KHÔNG nằm trong từ khoá `jump`.
 *
 * Người xem gõ "vào nhảy" ý là vào sàn, còn "nhảy" đứng một mình thì mơ hồ giữa
 * vào sàn và bật nhảy. Trước đây `nhay` nằm ở cả `join` lẫn `jump`, và vì `join`
 * được xét trước nên nhánh `jump` không bao giờ chạy — một luật chết. Giờ `nhay`
 * chỉ thuộc `join`, và lệnh bật nhảy dùng số "2" hoặc "jump" cho rõ ràng.
 */
const AMBIGUOUS_JOIN_WORDS = ['nhay'];

/** Diễn giải một comment thành lệnh, hoặc `null` nếu không phải lệnh nào. */
export function interpretComment(rawContent: string): DiscoCommandKind | null {
  const text = foldVietnamese(rawContent);
  if (text === '') return null;

  if (JOIN_PHRASES.some((phrase) => text.includes(phrase))) return 'join';

  const words = text.split(/\s+/);
  if (words.some((w) => AMBIGUOUS_JOIN_WORDS.includes(w))) return 'join';

  for (const [kind, keywords] of COMMAND_KEYWORDS) {
    if (words.some((w) => keywords.includes(w))) return kind;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Luật quà
// ─────────────────────────────────────────────────────────────────────────────

interface GiftRule {
  effect: DiscoGiftEffect;
  /** Số nhỏ chạy trước. */
  priority: number;
  /** Khớp theo tên quà (đã bỏ dấu, chữ thường). */
  keywords: readonly string[];
  /** Điểm cộng cho người tặng khi luật này khớp. */
  points: number;
}

/**
 * Bảng luật quà, khớp theo TÊN.
 *
 * Ngưỡng xu cố ý không nằm ở đây. Bản cũ nhét `giftCoins >= 100` vào nhánh "Pháo
 * hoa giấy" và `giftCoins === 1` vào nhánh "Hoa hồng", nên mọi quà đắt tiền đều
 * bị đăng quang TOP 1 và mọi quà 1 xu đều thành hoa hồng — kể cả khi tên quà
 * chẳng liên quan. Giờ tên khớp trước; xu chỉ là lưới hứng khi không tên nào khớp
 * (xem `COIN_FALLBACK` bên dưới).
 */
const GIFT_RULES: readonly GiftRule[] = [
  {
    effect: 'TOP1_CORONATION',
    priority: 1,
    keywords: [
      'phao hoa giay',
      'hoa giay',
      'confetti',
      'firework',
      'popper',
      'paper',
    ],
    points: 50,
  },
  {
    effect: 'ROSA_SPOTLIGHT',
    priority: 2,
    keywords: ['rosa', 'rose nebula', 'rosy'],
    points: 5,
  },
  {
    effect: 'TIKTOK_CHANGE',
    priority: 3,
    keywords: ['tiktok', 'tik tok'],
    points: 1,
  },
  {
    effect: 'ROSE_SPOTLIGHT',
    priority: 4,
    // "rose" phải đứng sau "rosa"/"rose nebula" theo priority, nếu không
    // "rose nebula" sẽ bị nuốt vào nhánh hoa hồng thường.
    keywords: ['rose', 'hoa hong', 'hong'],
    points: 1,
  },
];

/**
 * Lưới hứng theo giá trị xu, CHỈ dùng khi không tên quà nào khớp.
 *
 * Quà lạ mà đắt vẫn xứng đáng có khoảnh khắc lớn, nhưng không nên mượn danh
 * "Pháo hoa giấy" — nên nó rơi vào `GENERIC` với điểm tương ứng, và engine tự
 * xếp hàng xử lý.
 */
const COIN_FALLBACK_CORONATION = 100;

/** Diễn giải một sự kiện quà. Luôn trả về một hiệu ứng — không có quà nào bị bỏ. */
export function interpretGift(
  rawGiftName: string,
  coins: number,
): { effect: DiscoGiftEffect; points: number } {
  const name = foldVietnamese(rawGiftName);

  if (name !== '') {
    const matched = [...GIFT_RULES]
      .sort((a, b) => a.priority - b.priority)
      .find((rule) => rule.keywords.some((k) => name.includes(k)));

    if (matched) return { effect: matched.effect, points: matched.points };
  }

  if (coins >= COIN_FALLBACK_CORONATION) {
    return { effect: 'TOP1_CORONATION', points: 50 };
  }

  return { effect: 'GENERIC', points: Math.max(1, coins) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Điểm vào duy nhất
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phần sự kiện mà bộ luật thực sự cần.
 *
 * Cố ý hẹp hơn `LiveEvent`: dashboard nhận `LiveEvent` đầy đủ, còn overlay chỉ
 * nhận `OverlayEventContext` (không có `id`, `channelId`, `occurredAt`). Cả hai
 * đều thoả kiểu này, nên một hàm phục vụ được cả hai mà không phải ép kiểu.
 */
export interface DiscoEventInput {
  type: LiveEventType;
  senderUsername?: string;
  senderDisplayName: string;
  senderAvatar?: string;
  content?: string;
  giftName?: string;
  giftCoinValue?: number;
}

/** Danh tính người gửi, với các fallback giống nhau ở mọi màn hình. */
export function resolveSender(event: DiscoEventInput): DiscoSender {
  const senderId = event.senderUsername || event.senderDisplayName || 'khan_gia';
  return {
    senderId,
    senderName: event.senderDisplayName || senderId,
    avatarUrl: event.senderAvatar,
  };
}

/**
 * Diễn giải một sự kiện live thành hành động sàn nhảy, hoặc `null` nếu sự kiện
 * không có ý nghĩa gì với sàn nhảy (ví dụ comment tán gẫu bình thường).
 *
 * Comment thường KHÔNG tự động cho vào sàn — người xem phải gõ lệnh rõ ràng.
 */
export function interpretDiscoEvent(event: DiscoEventInput): DiscoAction | null {
  const sender = resolveSender(event);

  if (event.type === LiveEventType.COMMENT) {
    const command = interpretComment(event.content ?? '');
    return command ? { kind: command, ...sender } : null;
  }

  if (event.type === LiveEventType.GIFT) {
    const coins = event.giftCoinValue ?? 1;
    const { effect, points } = interpretGift(event.giftName ?? event.content ?? '', coins);
    return { kind: 'gift', effect, points, coins, ...sender };
  }

  if (event.type === LiveEventType.LIKE) {
    return { kind: 'like' };
  }

  return null;
}
