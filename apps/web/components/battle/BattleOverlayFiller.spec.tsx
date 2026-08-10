import { render, act } from '@testing-library/react';
import React from 'react';
import type { BattleState } from '@livenova/shared';
import { isFillerTroop } from '../../lib/filler-troops';
// `jest.mock` được hoist lên trên mọi import, nên nhập bình thường ở đây vẫn
// nhận đúng các bản giả bên dưới.
import { BattleOverlayContent } from './BattleOverlayContent';

/**
 * Quân nền phải im ngay khi có người thật.
 *
 * Bản thân `buildFillerSquad` đã có test riêng. Cái chưa được chứng minh — và
 * cũng là chỗ dễ sai nhất — là phần nối dây: điều kiện dừng, và việc nó dừng
 * đúng vào lúc sự kiện thật đầu tiên tới chứ không phải sau một khoảng đếm giờ.
 *
 * Nếu chỗ này hỏng thì hỏng theo cách tệ nhất có thể: đúng khoảnh khắc ai đó
 * vừa trả tiền, đợt quân họ mua bị trộn lẫn với quân trang trí.
 */

const spawned: { id: string }[] = [];

jest.mock('./TroopCanvas', () => ({
  TroopCanvas: React.forwardRef(function TroopCanvasMock(_props: unknown, ref: React.Ref<unknown>) {
    React.useImperativeHandle(ref, () => ({
      spawn: (troops: { id: string }[]) => spawned.push(...troops),
      count: () => spawned.length,
    }));
    return <div data-testid="troop-canvas" />;
  }),
}));

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

jest.mock('../../lib/use-overlay-socket', () => ({
  useOverlaySocket: () => undefined,
}));

const team = (key: string, name: string, color: string) => ({
  key,
  name,
  color,
  score: 100,
  energy: 100,
  castleHp: 1000,
  maxHp: 1000,
  giftNames: [],
});

const state = (over: Partial<BattleState> = {}): BattleState =>
  ({
    kind: 'battle',
    battleId: 'b1',
    title: 'TRẬN THỬ',
    teams: [
      team('cat', 'MÈO', '#c084fc'),
      team('dog', 'CHÓ', '#60a5fa'),
      team('bear', 'GẤU', '#fb923c'),
      team('capy', 'CAPY', '#34d399'),
    ],
    topDonors: [],
    recentEvents: [],
    winnerTeamKey: null,
    endsAtMs: Date.now() + 600000,
    active: true,
    ...over,
  }) as BattleState;

describe('quân nền trong overlay', () => {
  beforeEach(() => {
    spawned.length = 0;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('đi lại khi bản đồ chưa có ai', () => {
    render(<BattleOverlayContent customState={state()} fillerCount={4} />);

    // Đợt đầu phát ngay, không đợi hết một nhịp: một bản đồ trống trong bốn
    // giây đầu vẫn là một bản đồ trống đúng lúc người xem mới bấm vào.
    expect(spawned.length).toBeGreaterThan(0);
    expect(spawned.every((t) => isFillerTroop(t.id))).toBe(true);
  });

  it('im hẳn khi đã có sự kiện thật', () => {
    render(
      <BattleOverlayContent
        customState={state({
          recentEvents: [
            {
              id: 'e1',
              teamKey: 'cat',
              actionKey: 'soldier',
              sender: '@nguoithat',
              powerAdded: 50,
            },
          ] as BattleState['recentEvents'],
        })}
        fillerCount={4}
      />,
    );

    act(() => {
      jest.advanceTimersByTime(20000);
    });

    // Không một đơn vị trang trí nào, kể cả sau nhiều nhịp. Quân duy nhất trên
    // bản đồ phải là quân của người vừa tặng quà.
    expect(spawned.filter((t) => isFillerTroop(t.id))).toHaveLength(0);
  });

  it('fillerCount = 0 thì tắt hẳn', () => {
    render(<BattleOverlayContent customState={state()} fillerCount={0} />);

    act(() => {
      jest.advanceTimersByTime(20000);
    });

    expect(spawned.filter((t) => isFillerTroop(t.id))).toHaveLength(0);
  });

  it('không chạy khi trận đã kết thúc', () => {
    render(<BattleOverlayContent customState={state({ active: false })} fillerCount={4} />);

    act(() => {
      jest.advanceTimersByTime(20000);
    });

    // Màn kết trận là lúc bảng vinh danh hiện lên. Quân trang trí vẫn đi lại
    // phía sau nó thì trận đấu trông như chưa kết thúc.
    expect(spawned.filter((t) => isFillerTroop(t.id))).toHaveLength(0);
  });
});
