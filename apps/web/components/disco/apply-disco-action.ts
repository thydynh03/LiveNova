import type { DiscoAction, DiscoEffect } from '@livenova/shared';
import { DiscoEngine, speakMessage } from './disco-engine';

/**
 * Áp một `DiscoAction` lên engine 3D.
 *
 * Việc *diễn giải* sự kiện nằm ở `@livenova/shared` (hàm thuần, test được);
 * việc *thực thi* nằm ở đây vì nó cần engine WebGL. Dashboard và overlay cùng
 * gọi hàm này, nên hai màn hình không thể lệch nhau như trước.
 */

/**
 * Mô tả thay đổi camera/hiệu ứng cần phát cho các màn hình khác.
 *
 * Trả về thay vì tự phát: hàm này chạy ở cả dashboard lẫn overlay, mà chỉ
 * dashboard mới là bên được phép phát đi. Overlay bỏ qua giá trị trả về.
 */
export interface DiscoSyncPayload {
  cameraShot?: 'DJ_POV' | 'SPOTLIGHT_ZOOM' | 'CRANE_SWOOP' | 'WIDE_ORBIT';
  duration?: number;
  targetId?: string;
  effect?: DiscoEffect;
  speechText?: string;
}

export interface ApplyOptions {
  /**
   * Có đọc lời chúc bằng giọng nói hay không.
   *
   * Chỉ overlay nên đọc: overlay là thứ đang phát lên sóng. Nếu dashboard cũng
   * đọc thì streamer nghe hai giọng chồng nhau khi mở cả hai tab.
   */
  speak?: boolean;
}

export function applyDiscoAction(
  engine: DiscoEngine,
  action: DiscoAction,
  options: ApplyOptions = {},
): DiscoSyncPayload | null {
  const { speak = false } = options;

  const say = (text: string) => {
    if (speak) speakMessage(text);
  };

  switch (action.kind) {
    case 'join':
      engine.join(action.senderId, action.senderName, action.avatarUrl);
      return null;

    case 'jump':
      // Chỉ người đã ở trên sàn mới nhảy được — lệnh của người chưa vào bị bỏ
      // qua, thay vì lặng lẽ kéo họ vào sàn.
      if (engine.dancers.has(action.senderId)) engine.jump(action.senderId);
      return null;

    case 'change':
      if (engine.dancers.has(action.senderId)) engine.changeAvatar(action.senderId);
      return null;

    case 'walk':
      if (engine.dancers.has(action.senderId)) engine.walk(action.senderId);
      return null;

    case 'like':
      engine.triggerFirework();
      return null;

    case 'gift':
      return applyGift(engine, action, say);

    default: {
      // Ép kiểu vét cạn: thêm một `kind` mới mà quên xử lý ở đây sẽ lỗi biên dịch.
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

function applyGift(
  engine: DiscoEngine,
  action: Extract<DiscoAction, { kind: 'gift' }>,
  say: (text: string) => void,
): DiscoSyncPayload | null {
  const { senderId, senderName, avatarUrl, points, coins, effect } = action;

  const ensureOnFloor = () => {
    if (!engine.dancers.has(senderId)) engine.join(senderId, senderName, avatarUrl);
  };

  switch (effect) {
    case 'TOP1_CORONATION': {
      engine.promoteToTop1(senderId, senderName, avatarUrl);
      const speech = `Chúc mừng ${senderName} đã đăng quang TOP 1 đêm nay!`;
      say(speech);
      return { cameraShot: 'DJ_POV', duration: 10000, effect: 'confetti', speechText: speech };
    }

    case 'ROSA_SPOTLIGHT': {
      ensureOnFloor();
      engine.addGiftPoints(senderId, senderName, points, avatarUrl);
      engine.triggerSpotlightZoom(7000, senderId, 2);
      const speech = `Cảm ơn ${senderName} đã tặng Rosa cho phòng nhảy! Quẩy lên nào!`;
      say(speech);
      return { cameraShot: 'SPOTLIGHT_ZOOM', duration: 7000, targetId: senderId, speechText: speech };
    }

    case 'TIKTOK_CHANGE': {
      ensureOnFloor();
      engine.changeAvatar(senderId);
      engine.addGiftPoints(senderId, senderName, points, avatarUrl);
      engine.jump(senderId);
      engine.triggerSpotlightZoom(7000, senderId, 2);
      return { cameraShot: 'SPOTLIGHT_ZOOM', duration: 7000, targetId: senderId };
    }

    case 'ROSE_SPOTLIGHT': {
      ensureOnFloor();
      engine.addGiftPoints(senderId, senderName, points, avatarUrl);
      engine.triggerSpotlightZoom(7000, senderId, 2);
      return { cameraShot: 'SPOTLIGHT_ZOOM', duration: 7000, targetId: senderId };
    }

    case 'GENERIC':
      engine.enqueueGift(senderId, senderName, coins, avatarUrl);
      return { cameraShot: 'DJ_POV', duration: 10000 };

    default: {
      const exhaustive: never = effect;
      return exhaustive;
    }
  }
}
