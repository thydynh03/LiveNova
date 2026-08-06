import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BattleUpdate,
  PkState,
  OverlayStateDispatch,
  OVERLAY_STATE_EVENT,
} from '@livenova/shared';
import { PkService } from './pk.service';
import { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  return {
    channel: { findUnique: jest.fn() },
    overlay: { findMany: jest.fn() },
  };
}

function battle(over: Partial<BattleUpdate> = {}): BattleUpdate {
  return {
    channelId: 'chan-1',
    battleId: 'b-1',
    status: 1,
    endsAtMs: 1_700_000_300_000,
    teams: [
      { hostDisplayName: 'Ngọc Hân', score: 1500, mvpDisplayName: 'Tuấn Kiệt' },
      { hostDisplayName: 'Bảo Trâm', score: 1200 },
    ],
    ...over,
  };
}

describe('PkService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let emitter: EventEmitter2;
  let emit: jest.SpyInstance;
  let service: PkService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.channel.findUnique.mockResolvedValue({ userId: 'user-1' });
    prisma.overlay.findMany.mockResolvedValue([{ id: 'pk-1' }]);

    emitter = new EventEmitter2();
    emit = jest.spyOn(emitter, 'emit');
    service = new PkService(prisma as unknown as PrismaService, emitter);
  });

  function states(): PkState[] {
    return emit.mock.calls
      .filter((c) => c[0] === OVERLAY_STATE_EVENT)
      .map((c) => (c[1] as OverlayStateDispatch).state as PkState);
  }

  it('publishes both sides with their real scores', async () => {
    await service.handleBattle(battle());

    expect(states()[0].sides.map((s) => s.score)).toEqual([1500, 1200]);
    expect(states()[0].sides[0].hostDisplayName).toBe('Ngọc Hân');
  });

  it('carries the MVP when the platform reported one', async () => {
    await service.handleBattle(battle());

    expect(states()[0].sides[0].mvpDisplayName).toBe('Tuấn Kiệt');
    expect(states()[0].sides[1].mvpDisplayName).toBeUndefined();
  });

  it('sends an absolute end time, not a countdown', async () => {
    await service.handleBattle(battle());

    // A browser source reconnecting mid-round would restart a seconds-remaining
    // clock from a stale number.
    expect(states()[0].endsAtMs).toBe(1_700_000_300_000);
  });

  it('marks a finished round inactive so the timer stops', async () => {
    await service.handleBattle(battle({ status: 3 }));
    expect(states()[0].active).toBe(false);

    emit.mockClear();
    await service.handleBattle(battle({ status: 1 }));
    expect(states()[0].active).toBe(true);
  });

  it('labels a side whose host nickname is missing', async () => {
    await service.handleBattle(
      battle({ teams: [{ hostDisplayName: '', score: 10 }, { hostDisplayName: '  ', score: 5 }] }),
    );

    // A blank label renders as an empty side on the broadcast.
    expect(states()[0].sides.map((s) => s.hostDisplayName)).toEqual(['Đội 1', 'Đội 2']);
  });

  it('sits out a multi-guest battle rather than misstating the score', async () => {
    await service.handleBattle(
      battle({
        teams: [
          { hostDisplayName: 'A', score: 1 },
          { hostDisplayName: 'B', score: 2 },
          { hostDisplayName: 'C', score: 3 },
        ],
      }),
    );

    expect(states()).toHaveLength(0);
  });

  it('ignores a frame with no teams', async () => {
    await service.handleBattle(battle({ teams: [] }));
    expect(states()).toHaveLength(0);
  });

  it('addresses each PK overlay individually', async () => {
    prisma.overlay.findMany.mockResolvedValue([{ id: 'pk-1' }, { id: 'pk-2' }]);

    await service.handleBattle(battle());

    const ids = emit.mock.calls
      .filter((c) => c[0] === OVERLAY_STATE_EVENT)
      .map((c) => (c[1] as OverlayStateDispatch).overlayId);
    expect(ids).toEqual(['pk-1', 'pk-2']);
  });

  it('emits nothing when the user has no enabled PK overlay', async () => {
    prisma.overlay.findMany.mockResolvedValue([]);

    await service.handleBattle(battle());

    expect(states()).toHaveLength(0);
  });

  it('ignores a frame for a channel that no longer exists', async () => {
    prisma.channel.findUnique.mockResolvedValue(null);

    await service.handleBattle(battle());

    expect(states()).toHaveLength(0);
  });

  it('caches the overlay lookup and re-reads it after a change', async () => {
    await service.handleBattle(battle());
    await service.handleBattle(battle());
    expect(prisma.overlay.findMany).toHaveBeenCalledTimes(1);

    service.invalidateUser({ userId: 'user-1' });
    await service.handleBattle(battle());
    expect(prisma.overlay.findMany).toHaveBeenCalledTimes(2);
  });

  it('survives a database failure without throwing into the event bus', async () => {
    prisma.overlay.findMany.mockRejectedValue(new Error('db down'));

    await expect(service.handleBattle(battle())).resolves.toBeUndefined();
    expect(states()).toHaveLength(0);
  });
});
