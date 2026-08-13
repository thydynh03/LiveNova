import { _troopInternals, COMBAT, type Troop } from './TroopCanvas';
import {
  BRIDGE_HEADS,
  CASTLE_ANCHORS,
  CLASH_POINT,
  lanePosition,
  type LaneKey,
} from './BattleMap';
import { _sfxInternals } from '../../lib/battle-sfx';

/**
 * The melee, as far as it can be reached from jsdom.
 *
 * The state machine itself lives in a requestAnimationFrame loop that exits
 * immediately here, because jsdom has no 2D context — so what these cases lock
 * down is the geometry and the pacing constants the loop reads, not the loop.
 * That boundary is worth stating plainly rather than implying coverage the
 * suite does not have: if a unit stops on the wrong side of the map or a
 * kingdom's line forms inside the enemy's, this catches it; if the loop stops
 * calling initCombatState altogether, it does not.
 */

const troop = (lane: LaneKey, type = 'soldier'): Troop => ({
  id: `${lane}_1`,
  teamKey: lane,
  lane,
  type,
  colour: '#c084fc',
  progress: 0,
  speed: 0.24,
  offset: 0,
});

/** Distance from a point to the centre of the map, in percent units. */
const distToClash = (x: number, y: number) =>
  Math.hypot(x - CLASH_POINT.x, y - CLASH_POINT.y);

describe('initCombatState — nơi lính dừng lại để đánh nhau', () => {
  it('bắt đầu ở pha hành quân với máu đầy', () => {
    const t = troop('cat');
    _troopInternals.initCombatState(t, false);

    expect(t.phase).toBe('march');
    expect(t.hp).toBe(COMBAT.DEFAULT_MAX_HP);
    expect(t.maxHp).toBe(COMBAT.DEFAULT_MAX_HP);
  });

  it('cho đơn vị hạng nặng nhiều máu hơn, để rồng không đổi ngang lính thường', () => {
    const dragon = troop('cat', 'dragon');
    _troopInternals.initCombatState(dragon, true);

    expect(dragon.maxHp).toBe(COMBAT.DEFAULT_MAX_HP * COMBAT.BIG_HP_MULTIPLIER);
    expect(dragon.hp).toBe(dragon.maxHp);
  });

  it('dừng trước tâm bản đồ chứ không dồn hết vào một điểm', () => {
    const t = troop('cat');
    _troopInternals.initCombatState(t, false);

    const d = distToClash(t.slotX!, t.slotY!);
    // Đủ xa tâm để hai phe không chồng lên nhau, đủ gần để đọc ra là đang giáp
    // lá cà chứ không phải đứng nhìn nhau từ xa.
    expect(d).toBeGreaterThan(COMBAT.STAND_OFF * 0.5);
    expect(d).toBeLessThan(COMBAT.STAND_OFF + 3 + COMBAT.LINE_SPREAD);
  });

  it('mỗi phe xếp hàng ở phía sân của mình, không lấn sang phía địch', () => {
    const cat = troop('cat'); // góc trên-trái
    const capy = troop('capy'); // góc dưới-phải
    _troopInternals.initCombatState(cat, false);
    _troopInternals.initCombatState(capy, false);

    // Lính đứng ở nửa sân bên lâu đài mình: gần lâu đài mình hơn là gần lâu
    // đài đối diện. Nếu sai, hai phe sẽ đâm xuyên qua nhau khi tới giữa.
    const catHome = CASTLE_ANCHORS.cat;
    const capyHome = CASTLE_ANCHORS.capy;

    expect(Math.hypot(cat.slotX! - catHome.x, cat.slotY! - catHome.y)).toBeLessThan(
      Math.hypot(cat.slotX! - capyHome.x, cat.slotY! - capyHome.y),
    );
    expect(Math.hypot(capy.slotX! - capyHome.x, capy.slotY! - capyHome.y)).toBeLessThan(
      Math.hypot(capy.slotX! - catHome.x, capy.slotY! - catHome.y),
    );
  });

  // Hướng lấy từ đầu cầu chứ không từ lâu đài: lính bước vào quảng trường theo
  // hướng cây cầu, nên đó cũng là trục mà hàng chiến phải dàn ngang.
  it('quay mặt về phía tâm bản đồ, theo hướng cây cầu', () => {
    for (const lane of ['cat', 'dog', 'bear', 'capy'] as LaneKey[]) {
      const t = troop(lane);
      _troopInternals.initCombatState(t, false);

      const head = BRIDGE_HEADS[lane];
      const expected = Math.hypot(CLASH_POINT.x - head.x, CLASH_POINT.y - head.y);

      expect(Math.hypot(t.dirX!, t.dirY!)).toBeCloseTo(1, 5);
      expect(t.dirX!).toBeCloseTo((CLASH_POINT.x - head.x) / expected, 5);
      expect(t.dirY!).toBeCloseTo((CLASH_POINT.y - head.y) / expected, 5);
    }
  });

  // Cái lỗi mà đợt này sửa: đường hành quân phải đi qua đầu cầu, không cắt
  // thẳng từ lâu đài vào tâm — trên bản đồ đó là lội qua sông.
  it('đường hành quân đi qua đầu cầu rồi mới vào tâm', () => {
    for (const lane of ['cat', 'dog', 'bear', 'capy'] as LaneKey[]) {
      const head = BRIDGE_HEADS[lane];

      // Ở đâu đó giữa chặng, lính phải ở rất gần đầu cầu.
      const nearest = Array.from({ length: 101 }, (_, i) => {
        const p = lanePosition(lane, CLASH_POINT, i / 100);
        return Math.hypot(p.x - head.x, p.y - head.y);
      }).reduce((a, b) => Math.min(a, b));
      expect(nearest).toBeLessThan(0.5);

      // Và hai đầu vẫn đúng chỗ.
      const start = lanePosition(lane, CLASH_POINT, 0);
      const end = lanePosition(lane, CLASH_POINT, 1);
      expect(Math.hypot(start.x - CASTLE_ANCHORS[lane].x, start.y - CASTLE_ANCHORS[lane].y))
        .toBeCloseTo(0, 5);
      expect(Math.hypot(end.x - CLASH_POINT.x, end.y - CLASH_POINT.y)).toBeCloseTo(0, 5);
    }
  });

  // Tốc độ đều: không được chậm lại hay vọt lên khi bước từ đường đất sang cầu.
  it('đi đều tốc độ suốt cả hai chặng', () => {
    // Lấy mẫu ở giữa mỗi chặng — bước duy nhất vắt qua chỗ ngoặt ở đầu cầu tất
    // nhiên ngắn hơn, vì đó là dây cung của một góc, không phải lỗi tham số hoá.
    const step = (t: number) => {
      const a = lanePosition('cat', CLASH_POINT, t);
      const b = lanePosition('cat', CLASH_POINT, t + 0.01);
      return Math.hypot(b.x - a.x, b.y - a.y);
    };
    expect(step(0.7)).toBeCloseTo(step(0.2), 5);
  });

  it('rải quân ra thành hàng, không xếp chồng lên một chỗ', () => {
    const slots = Array.from({ length: 24 }, () => {
      const t = troop('dog');
      _troopInternals.initCombatState(t, false);
      return `${t.slotX!.toFixed(3)},${t.slotY!.toFixed(3)}`;
    });

    // Chồng khít nhau nghĩa là 24 con lính vẽ thành một con.
    expect(new Set(slots).size).toBe(24);
  });

  it('giữ nguyên máu nếu người gọi đã đặt sẵn', () => {
    const t = { ...troop('cat'), hp: 30, maxHp: 60 };
    _troopInternals.initCombatState(t, false);

    expect(t.hp).toBe(30);
    expect(t.maxHp).toBe(60);
  });
});

