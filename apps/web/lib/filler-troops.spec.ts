import { buildFillerSquad, isFillerTroop, FILLER_PREFIX } from './filler-troops';
import type { LaneKey } from '../components/battle/BattleMap';

const opts = {
  count: 8,
  teamKeys: ['cat', 'dog', 'bear', 'capy'],
  colourOf: (k: string) => `colour_${k}`,
  laneOf: (k: string) => k as LaneKey,
  spriteOf: (k: string) => `/sprites/${k}.png`,
};

describe('quân nền', () => {
  it('chia đều cho cả bốn phe', () => {
    const squad = buildFillerSquad(1, opts);

    const perTeam = new Map<string, number>();
    for (const t of squad) perTeam.set(t.teamKey, (perTeam.get(t.teamKey) ?? 0) + 1);

    // Bốc ngẫu nhiên trên một mẫu tám đơn vị hay dồn hết vào một phe, và một
    // bản đồ ba góc im lìm còn một góc đông trông hỏng hơn bản đồ trống.
    expect([...perTeam.values()]).toEqual([2, 2, 2, 2]);
  });

  it('gắn tiền tố nhận dạng vào mọi đơn vị', () => {
    const squad = buildFillerSquad(1, opts);

    // Đây là thứ giữ cho chúng ở nguyên lớp trang trí. Không có dấu nhận dạng
    // thì không chỗ nào sau này lọc chúng ra được, và một truy vấn đếm nhầm sẽ
    // biến thành số liệu tương tác bịa báo cho chính người trả tiền dùng.
    expect(squad.every((t) => isFillerTroop(t.id))).toBe(true);
    expect(squad.every((t) => t.id.startsWith(FILLER_PREFIX))).toBe(true);
  });

  it('không đơn vị nào mang tên người xem hay dữ liệu người tặng', () => {
    const squad = buildFillerSquad(1, opts);

    // Vạch phân biệt của cả tính năng này: đám đông thì được, người thì không.
    // Một hậu cảnh có người qua lại là dàn cảnh; một cái tên bịa là nói dối.
    for (const t of squad) {
      const fields = Object.keys(t);
      expect(fields).not.toContain('sender');
      expect(fields).not.toContain('username');
      expect(fields).not.toContain('nickname');
      expect(fields).not.toContain('powerAdded');
    }
  });

  it('đi chậm hơn để quân thật vượt lên trông thấy', () => {
    const squad = buildFillerSquad(1, opts);

    // Quân thật đi 0.55 (quà thường) và 0.85 (quà lớn) trong
    // BattleOverlayContent. Quân nền phải chậm hơn cả hai, nếu không thì món
    // quà vừa mua không có gì để nhìn.
    expect(squad.every((t) => t.speed < 0.55)).toBe(true);
  });

  it('hai đợt liên tiếp không trùng id', () => {
    const ids = new Set([
      ...buildFillerSquad(1, opts).map((t) => t.id),
      ...buildFillerSquad(2, opts).map((t) => t.id),
    ]);

    expect(ids.size).toBe(opts.count * 2);
  });

  it('count 0 thì tắt hẳn, không sinh gì', () => {
    expect(buildFillerSquad(1, { ...opts, count: 0 })).toEqual([]);
  });

  it('không có phe nào thì không sinh gì thay vì ném lỗi', () => {
    // Mẫu tự chọn có thể chưa khai phe nào. Overlay đang phát sóng thì không
    // được ném lỗi vì chuyện đó.
    expect(buildFillerSquad(1, { ...opts, teamKeys: [] })).toEqual([]);
  });
});
