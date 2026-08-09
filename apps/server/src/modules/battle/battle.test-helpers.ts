import { LiveEvent, LiveEventType } from '@livenova/shared';

/**
 * Bộ dựng sự kiện live cho test.
 *
 * Tồn tại vì các kịch bản đáng kiểm nhất trong trò chơi này đều nhiều bước:
 * "tặng quà cho Mèo, rồi tặng cho Chó, rồi like — điểm phải về Chó". Dựng tay
 * mỗi `LiveEvent` mất tám dòng, nên một kịch bản ba bước biến thành hai mươi
 * bốn dòng nhiễu quanh một câu khẳng định.
 *
 * Hệ quả không phải là xấu mã. Là không ai viết đủ số kịch bản cần thiết, và
 * đó chính là lý do đường "quà → phe" đi vào production mà không có test nào.
 */

let counter = 0;

/** Mỗi sự kiện cần một id riêng; đếm tăng dần cho ổn định giữa các lần chạy. */
function nextId(): string {
  counter += 1;
  return `evt_${counter}`;
}

export function resetEventIds(): void {
  counter = 0;
}

export interface ViewerBuilder {
  gifts(giftName: string, coinValue?: number): LiveEvent;
  likes(count?: number): LiveEvent;
  shares(): LiveEvent;
  follows(): LiveEvent;
  comments(content: string): LiveEvent;
}

/**
 * Một người xem trong một phòng live.
 *
 * `channelId` mặc định là `chan_1` vì phần lớn test chỉ có một phòng. Kịch bản
 * kiểm rò rỉ giữa hai streamer thì truyền vào channel thứ hai.
 */
export function viewer(username: string, channelId = 'chan_1'): ViewerBuilder {
  const base = {
    channelId,
    senderUsername: username.replace(/^@/, ''),
    senderDisplayName: username.replace(/^@/, ''),
    occurredAt: new Date(),
  };

  return {
    gifts(giftName: string, coinValue = 5): LiveEvent {
      return {
        ...base,
        id: nextId(),
        type: LiveEventType.GIFT,
        giftName,
        giftCoinValue: coinValue,
      } as unknown as LiveEvent;
    },

    likes(count = 1): LiveEvent {
      return {
        ...base,
        id: nextId(),
        type: LiveEventType.LIKE,
        // Ingest gói số lần chạm vào phần chữ vì `likeCount` trong khung webcast
        // vốn đã là một tổng. Bộ dựng phải bắt chước đúng dạng đó, nếu không
        // test sẽ đi qua một nhánh mà production không bao giờ chạy.
        content: `Tha ${count} tim`,
      } as unknown as LiveEvent;
    },

    shares(): LiveEvent {
      return { ...base, id: nextId(), type: LiveEventType.SHARE } as unknown as LiveEvent;
    },

    follows(): LiveEvent {
      return { ...base, id: nextId(), type: LiveEventType.FOLLOW } as unknown as LiveEvent;
    },

    comments(content: string): LiveEvent {
      return {
        ...base,
        id: nextId(),
        type: LiveEventType.COMMENT,
        content,
      } as unknown as LiveEvent;
    },
  };
}

/** Điểm của một phe, viết tắt cho phần khẳng định. */
export function scoreOf(state: { teams: { key: string; score: number }[] }, key: string): number {
  return state.teams.find((t) => t.key === key)?.score ?? 0;
}