describe('nhịp trận đánh', () => {
  it('cho lính sống đủ lâu để khán giả kịp nhìn', () => {
    // Đây chính là điều người dùng phàn nàn: máu tụt quá nhanh nên trận đánh
    // xong trước khi kịp thấy. Khoá lại bằng số giây, không phải bằng hằng số.
    const secondsToDie = COMBAT.DEFAULT_MAX_HP / COMBAT.FIGHT_DPS;
    expect(secondsToDie).toBeGreaterThanOrEqual(10);
    expect(secondsToDie).toBeLessThanOrEqual(15);
  });

  it('để lính đứng một mình lâu hơn hẳn lính đang giao chiến', () => {
    // Một phe tặng quà mà không có đối thủ thì lính phải trụ lại giữ đất, chứ
    // không được chết vì không có ai đánh.
    expect(COMBAT.IDLE_DPS).toBeLessThan(COMBAT.FIGHT_DPS / 2);
  });

  it('vung kiếm theo nhịp lệch nhau, không đều như máy đếm', () => {
    expect(COMBAT.SWING_MIN_S).toBeLessThan(COMBAT.SWING_MAX_S);
  });
});

describe('battle-sfx — hạn dòng tiếng va chạm', () => {
  beforeEach(() => {
    _sfxInternals.reset();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('không để hàng trăm cú đánh cùng lúc thành tiếng ồn trắng', () => {
    // Hai trăm lính giáp lá cà sinh ra hàng trăm cú đánh mỗi giây. Phát hết
    // thì đó không còn là trận đánh, và nó đi thẳng ra sóng của streamer.
    let allowed = 0;
    for (let i = 0; i < 500; i += 1) {
      if (_sfxInternals.claim()) allowed += 1;
    }

    expect(allowed).toBeLessThanOrEqual(_sfxInternals.LIMITS.MAX_PER_SEC);
    // Nhưng vẫn phải có tiếng — im lặng hoàn toàn đọc ra là hỏng âm thanh.
    expect(allowed).toBeGreaterThan(0);
  });

  it('nạp lại quyền phát theo thời gian', () => {
    while (_sfxInternals.claim()) {
      /* xả hết */
    }
    expect(_sfxInternals.claim()).toBe(false);

    jest.advanceTimersByTime(1000);

    expect(_sfxInternals.claim()).toBe(true);
  });
});
