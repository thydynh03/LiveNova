import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  LiveEvent,
  LiveEventType,
  GoalState,
  OverlayStateDispatch,
  OVERLAY_STATE_EVENT,
} from '@livenova/shared';
import { GoalService } from './goal.service';
import { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  return {
    channel: { findUnique: jest.fn() },
    overlay: { findMany: jest.fn() },
  };
}

function gift(coins: number, over: Partial<LiveEvent> = {}): LiveEvent {
  return {
    id: 'evt-1',
    type: LiveEventType.GIFT,
    channelId: 'chan-1',
    senderUsername: 'ngochan',
    senderDisplayName: 'Ngọc Hân',
    giftName: 'Hoa hồng',
    giftCoinValue: coins,
    occurredAt: new Date(),
    ...over,
  };
}

describe('GoalService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let emitter: EventEmitter2;
  let emit: jest.SpyInstance;
  let service: GoalService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.channel.findUnique.mockResolvedValue({ userId: 'user-1' });
    prisma.overlay.findMany.mockResolvedValue([
      { id: 'goal-1', config: { target: 1000, label: 'Mục tiêu hôm nay' } },
    ]);

    emitter = new EventEmitter2();
    emit = jest.spyOn(emitter, 'emit');
    service = new GoalService(prisma as unknown as PrismaService, emitter);
  });

  function states(): GoalState[] {
    return emit.mock.calls
      .filter((c) => c[0] === OVERLAY_STATE_EVENT)
      .map((c) => (c[1] as OverlayStateDispatch).state as GoalState);
  }

  it('accumulates coins across gifts instead of reporting each one', async () => {
    await service.handleGift(gift(200));
    await service.handleGift(gift(300, { id: 'evt-2' }));

    expect(states().map((s) => s.current)).toEqual([200, 500]);
  });

  it('carries the configured target and label', async () => {
    await service.handleGift(gift(10));

    expect(states()[0]).toMatchObject({ target: 1000, label: 'Mục tiêu hôm nay' });
  });

  it('falls back to defaults when the config is empty or malformed', async () => {
    prisma.overlay.findMany.mockResolvedValue([{ id: 'goal-1', config: { target: 'lots' } }]);

    await service.handleGift(gift(10));

    expect(states()[0].target).toBe(10_000);
    expect(states()[0].label).toBe('Mục tiêu hôm nay');
  });

  it('addresses the state at the goal overlay, not the whole user room', async () => {
    await service.handleGift(gift(10));

    const dispatch = emit.mock.calls.find(
      (c) => c[0] === OVERLAY_STATE_EVENT,
    )?.[1] as OverlayStateDispatch;
    expect(dispatch.overlayId).toBe('goal-1');
  });

  it('ignores non-gift value and events with no coins', async () => {
    await service.handleGift(gift(0));
    await service.handleGift(gift(-5, { id: 'evt-2' }));

    expect(states()).toHaveLength(0);
    expect(prisma.channel.findUnique).not.toHaveBeenCalled();
  });

  it('ignores an event for a channel that no longer exists', async () => {
    prisma.channel.findUnique.mockResolvedValue(null);

    await service.handleGift(gift(100));

    expect(states()).toHaveLength(0);
  });

  it('emits nothing when the user has no enabled GOAL overlay', async () => {
    prisma.overlay.findMany.mockResolvedValue([]);

    await service.handleGift(gift(100));

    expect(states()).toHaveLength(0);
  });

  it('resets when the calendar day changes', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-06T20:00:00Z'));
    await service.handleGift(gift(400));
    expect(service.currentFor('goal-1')).toBe(400);

    // A "daily goal" that never resets is a running total, which is not what
    // the label on the bar says.
    jest.setSystemTime(new Date('2026-08-07T01:00:00Z'));
    await service.handleGift(gift(50, { id: 'evt-2' }));

    expect(states().map((s) => s.current)).toEqual([400, 50]);
    jest.useRealTimers();
  });

  it('reports zero for an overlay whose total is from a previous day', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-06T20:00:00Z'));
    // `void` here left the write pending, so the assertion below passed against
    // an empty map and proved nothing.
    await service.handleGift(gift(400));
    expect(service.currentFor('goal-1')).toBe(400);

    jest.setSystemTime(new Date('2026-08-08T01:00:00Z'));
    expect(service.currentFor('goal-1')).toBe(0);
    jest.useRealTimers();
  });

  it('caches the overlay lookup rather than querying per gift', async () => {
    await service.handleGift(gift(10));
    await service.handleGift(gift(10, { id: 'evt-2' }));

    expect(prisma.overlay.findMany).toHaveBeenCalledTimes(1);
  });

  it('re-reads overlays after the user changes them', async () => {
    await service.handleGift(gift(10));
    service.invalidateUser({ userId: 'user-1' });
    await service.handleGift(gift(10, { id: 'evt-2' }));

    // A streamer who raises their target mid-broadcast should see it apply.
    expect(prisma.overlay.findMany).toHaveBeenCalledTimes(2);
  });

  it('survives a database failure without throwing into the event bus', async () => {
    prisma.overlay.findMany.mockRejectedValue(new Error('db down'));

    await expect(service.handleGift(gift(100))).resolves.toBeUndefined();
    expect(states()).toHaveLength(0);
  });
});
