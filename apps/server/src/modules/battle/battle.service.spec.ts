import { EventEmitter2 } from '@nestjs/event-emitter';
import { LiveEventType } from '@livenova/shared';
import { BattleService } from './battle.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('BattleService (Kingdom War 4-Way)', () => {
  let service: BattleService;
  let prisma: PrismaService;
  let emitter: EventEmitter2;

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
      },
      battleScore: { upsert: jest.fn() },
      battleDonor: { upsert: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    } as unknown as PrismaService;

    emitter = {
      emit: jest.fn(),
    } as unknown as EventEmitter2;

    service = new BattleService(prisma, emitter);
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

      const fresh = new BattleService(prisma, emitter);
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

      const fresh = new BattleService(prisma, emitter);
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
});
