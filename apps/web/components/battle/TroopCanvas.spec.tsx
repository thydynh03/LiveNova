import React from 'react';
import { render } from '@testing-library/react';
import { TroopCanvas, type TroopCanvasHandle, type Troop } from './TroopCanvas';
import { frameBudget } from '../../lib/frame-budget';

/**
 * Trần quân số — thứ đứng giữa một buổi live viral và một overlay chết.
 *
 * Quà đến nhanh hơn tốc độ lính đi hết bản đồ, nên danh sách chỉ có thể dài
 * thêm. Không có trần, overlay sập đúng lúc khán giả đông nhất. Đó là lý do
 * `spawn` cắt bớt thay vì cộng dồn vô hạn, và là lý do phần cắt đó phải có test:
 * khi nó sai, không có gì báo cho tới lúc máy của streamer đứng hình giữa sóng.
 */

const troop = (id: string): Troop => ({
  id,
  teamKey: 'cat',
  lane: 'cat',
  type: 'soldier',
  colour: '#c084fc',
  progress: 0,
  speed: 0.55,
  offset: 0,
});

const squad = (n: number, prefix = 's') =>
  Array.from({ length: n }, (_, i) => troop(`${prefix}_${i}`));

describe('TroopCanvas — trần quân số', () => {
  let handle: TroopCanvasHandle;

  const mount = (maxTroops?: number) => {
    const ref = React.createRef<TroopCanvasHandle>();
    render(<TroopCanvas ref={ref} maxTroops={maxTroops} />);
    handle = ref.current!;
  };

  beforeEach(() => frameBudget._reset());
  afterEach(() => frameBudget._reset());

  it('nhận đủ số lính khi chưa chạm trần', () => {
    mount(220);

    handle.spawn(squad(10));

    expect(handle.count()).toBe(10);
  });

  it('giữ đúng trần khi có thêm lính chứ không cộng dồn vô hạn', () => {
    mount(20);

    handle.spawn(squad(20, 'cu'));
    handle.spawn([troop('vua_tang')]);

    // Ghi chú về giới hạn của test này: `TroopCanvasHandle` chỉ phơi ra
    // `count()`, nên ở đây chứng minh được *bao nhiêu* con còn lại chứ không
    // chứng minh được *con nào* bị bỏ. Việc bỏ con cũ nhất — để con lính vừa
    // được ai đó trả tiền không bị cắt — nằm trong `spawn` và hiện chỉ được
    // bảo vệ bằng đọc mã. Muốn khoá nó bằng test thì phải phơi thêm một cách
    // đọc danh sách, và đó là đánh đổi chưa đáng.
    expect(handle.count()).toBe(20);
  });

  it('hạ trần khi máy đang đuối, thay vì thả khung hình với đủ quân', () => {
    mount(220);

    // Khoảng 42fps — máy bắt đầu không theo kịp.
    frameBudget._forFrameTime(30);
    handle.spawn(squad(300));

    // Ít lính hơn đọc ra là một khoảnh khắc thưa người; khung hình rớt đọc ra là
    // phần mềm hỏng. Nên khi phải chọn, chọn bớt lính.
    expect(handle.count()).toBe(110);
  });

  it('hạ sâu hơn nữa khi máy đuối hẳn', () => {
    mount(220);

    frameBudget._forFrameTime(50); // ~20fps
    handle.spawn(squad(300));

    expect(handle.count()).toBe(55);
  });

  it('không bao giờ để chiến trường trống hoàn toàn', () => {
    mount(20);

    frameBudget._forFrameTime(200); // máy gần như đứng
    handle.spawn(squad(50));

    // Một chiến trường trống không phân biệt được với một overlay hỏng. Người
    // xem vừa tặng quà phải thấy *một cái gì đó* xảy ra.
    expect(handle.count()).toBeGreaterThan(0);
  });
});
