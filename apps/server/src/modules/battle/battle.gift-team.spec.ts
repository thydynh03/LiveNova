import { EventEmitter2 } from '@nestjs/event-emitter';
import { BattleService } from './battle.service';
import { BattleCoordinatorService } from './battle-coordinator.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resetEventIds, scoreOf, viewer } from './battle.test-helpers';

/**
 * Đường đi từ món quà tới phe mà nó ủng hộ.
 *
 * Tách khỏi `battle.service.spec.ts` vì hai file trả lời hai câu khác nhau. File
 * kia hỏi "điểm có đúng không, trận có kết đúng không". File này hỏi "món quà
 * này thuộc về ai" — thứ người xem cảm nhận trực tiếp, và là thứ mà khi sai thì
 * không có gì báo: sự kiện bị bỏ qua trong im lặng theo đúng thiết kế.
 */

describe('Quà → phe', () => {
  let service: BattleService;
  let prisma: PrismaService;
  let coordinator: BattleCoordinatorService;
  let metrics: MetricsService;

  /** `chan_1` thuộc `user_1`; `chan_2` thuộc `user_2`, cho kịch bản hai streamer. */
  const channelOwner: Record<string, string> = { chan_1: 'user_1', chan_2: 'user_2' };

  beforeEach(() => {
    resetEventIds();

    prisma = {
      userTemplate: { findFirst: jest.fn().mockResolvedValue(null) },
      overlay: { findFirst: jest.fn().mockResolvedValue(null) },
      channel: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(channelOwner[where.id] ? { userId: channelOwner[where.id] } : null),
        ),
      },
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
      forward: jest.fn(),
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

  const stateOf = (userId: string) => service['battles'].get(userId)!.state;

  // ── Nhóm A — khớp tên quà ────────────────────────────────────────────────

  describe('khớp tên quà', () => {
    it('khớp khi TikTok gửi tên viết thường', async () => {
      await service.getOrCreateBattle('user_1');

      await service.handleLiveEvent(viewer('@an').gifts('rose', 5));

      // Nếu so sánh phân biệt hoa thường thì món quà rơi vào hư không và người
      // tặng không thấy gì xảy ra — không lỗi, không log.
      expect(scoreOf(stateOf('user_1'), 'cat')).toBe(5);
    });

    it('khớp khi tên quà dính khoảng trắng thừa', async () => {
      await service.getOrCreateBattle('user_1');

      await service.handleLiveEvent(viewer('@an').gifts('  Rose  ', 5));

      expect(scoreOf(stateOf('user_1'), 'cat')).toBe(5);
    });

    it('khớp tên quà tiếng Việt kể cả khi dấu được mã hoá dạng tổ hợp', async () => {
      await service.getOrCreateBattle('user_1');

      // `"Hoa Hồng"` dạng NFD: `ồ` là `o` cộng hai dấu rời. Nhìn trên màn hình
      // giống hệt dạng NFC mà mẫu đang khai, nhưng `===` trả về false — NFC dài
      // 8 ký tự, NFD dài 10. Nếu TikTok gửi dạng này và mã không chuẩn hoá thì
      // mọi món quà tiếng Việt đều không khớp phe nào.
      const nfd = 'Hoa Hồng'.normalize('NFD');
      expect(nfd).not.toBe('Hoa Hồng'.normalize('NFC'));

      await service.handleLiveEvent(viewer('@an').gifts(nfd, 7));

      expect(scoreOf(stateOf('user_1'), 'cat')).toBe(7);
    });

    it('bỏ qua sự kiện quà không có tên', async () => {
      await service.getOrCreateBattle('user_1');

      await service.handleLiveEvent(viewer('@an').gifts('', 100));
      await service.handleLiveEvent(viewer('@binh').gifts('   ', 100));

      // Không đoán phe. Cộng cho một phe mặc định thì con số trên sóng sai mà
      // không ai nhìn ra vì sao.
      expect(stateOf('user_1').teams.every((t) => t.score === 0)).toBe(true);
    });

    it('cho phe đứng trước thắng khi hai phe cùng khai một tên quà', async () => {
      await service.getOrCreateBattle('user_1');
      const battle = service['battles'].get('user_1')!;
      // Lỗi cấu hình của streamer, không phải trường hợp lạ: hai phe cùng nhận
      // "Rose". Hành vi phải cố định, không phụ thuộc thứ tự duyệt tình cờ.
      battle.state.teams.find((t) => t.key === 'dog')!.giftNames.push('Rose');

      await service.handleLiveEvent(viewer('@an').gifts('Rose', 9));

      expect(scoreOf(stateOf('user_1'), 'cat')).toBe(9);
      expect(scoreOf(stateOf('user_1'), 'dog')).toBe(0);
    });
  });

  // ── Nhóm B — ghi nhớ phe của người xem ───────────────────────────────────

  describe('ghi nhớ phe', () => {
    it('chuyển phe theo món quà gần nhất', async () => {
      await service.getOrCreateBattle('user_1');

      await service.handleLiveEvent(viewer('@an').gifts('Rose', 5)); // Mèo
      await service.handleLiveEvent(viewer('@an').gifts('Perfume', 5)); // Chó
      const before = scoreOf(stateOf('user_1'), 'dog');

      await service.handleLiveEvent(viewer('@an').likes(1));

      // Like phải đi theo phe mới. Người xem đổi phe giữa trận là hành vi bình
      // thường, không phải trường hợp biên.
      expect(scoreOf(stateOf('user_1'), 'dog')).toBeGreaterThan(before);
      expect(scoreOf(stateOf('user_1'), 'cat')).toBe(5);
    });

    it('gửi share về đúng phe người xem đã tặng quà', async () => {
      await service.getOrCreateBattle('user_1');

      await service.handleLiveEvent(viewer('@an').gifts('Donut', 5)); // Gấu
      const before = scoreOf(stateOf('user_1'), 'bear');

      await service.handleLiveEvent(viewer('@an').shares());

      expect(scoreOf(stateOf('user_1'), 'bear')).toBeGreaterThan(before);
    });

    it('gửi follow về đúng phe người xem đã tặng quà', async () => {
      await service.getOrCreateBattle('user_1');

      await service.handleLiveEvent(viewer('@an').gifts('Dragon', 5)); // Capy
      const before = scoreOf(stateOf('user_1'), 'capy');

      await service.handleLiveEvent(viewer('@an').follows());

      expect(scoreOf(stateOf('user_1'), 'capy')).toBeGreaterThan(before);
    });

    it('không để phe của một người xem rò từ phòng live này sang phòng khác', async () => {
      await service.getOrCreateBattle('user_1');
      await service.getOrCreateBattle('user_2');

      // Cùng một tài khoản TikTok xem hai phòng. Khoá ghi nhớ phải gồm cả
      // streamer, nếu không người này sẽ mang phe của phòng A sang phòng B.
      await service.handleLiveEvent(viewer('@an', 'chan_1').gifts('Rose', 5));
      await service.handleLiveEvent(viewer('@an', 'chan_2').likes(1));

      expect(stateOf('user_2').teams.every((t) => t.score === 0)).toBe(true);
    });

    it('thôi cộng điểm cho người xem đã bị đẩy khỏi bộ nhớ', async () => {
      await service.getOrCreateBattle('user_1');

      await service.handleLiveEvent(viewer('@an').gifts('Rose', 5));
      const before = scoreOf(stateOf('user_1'), 'cat');

      // Một buổi live viral có hàng chục nghìn người tặng quà, nên bộ nhớ có
      // trần và người cũ nhất bị bỏ đi. Đó là đánh đổi có chủ ý: mất phe đã ghi
      // nhớ còn hơn để một phòng đông làm cạn tiến trình.
      service['allegiance'].clear();
      await service.handleLiveEvent(viewer('@an').likes(1));

      expect(scoreOf(stateOf('user_1'), 'cat')).toBe(before);
    });
  });

  // ── Ngữ nghĩa khi đặt lại trận ───────────────────────────────────────────

  describe('đặt lại trận', () => {
    it('giữ phe của người xem sang trận mới', async () => {
      await service.getOrCreateBattle('user_1');
      await service.handleLiveEvent(viewer('@an').gifts('Rose', 5));

      await service.resetBattle('user_1');
      await service.handleLiveEvent(viewer('@an').likes(1));

      // Quyết định của sản phẩm: người hâm mộ một phe vẫn là người hâm mộ phe
      // đó ở ván sau. Bắt họ tặng lại chỉ để like được tính sẽ làm đầu mỗi trận
      // im ắng một cách vô cớ.
      expect(scoreOf(stateOf('user_1'), 'cat')).toBeGreaterThan(0);
    });

    it('nạp lại ngân sách chống spam cho trận mới', async () => {
      await service.getOrCreateBattle('user_1');
      await service.handleLiveEvent(viewer('@an').gifts('Rose', 5));

      // Sức chứa mặc định là 100 và mỗi lượt chạm tốn 1, nên một loạt đúng 100
      // lượt tiêu hết ví. Phải là con số vừa khít: loạt lớn hơn sức chứa bị từ
      // chối nguyên khối và **không** trừ gì cả (xem test dưới).
      await service.handleLiveEvent(viewer('@an').likes(100));
      const drained = scoreOf(stateOf('user_1'), 'cat');

      await service.handleLiveEvent(viewer('@an').likes(1));
      expect(scoreOf(stateOf('user_1'), 'cat')).toBe(drained);

      await service.resetBattle('user_1');
      await service.handleLiveEvent(viewer('@an').likes(1));

      // Ngân sách là hạn mức trong phạm vi một trận, không phải trọn đời. Giữ
      // lại thì người xem bước vào trận mới với ví rỗng và không hiểu vì sao
      // like của mình không ăn điểm.
      expect(scoreOf(stateOf('user_1'), 'cat')).toBeGreaterThan(0);
    });

    it('từ chối nguyên khối một loạt like vượt sức chứa, không trừ dần', async () => {
      await service.getOrCreateBattle('user_1');
      await service.handleLiveEvent(viewer('@an').gifts('Rose', 5));
      const afterGift = scoreOf(stateOf('user_1'), 'cat');

      // 500 lượt chạm vượt sức chứa 100. Loạt này không được tính điểm, nhưng
      // cũng không tiêu ví — nên ngay sau đó một lượt chạm đơn vẫn ăn điểm.
      await service.handleLiveEvent(viewer('@an').likes(500));
      expect(scoreOf(stateOf('user_1'), 'cat')).toBe(afterGift);

      await service.handleLiveEvent(viewer('@an').likes(1));
      expect(scoreOf(stateOf('user_1'), 'cat')).toBeGreaterThan(afterGift);
    });

    it('không trả lại phần thưởng follow ở trận mới', async () => {
      await service.getOrCreateBattle('user_1');
      await service.handleLiveEvent(viewer('@an').gifts('Rose', 5));
      await service.handleLiveEvent(viewer('@an').follows());

      await service.resetBattle('user_1');
      await service.handleLiveEvent(viewer('@an').follows());

      // Một người xem chỉ follow một lần trong đời và phần thưởng được trả đúng
      // lần đó. Nạp lại sẽ biến "unfollow rồi follow lại" thành cách cày điểm.
      expect(scoreOf(stateOf('user_1'), 'cat')).toBe(0);
    });
  });
});
