import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  LiveEvent,
  LiveEventType,
  RuleActionType,
  OverlayDispatchEvent,
  OVERLAY_DISPATCH_EVENT,
} from '@livenova/shared';
import { RuleEngineService } from './rule-engine.service';
import { PrismaService } from '../../prisma/prisma.service';

function makePrisma() {
  return {
    channel: { findUnique: jest.fn() },
    rule: { findMany: jest.fn() },
  };
}

function ruleRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'rule-1',
    userId: 'user-1',
    name: 'Quà to thì chạy video',
    enabled: true,
    priority: 0,
    conditions: { eventType: [LiveEventType.GIFT], minCoinValue: 100 },
    actions: [
      {
        type: RuleActionType.MEDIA_POPUP,
        payload: { mediaType: 'video', url: 'https://cdn.example/v.mp4', durationMs: 4000 },
      },
    ],
    continueMatching: false,
    cooldownMs: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function giftEvent(over: Partial<LiveEvent> = {}): LiveEvent {
  return {
    id: 'evt-1',
    type: LiveEventType.GIFT,
    channelId: 'chan-1',
    senderUsername: 'ngochan',
    senderDisplayName: 'Ngọc Hân',
    giftName: 'Sư tử',
    giftCoinValue: 29_999,
    occurredAt: new Date(),
    ...over,
  };
}

describe('RuleEngineService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let emitter: EventEmitter2;
  let emit: jest.SpyInstance;
  let service: RuleEngineService;

  beforeEach(() => {
    prisma = makePrisma();
    prisma.channel.findUnique.mockResolvedValue({ userId: 'user-1' });
    prisma.rule.findMany.mockResolvedValue([ruleRow()]);

    emitter = new EventEmitter2();
    emit = jest.spyOn(emitter, 'emit');
    service = new RuleEngineService(prisma as unknown as PrismaService, emitter);
  });

  function dispatched(): OverlayDispatchEvent[] {
    return emit.mock.calls
      .filter((call) => call[0] === OVERLAY_DISPATCH_EVENT)
      .map((call) => call[1] as OverlayDispatchEvent);
  }

  it('turns a matching live event into an overlay dispatch', async () => {
    await service.handleLiveEvent(giftEvent());

    const events = dispatched();
    expect(events).toHaveLength(1);
    expect(events[0].userId).toBe('user-1');
    expect(events[0].action.type).toBe(RuleActionType.MEDIA_POPUP);
    expect(events[0].action.ruleId).toBe('rule-1');
  });

  it('dispatches nothing when the condition does not hold', async () => {
    await service.handleLiveEvent(giftEvent({ giftCoinValue: 1 }));
    expect(dispatched()).toHaveLength(0);
  });

  it('never leaks the platform username or channel id to the overlay', async () => {
    // The overlay page is reachable with only a public token, so its payload is
    // effectively public.
    await service.handleLiveEvent(giftEvent());

    const context = dispatched()[0].action.event as unknown as Record<string, unknown>;
    expect(context.senderDisplayName).toBe('Ngọc Hân');
    expect(context).not.toHaveProperty('senderUsername');
    expect(context).not.toHaveProperty('channelId');
  });

  it('clamps an out-of-range media duration instead of trusting rule JSON', async () => {
    prisma.rule.findMany.mockResolvedValue([
      ruleRow({
        actions: [
          {
            type: RuleActionType.MEDIA_POPUP,
            payload: { mediaType: 'video', url: 'https://cdn.example/v.mp4', durationMs: 300_000 },
          },
        ],
      }),
    ]);

    await service.handleLiveEvent(giftEvent());

    expect(dispatched()[0].action.payload.durationMs).toBe(30_000);
  });

  it('does not dispatch action types no connected surface handles', async () => {
    prisma.rule.findMany.mockResolvedValue([
      ruleRow({ actions: [{ type: RuleActionType.OBS_COMMAND, payload: { scene: 'BRB' } }] }),
    ]);

    await service.handleLiveEvent(giftEvent());
    expect(dispatched()).toHaveLength(0);
  });

  it('honours cooldownMs across events rather than resetting per event', async () => {
    prisma.rule.findMany.mockResolvedValue([ruleRow({ cooldownMs: 60_000 })]);

    await service.handleLiveEvent(giftEvent());
    await service.handleLiveEvent(giftEvent({ id: 'evt-2' }));

    // A fresh evaluator per event would let both through.
    expect(dispatched()).toHaveLength(1);
  });

  it('ignores events for a channel that no longer exists', async () => {
    prisma.channel.findUnique.mockResolvedValue(null);

    await service.handleLiveEvent(giftEvent());

    expect(dispatched()).toHaveLength(0);
    expect(prisma.rule.findMany).not.toHaveBeenCalled();
  });

  it('caches the rule set instead of querying on every event', async () => {
    await service.handleLiveEvent(giftEvent());
    await service.handleLiveEvent(giftEvent({ id: 'evt-2', giftCoinValue: 1 }));

    expect(prisma.rule.findMany).toHaveBeenCalledTimes(1);
  });

  it('reloads rules after an edit so a mid-stream change takes effect', async () => {
    await service.handleLiveEvent(giftEvent());
    service.invalidateUser('user-1');
    await service.handleLiveEvent(giftEvent({ id: 'evt-2' }));

    expect(prisma.rule.findMany).toHaveBeenCalledTimes(2);
  });

  it('survives a database failure without throwing into the event bus', async () => {
    prisma.rule.findMany.mockRejectedValue(new Error('db down'));

    await expect(service.handleLiveEvent(giftEvent())).resolves.toBeUndefined();
    expect(dispatched()).toHaveLength(0);
  });
});
