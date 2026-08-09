import { EventEmitter2 } from '@nestjs/event-emitter';
import { LiveEventType } from '@livenova/shared';
import { BattleService } from './battle.service';
import { BattleCoordinatorService } from './battle-coordinator.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('BattleService (Kingdom War 4-Way)', () => {
  let service: BattleService;
  let prisma: PrismaService;
  let emitter: EventEmitter2;
  let coordinator: BattleCoordinatorService;

  beforeEach(() => {
    prisma = {
      userTemplate: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      overlay: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      channel: {
        findUnique: jest.fn().mockResolvedValue({ userId: 'user_1' }),
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

    emitter = {
      emit: jest.fn(),
    } as unknown as EventEmitter2;

    // Single-instance behaviour: this process owns everything and never
    // forwards. The multi-instance paths have their own spec.
    coordinator = {
      registerHandler: jest.fn(),
      isOwner: jest.fn().mockReturnValue(true),
      claim: jest.fn().mockResolvedValue(true),
      release: jest.fn().mockResolvedValue(undefined),
      ownedBattles: jest.fn().mockReturnValue([]),
      forward: jest.fn(),
    } as unknown as BattleCoordinatorService;

    service = new BattleService(prisma, emitter, coordinator);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('initializes a default battle with 4 kingdoms (cat, dog, bear, capy)', async () => {
    const battle = await service.getOrCreateBattle('user_1');
    expect(battle).toBeDefined();
    expect(battle.teams.length).toBe(4);
    expect(battle.teams.map((t) => t.key)).toEqual(['cat', 'dog', 'bear', 'capy']);
    expect(battle.teams[0].castleHp).toBe(1000);
    expect(battle.teams[0].quote).toBeDefined();
    expect(battle.teams[0].motto).toBeDefined();
    expect(battle.active).toBe(true);
  });

  it('starts every kingdom at zero rather than on an invented scoreboard', async () => {
    const battle = await service.getOrCreateBattle('user_1');

    // These used to open at 3400 / 2200 / 2400 / 2000 with four made-up names
    // already on the donor board — an invented scoreboard shown to a live
    // audience next to real donations.
    expect(battle.teams.map((t) => t.score)).toEqual([0, 0, 0, 0]);
    expect(battle.teams.every((t) => t.soldierCount === 0)).toBe(true);
    expect(battle.topDonors).toHaveLength(0);
  });

  it('scores a gift by its real coin value, not by guessing from its name', async () => {
    await service.getOrCreateBattle('user_1');

    const updated = await service.simulateEvent('user_1', {
      sender: '@super_donor',
      teamKey: 'cat',
      eventType: 'GIFT',
      giftName: 'Rose',
      giftCount: 2,
      coinValue: 5,
    });

    // Name matching read an unrecognised gift as 1 no matter what it cost, so
    // the largest donations scored the least.
    expect(updated.teams.find((t) => t.key === 'cat')?.score).toBe(10);
    expect(updated.topDonors.some((d) => d.username === '@super_donor')).toBe(true);
    expect(updated.recentEvents).toHaveLength(1);
    expect(updated.recentEvents[0].quote).toBeDefined();
  });

  it('lets a big enough gift decide the round', async () => {
    await service.getOrCreateBattle('user_1');

    const updated = await service.simulateEvent('user_1', {
      sender: '@whale',
      teamKey: 'cat',
      eventType: 'GIFT',
      giftName: 'Universe',
      giftCount: 1,
      coinValue: 34_999,
    });

    for (const opponent of updated.teams.filter((t) => t.key !== 'cat')) {
      expect(opponent.castleHp).toBe(0);
    }
    expect(updated.winnerTeamKey).toBe('cat');
  });

  it('ignores an event aimed at a team that does not exist', async () => {
    await service.getOrCreateBattle('user_1');

    const updated = await service.simulateEvent('user_1', {
      sender: '@typo',
      teamKey: 'nonexistent',
      eventType: 'GIFT',
      giftName: 'Rose',
      coinValue: 100,
    });

    // Falling back to the first team meant a typo in the config quietly moved
    // points to the wrong kingdom, with nothing on screen to show why.
    expect(updated.teams.every((t) => t.score === 0)).toBe(true);
    expect(updated.topDonors).toHaveLength(0);
  });

  it('resets the battle round cleanly for all 4 kingdoms', async () => {
    await service.getOrCreateBattle('user_1');
    await service.simulateEvent('user_1', {
      sender: '@user',
      teamKey: 'cat',
      eventType: 'LIKE',
    });

    const resetState = await service.resetBattle('user_1');
    expect(resetState.teams.length).toBe(4);
    expect(resetState.teams[0].score).toBe(0);
    expect(resetState.teams[0].castleHp).toBe(1000);
    expect(resetState.topDonors.length).toBe(0);
    expect(resetState.winnerTeamKey).toBeNull();
  });
  describe('live traffic', () => {
    const liveEvent = (over: Record<string, unknown> = {}) => ({
      id: 'e1',
      type: LiveEventType.GIFT,
      channelId: 'chan_1',
      senderUsername: 'ngochan',
      senderDisplayName: 'Ngọc Hân',
      giftName: 'Rose',
      giftCoinValue: 5,
      occurredAt: new Date(),
      ...over,
    });

    it('listens on the channel the ingest actually publishes', async () => {
      await service.getOrCreateBattle('user_1');

      // The listener was bound to `tiktok.event`, which nothing emits. The
      // whole feature looked wired and never received a single real gift.
      await service.handleLiveEvent(liveEvent() as never);

      expect(service['battles'].get('user_1')?.state.teams.find((t) => t.key === 'cat')?.score)
        .toBe(5);
    });

    it('ignores a gift no team claims instead of crediting a default one', async () => {
      await service.getOrCreateBattle('user_1');

      await service.handleLiveEvent(liveEvent({ giftName: 'Chưa gán phe nào' }) as never);

      const state = service['battles'].get('user_1')!.state;
      expect(state.teams.every((t) => t.score === 0)).toBe(true);
    });

    it('does not score a like from someone who has never gifted', async () => {
      await service.getOrCreateBattle('user_1');

      await service.handleLiveEvent(
        liveEvent({ type: LiveEventType.LIKE, giftName: undefined }) as never,
      );

      // Every like used to land on whichever team was listed first, so the cat
      // kingdom collected the entire room's taps.
      const state = service['battles'].get('user_1')!.state;
      expect(state.teams.every((t) => t.score === 0)).toBe(true);
    });

    it('sends a like to the team the sender last gifted to', async () => {
      await service.getOrCreateBattle('user_1');

      await service.handleLiveEvent(liveEvent({ giftName: 'Perfume', giftCoinValue: 20 }) as never);
      await service.handleLiveEvent(
        liveEvent({ type: LiveEventType.LIKE, giftName: undefined }) as never,
      );

      const state = service['battles'].get('user_1')!.state;
      expect(state.teams.find((t) => t.key === 'dog')?.score).toBeGreaterThan(20);
      expect(state.teams.find((t) => t.key === 'cat')?.score).toBe(0);
    });

    it('ignores an event whose sender the platform did not name', async () => {
      await service.getOrCreateBattle('user_1');

      await service.handleLiveEvent(liveEvent({ senderUsername: 'unknown' }) as never);

      const state = service['battles'].get('user_1')!.state;
      expect(state.teams.every((t) => t.score === 0)).toBe(true);
    });
  });
  describe('surviving a restart', () => {
    it('resumes a running round instead of starting from zero', async () => {
      const endsAt = new Date(Date.now() + 10 * 60 * 1000);
      (prisma.battle.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'battle_row_1',
          userId: 'user_1',
          templateId: null,
          title: 'Tran dang chay',
          configSnapshot: { battle: { durationSec: 1800, showTopDonors: 5 } },
          endsAt,
          winnerTeamKey: null,
          scores: [{ teamKey: 'cat', score: 45000, castleHp: 800, soldierCount: 30 }],
          donors: [
            { username: '@whale', nickname: 'Whale', teamKey: 'cat', totalScore: 45000 },
          ],
        },
      ]);

      const fresh = new BattleService(prisma, emitter, coordinator);
      fresh.onModuleInit();
      await new Promise((r) => setImmediate(r));

      // A deploy takes seconds. Dropping the scoreboard to zero mid-broadcast
      // happens in front of an audience that has just paid to move it.
      const state = await fresh.getOrCreateBattle('user_1');
      expect(state.battleId).toBe('battle_row_1');
      expect(state.teams.find((t) => t.key === 'cat')?.score).toBe(45000);
      expect(state.teams.find((t) => t.key === 'cat')?.castleHp).toBe(800);
      expect(state.topDonors[0].username).toBe('@whale');
      expect(state.endsAtMs).toBe(endsAt.getTime());

      fresh.onModuleDestroy();
    });

    it('does not resume a round whose clock has already run out', async () => {
      (prisma.battle.findMany as jest.Mock).mockResolvedValue([]);

      const fresh = new BattleService(prisma, emitter, coordinator);
      fresh.onModuleInit();
      await new Promise((r) => setImmediate(r));

      // The query filters on endsAt, so an expired round is never handed back.
      expect(prisma.battle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'RUNNING' }),
        }),
      );

      fresh.onModuleDestroy();
    });

    it('keeps a battle row so the score has somewhere to be written', async () => {
      await service.getOrCreateBattle('user_1');
      expect(prisma.battle.create).toHaveBeenCalled();
    });
  });

  describe('spam budget', () => {
    const gift = () => ({
      id: 'g1',
      type: LiveEventType.GIFT,
      channelId: 'chan_1',
      senderUsername: 'spammer',
      senderDisplayName: 'Spammer',
      giftName: 'Rose',
      giftCoinValue: 5,
      occurredAt: new Date(),
    });

    const like = (content: string) => ({
      id: 'l1',
      type: LiveEventType.LIKE,
      channelId: 'chan_1',
      senderUsername: 'spammer',
      senderDisplayName: 'Spammer',
      content,
      occurredAt: new Date(),
    });

    it('stops paying out once a viewer drains their budget', async () => {
      await service.getOrCreateBattle('user_1');
      await service.handleLiveEvent(gift() as never);

      const battle = service['battles'].get('user_1')!;
      const startingScore = battle.state.teams.find((t) => t.key === 'cat')!.score;

      // The default capacity is 100 at 1 power per like, so well past it.
      for (let i = 0; i < 400; i += 1) {
        await service.handleLiveEvent(like('Tha 1 tim') as never);
      }

      const gained = battle.state.teams.find((t) => t.key === 'cat')!.score - startingScore;
      expect(gained).toBeGreaterThan(0);
      expect(gained).toBeLessThanOrEqual(battle.config.energy.capacity);
    });

    it('charges for the whole batch a like frame reports, not one per frame', async () => {
      await service.getOrCreateBattle('user_1');
      await service.handleLiveEvent(gift() as never);

      const battle = service['battles'].get('user_1')!;
      const before = battle.state.teams.find((t) => t.key === 'cat')!.score;

      // `likeCount` in a webcast frame is already a sum; the ingest renders it
      // as "Tha N tim". Charging one unit per frame would let a burst of 40
      // through for the price of one.
      await service.handleLiveEvent(like('Tha 40 tim') as never);

      const gained = battle.state.teams.find((t) => t.key === 'cat')!.score - before;
      expect(gained).toBe(40);
    });

    it('counts a follow once, however many times it is redone', async () => {
      await service.getOrCreateBattle('user_1');
      await service.handleLiveEvent(gift() as never);

      const battle = service['battles'].get('user_1')!;
      const before = battle.state.teams.find((t) => t.key === 'cat')!.score;

      const follow = { ...like(''), type: LiveEventType.FOLLOW, id: 'f1' };
      await service.handleLiveEvent(follow as never);
      await service.handleLiveEvent(follow as never);
      await service.handleLiveEvent(follow as never);

      const gained = battle.state.teams.find((t) => t.key === 'cat')!.score - before;
      expect(gained).toBe(battle.config.power.follow);
    });

    it('never lets a free event buy an expensive effect', async () => {
      await service.getOrCreateBattle('user_1');
      const battle = service['battles'].get('user_1')!;

      await service.simulateEvent('user_1', {
        sender: '@x',
        teamKey: 'cat',
        eventType: 'FOLLOW',
        giftCount: 500,
      });

      // Lowering the power of free events is not enough on its own: spam still
      // accumulates towards the dragon threshold. The tier is capped instead.
      const fired = battle.state.recentEvents[0].actionKey;
      expect(['soldier', 'castle']).toContain(fired);
    });
  });
  describe('ending a round', () => {
    /** Drives the service's own one-second tick. */
    async function tick(svc: BattleService) {
      svc['tickEnergyRefill']();
      await new Promise((r) => setImmediate(r));
    }

    it('ends the match when the clock runs out', async () => {
      await service.getOrCreateBattle('user_1');
      const battle = service['battles'].get('user_1')!;
      battle.state.teams.find((t) => t.key === 'dog')!.score = 900;

      // Nothing checked endsAtMs, so the countdown reached 00:00 and the round
      // simply carried on — no winner, no result, gifts still scoring.
      battle.state.endsAtMs = Date.now() - 1;
      await tick(service);

      expect(battle.state.active).toBe(false);
      expect(battle.state.winnerTeamKey).toBe('dog');
    });

    it('writes the result to the row instead of leaving it RUNNING forever', async () => {
      await service.getOrCreateBattle('user_1');
      const battle = service['battles'].get('user_1')!;
      battle.state.teams.find((t) => t.key === 'cat')!.score = 50;
      battle.state.endsAtMs = Date.now() - 1;

      await tick(service);

      // FINISHED existed in the schema from the start and nothing wrote it, so
      // a restart would happily resume a match that ended hours ago.
      expect(prisma.battle.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          // Guarded on RUNNING, so a second process reaching this line for the
          // same battle writes nothing instead of overwriting the winner the
          // first one recorded.
          where: { id: 'battle_row_1', status: 'RUNNING' },
          data: expect.objectContaining({ status: 'FINISHED', winnerTeamKey: 'cat' }),
        }),
      );
    });

    it('admits a draw rather than inventing a winner', async () => {
      await service.getOrCreateBattle('user_1');
      const battle = service['battles'].get('user_1')!;
      battle.state.teams.find((t) => t.key === 'cat')!.score = 500;
      battle.state.teams.find((t) => t.key === 'dog')!.score = 500;
      battle.state.endsAtMs = Date.now() - 1;

      await tick(service);

      // Picking whichever team sorts first, in front of an audience that paid
      // for the result, is worse than saying it was tied.
      expect(battle.state.winnerTeamKey).toBeNull();
    });

    it('leaves a scoreless round without a winner', async () => {
      await service.getOrCreateBattle('user_1');
      const battle = service['battles'].get('user_1')!;
      battle.state.endsAtMs = Date.now() - 1;

      await tick(service);

      expect(battle.state.winnerTeamKey).toBeNull();
      expect(battle.state.active).toBe(false);
    });

    it('closes the round the moment the last castle falls', async () => {
      await service.getOrCreateBattle('user_1');

      await service.simulateEvent('user_1', {
        sender: '@whale',
        teamKey: 'cat',
        eventType: 'GIFT',
        giftName: 'Universe',
        coinValue: 34_999,
      });
      await new Promise((r) => setImmediate(r));

      const battle = service['battles'].get('user_1')!;
      expect(battle.state.winnerTeamKey).toBe('cat');
      expect(battle.state.active).toBe(false);
    });

    it('stops scoring once the round is over', async () => {
      await service.getOrCreateBattle('user_1');
      const battle = service['battles'].get('user_1')!;
      battle.state.endsAtMs = Date.now() - 1;
      await tick(service);

      await service.simulateEvent('user_1', {
        sender: '@latecomer',
        teamKey: 'dog',
        eventType: 'GIFT',
        giftName: 'Rose',
        coinValue: 5000,
      });

      // Somebody gifting a second after the horn must not move a result that
      // has already been announced.
      expect(battle.state.teams.find((t) => t.key === 'dog')!.score).toBe(0);
      expect(battle.state.topDonors).toHaveLength(0);
    });

    it('closes only once, however many times the tick runs', async () => {
      await service.getOrCreateBattle('user_1');
      const battle = service['battles'].get('user_1')!;
      battle.state.endsAtMs = Date.now() - 1;

      await tick(service);
      (prisma.battle.update as jest.Mock).mockClear();
      await tick(service);
      await tick(service);

      expect(prisma.battle.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FINISHED' }) }),
      );
    });
  });
  describe('top donors', () => {
    const give = (sender: string, coins: number, team = 'cat', displayName?: string) =>
      service.simulateEvent('user_1', {
        sender,
        senderDisplayName: displayName,
        teamKey: team,
        eventType: 'GIFT',
        giftName: 'Rose',
        coinValue: coins,
      });

    beforeEach(async () => {
      await service.getOrCreateBattle('user_1');
    });

    it('keeps a total after the donor drops off the visible board', async () => {
      await give('@small', 10);
      // Five bigger donors push @small out of the top five.
      for (let i = 0; i < 5; i += 1) await give(`@big${i}`, 500 + i);

      const board = () => service['battles'].get('user_1')!.state.topDonors;
      expect(board().some((d) => d.username === '@small')).toBe(false);

      await give('@small', 5000);

      // Truncating the stored list meant @small restarted from zero, so the
      // board understated the person most likely to notice.
      expect(board().find((d) => d.username === '@small')?.totalScore).toBe(5010);
    });

    it('counts a donor once when they switch sides', async () => {
      await give('@switcher', 100, 'cat');
      await give('@switcher', 200, 'dog');

      const rows = service['battles']
        .get('user_1')!
        .state.topDonors.filter((d) => d.username === '@switcher');

      // Keying on username *and* team put the same person on the board twice
      // with their total split between the rows.
      expect(rows).toHaveLength(1);
      expect(rows[0].totalScore).toBe(300);
      expect(rows[0].teamKey).toBe('dog');
    });

    it('shows the platform display name rather than the handle', async () => {
      await give('@ngochan', 50, 'cat', 'Ngọc Hân');

      const row = service['battles']
        .get('user_1')!
        .state.topDonors.find((d) => d.username === '@ngochan');
      expect(row?.nickname).toBe('Ngọc Hân');
    });

    it('falls back to the handle when the platform sent no name', async () => {
      await give('@anon', 50);

      const row = service['battles']
        .get('user_1')!
        .state.topDonors.find((d) => d.username === '@anon');
      expect(row?.nickname).toBe('anon');
    });

    it('shows only as many rows as the template asks for', async () => {
      for (let i = 0; i < 12; i += 1) await give(`@d${i}`, 100 + i);

      const battle = service['battles'].get('user_1')!;
      expect(battle.state.topDonors).toHaveLength(battle.config.battle.showTopDonors);
      // …while still tracking everyone underneath.
      expect(battle.donors.size).toBe(12);
    });

    it('persists every donor, not only the visible ones', async () => {
      for (let i = 0; i < 8; i += 1) await give(`@d${i}`, 100 + i);

      await service['flush']();

      const upserts = (prisma.battleDonor.upsert as jest.Mock).mock.calls.length;
      expect(upserts).toBe(8);
    });

    it('clears the board when the round is reset', async () => {
      await give('@someone', 100);
      await service.resetBattle('user_1');

      const battle = service['battles'].get('user_1')!;
      expect(battle.state.topDonors).toHaveLength(0);
      expect(battle.donors.size).toBe(0);
    });
  });

  describe('when another instance owns the battle', () => {
    it('does not run the clock, so energy cannot refill at twice the rate', async () => {
      await service.getOrCreateBattle('user_1');
      const battle = service['battles'].get('user_1')!;
      battle.state.teams.forEach((t) => (t.energy = 10));

      // The lease moved to another process. This one still holds a copy of the
      // state, and ticking it would refill the same battle a second time every
      // second — a bug that reads as a balance problem in the config.
      (coordinator.isOwner as jest.Mock).mockReturnValue(false);
      service['tickEnergyRefill']();
      await new Promise((r) => setImmediate(r));

      expect(battle.state.teams.every((t) => t.energy === 10)).toBe(true);
    });

    it('does not flush, so it cannot overwrite the live scores of the owner', async () => {
      await service.getOrCreateBattle('user_1');
      service['dirty'].add('user_1');

      (coordinator.isOwner as jest.Mock).mockReturnValue(false);
      await service['flush']();

      // Our copy stopped moving when we lost the lease. Writing it would drag
      // the scoreboard backwards in front of the audience.
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('ends the round without overwriting a result another instance recorded', async () => {
      await service.getOrCreateBattle('user_1');
      const battle = service['battles'].get('user_1')!;
      battle.state.teams.find((t) => t.key === 'cat')!.score = 50;
      battle.state.endsAtMs = Date.now() - 1;

      // The guarded update matched no row: someone else closed this battle.
      (prisma.battle.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      service['tickEnergyRefill']();
      await new Promise((r) => setImmediate(r));

      // No throw, and no second FINISHED write with a different winner.
      expect(prisma.battle.updateMany).toHaveBeenCalledTimes(1);
    });
  });

});
