/**
 * Quân nền cho một bản đồ chưa có ai tham gia.
 *
 * Một trận vừa mở ra là một bản đồ trống. Người xem đầu tiên nhìn vào đó không
 * thấy một trò chơi đang chờ họ, mà thấy một thứ trông như hỏng — và không ai
 * muốn là người đầu tiên bước vào một chỗ trống. Sân trống tự nó giữ cho sân
 * tiếp tục trống.
 *
 * Nên khi chưa có sự kiện thật nào, bản đồ vẫn có quân đi lại: bốn vương quốc,
 * vài đơn vị mỗi bên, nhịp thưa.
 *
 * ## Ranh giới, và vì sao nó nằm ở đây chứ không ở phía máy chủ
 *
 * Những đơn vị này **thuần trang trí**. Chúng được sinh trong lớp vẽ của
 * overlay và không bao giờ đi vào trạng thái trận: không cộng điểm, không tính
 * vào số quân của phe, không vào bảng người tặng, không vào `/metrics`. Nếu
 * chúng nằm ở phía máy chủ thì sớm muộn cũng có một truy vấn đếm nhầm chúng, và
 * lúc đó ta có một sản phẩm báo cáo lượng tương tác bịa cho chính người trả
 * tiền dùng nó.
 *
 * Vạch phân biệt là ở chỗ: đây là **đám đông**, không phải **người**. Chúng
 * không mang tên người xem, không sinh dòng chữ "+50 ⚔️", không xuất hiện ở bất
 * cứ chỗ nào nói rằng có ai đó vừa làm gì. Một hậu cảnh có người qua lại là
 * dàn cảnh; một cái tên bịa trong danh sách người tặng là nói dối.
 *
 * Và chúng biến mất ngay khi có người thật. Chúng là mồi khởi động, không phải
 * thứ để độn số cho đẹp.
 */

import type { Troop } from '../components/battle/TroopCanvas';
import type { LaneKey } from '../components/battle/BattleMap';

export interface FillerOptions {
  /** Số đơn vị mỗi đợt, chia đều cho bốn phe. Đặt 0 để tắt hẳn. */
  count: number;
  teamKeys: string[];
  colourOf: (teamKey: string) => string;
  laneOf: (teamKey: string) => LaneKey;
  spriteOf: (teamKey: string) => string | undefined;
}

/** Tiền tố để mọi nơi khác nhận ra một đơn vị nền và loại nó ra. */
export const FILLER_PREFIX = 'filler_';

export function isFillerTroop(id: string): boolean {
  return id.startsWith(FILLER_PREFIX);
}

/**
 * Một đợt quân nền.
 *
 * `seq` đi vào id để hai đợt liên tiếp không trùng khoá React/canvas. Người gọi
 * tăng nó; hàm này không giữ trạng thái nào.
 */
export function buildFillerSquad(seq: number, opts: FillerOptions): Troop[] {
  if (opts.count <= 0 || opts.teamKeys.length === 0) return [];

  const troops: Troop[] = [];
  for (let i = 0; i < opts.count; i += 1) {
    // Chia vòng tròn thay vì bốc ngẫu nhiên: ngẫu nhiên trên một mẫu nhỏ hay
    // dồn hết vào một phe, và một bản đồ mà ba góc im lìm còn một góc đông
    // trông hỏng hơn là bản đồ trống.
    const teamKey = opts.teamKeys[i % opts.teamKeys.length];
    troops.push({
      id: `${FILLER_PREFIX}${seq}_${i}`,
      teamKey,
      lane: opts.laneOf(teamKey),
      type: 'soldier',
      colour: opts.colourOf(teamKey),
      progress: i * -0.05,
      // Chậm hơn quân thật. Khi người thật tặng quà, đợt quân của họ phải vượt
      // lên trông thấy — nếu không thì món quà vừa mua không có gì để nhìn.
      speed: 0.32,
      offset: (Math.random() - 0.5) * 26,
      spriteUrl: opts.spriteOf(teamKey),
    });
  }
  return troops;
}
