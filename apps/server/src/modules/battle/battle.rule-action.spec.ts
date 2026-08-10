import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BATTLE_ACTION_DISPATCH,
  BattleActionDispatchEvent,
  RuleActionType,
} from '@livenova/shared';
import { BattleService } from './battle.service';
import { BattleCoordinatorService } from './battle-coordinator.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resetEventIds, scoreOf, viewer } from './battle.test-helpers';

/**
 * Hành động do luật kích hoạt, không do quà.
 *
 * Một luật có thể bắn thẳng một kỹ năng vào trận: "ai bình luận `tấn công` thì
 * gọi rồng cho phe của họ". Đường này đi vòng qua toàn bộ phần khớp tên quà, nên
 * nó có cách xác định phe riêng và cách tính điểm riêng — và cho tới giờ chưa có
 * test nào chạm tới nó.
 */

describe('Luật → hành động trong trận', () => {
  let service: BattleService;
  let prisma: PrismaService;
  let coordinator: BattleCoordinatorService;
  let metrics: MetricsService;

  beforeEach(() => {
    resetEventIds();

    prisma = {
      userTemplate: { findFirst: jest.fn().mockResolvedValue(null) },
      overlay: { findFirst: jest.fn().mockResolvedValue(null) },
      channel: { findUnique: jest.fn().mockResolvedValue({ userId: 'user_1' }) },
      battle: {
        create: jest.fn().mockResolvedValue({ id: 'battle_row_1' }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      battleScore: { upsert: jest.fn() },
      battleDonor: { upsert: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    } as unknown as PrismaService;

    coordinator = {
      registerHandler: jest.fn(),
      isOwner: jest.fn().mockReturnValue(true),
      claim: jest.fn().mockResolvedValue(true),
      release: jest.fn().mockResolvedValue(undefined),
      ownedBattles: jest.fn().mockReturnValue([]),
      forward: jest.fn().mockResolvedValue(undefined),
    } as unknown as BattleCoordinatorService;

    metrics = {
      setActiveBattles: jest.fn(),
      socketConnected: jest.fn(),
      socketDisconnected: jest.fn(),
      recordFlush: jest.fn(),
      recordGiftLatency: jest.fn(),
      render: jest.fn().mockReturnValue(''),
    } as unknown as MetricsService;

    service = new BattleService(prisma, new EventEmitter2(), coordinator, metrics);
  });

  afterEach(() => service.onModuleDestroy());

  const stateOf = () => service['battles'].get('user_1')!.state;

  const dispatch = (
    actionKey: string,
    opts: { teamKey?: string; from?: string } = {},
  ): BattleActionDispatchEvent => ({
    userId: 'user_1',
    action: {
      type: RuleActionType.GAME_BATTLE_ACTION,
      payload: { actionKey, ...(opts.teamKey ? { teamKey: opts.teamKey } : {}) },
    } as unknown as BattleActionDispatchEvent['action'],
    event: viewer(opts.from ?? '@an').comments('tấn công'),
  });

  it('bắn hiệu ứng vào đúng phe mà luật chỉ định', async () => {
    await service.getOrCreateBattle('user_1');

    await service.handleBattleActionDispatch(dispatch('dragon', { teamKey: 'bear' }));

    // `dragon` có `minPower` 99 trong cấu hình mặc định.
    expect(scoreOf(stateOf(), 'bear')).toBe(99);
    expect(scoreOf(stateOf(), 'cat')).toBe(0);
  });

  it('suy ra phe từ lịch sử tặng quà khi luật không chỉ định', async () => {
    await service.getOrCreateBattle('user_1');
    await service.handleLiveEvent(viewer('@an').gifts('Perfume', 5)); // Chó

    await service.handleBattleActionDispatch(dispatch('bomb'));

    // Đây là điểm hấp dẫn của tính năng: người xem bình luận một từ, và hiệu ứng
    // rơi vào phe họ đã chọn bằng ví của mình, không cần nói ra.
    expect(scoreOf(stateOf(), 'dog')).toBeGreaterThan(5);
  });

  it('bỏ qua khi không xác định được phe, thay vì đoán', async () => {
    await service.getOrCreateBattle('user_1');

    // Người xem chưa từng tặng quà nên chưa thuộc phe nào.
    await service.handleBattleActionDispatch(dispatch('meteor'));

    expect(stateOf().teams.every((t) => t.score === 0)).toBe(true);
  });

  it('bỏ qua khi luật trỏ vào một phe không tồn tại', async () => {
    await service.getOrCreateBattle('user_1');

    await service.handleBattleActionDispatch(dispatch('bomb', { teamKey: 'rong' }));

    expect(stateOf().teams.every((t) => t.score === 0)).toBe(true);
  });

  it('hồi máu thành đúng một lần, không phải một lần cho mỗi đối thủ', async () => {
    await service.getOrCreateBattle('user_1');
    const cat = stateOf().teams.find((t) => t.key === 'cat')!;
    cat.castleHp = 500;

    await service.handleBattleActionDispatch(dispatch('castle', { teamKey: 'cat' }));

    // `castle` có `minPower` 10, và luật là hồi `power * 2`. Nhánh này từng nằm
    // trong vòng lặp "với mỗi đối thủ" dù không dùng tới đối thủ nào, nên nó hồi
    // 60 máu thay vì 20 — mạnh gấp ba ý định, và không có gì báo.
    expect(cat.castleHp).toBe(520);
  });

  it('không bắn vào một trận đã kết thúc', async () => {
    await service.getOrCreateBattle('user_1');
    stateOf().active = false;

    await service.handleBattleActionDispatch(dispatch('meteor', { teamKey: 'cat' }));

    // Người xem bình luận sau tiếng còi không được làm đổi một kết quả đã công bố.
    expect(scoreOf(stateOf(), 'cat')).toBe(0);
  });

  it('ghi người kích hoạt vào bảng công thần', async () => {
    await service.getOrCreateBattle('user_1');

    await service.handleBattleActionDispatch(dispatch('bomb', { teamKey: 'cat', from: '@an' }));

    const donor = stateOf().topDonors.find((d) => d.username === '@an');
    expect(donor?.teamKey).toBe('cat');
    expect(donor?.totalScore).toBe(50);
  });

  it('chuyển cho instance đang sở hữu trận thay vì tự xử lý', async () => {
    await service.getOrCreateBattle('user_1');
    (coordinator.isOwner as jest.Mock).mockReturnValue(false);

    const payload = dispatch('meteor', { teamKey: 'cat' });
    await service.handleBattleActionDispatch(payload);

    // Cùng lý do như mọi đường ghi khác: hai tiến trình cùng sửa một trận là hai
    // ván khác nhau, không phải một ván có độ trễ.
    expect(coordinator.forward).toHaveBeenCalledWith('user_1', 'dispatchAction', payload);
    expect(scoreOf(stateOf(), 'cat')).toBe(0);
  });

  it('giữ nguyên tên kênh mà hai phía cùng dùng', () => {
    // Rule engine phát, battle service nghe — cả hai đều import đúng hằng số
    // này, nên chúng không thể lệch nhau. Thứ *có thể* lệch là ai đó đổi giá
    // trị hằng số trong khi một bản build cũ vẫn đang chạy phía kia.
    //
    // Việc decorator `@OnEvent` có bind đúng hay không thì test này không chứng
    // minh được: `@OnEvent` chỉ được nối khi Nest dựng module, còn ở đây service
    // được `new` trực tiếp. Muốn khoá điều đó cần một test dựng module thật —
    // ghi ra đây để không ai tưởng nó đã được phủ.
    expect(BATTLE_ACTION_DISPATCH).toBe('battle.action.dispatch');
  });
});
