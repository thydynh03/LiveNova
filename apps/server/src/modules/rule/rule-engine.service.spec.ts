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
import { TtsService } from '../tts/tts.service';

function makePrisma() {
  return {
    channel: { findUnique: jest.fn() },
    rule: { findMany: jest.fn() },
    overlay: { findFirst: jest.fn() },
    ttsSettings: { findUnique: jest.fn() },
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
  let tts: { synthesize: jest.Mock };

  beforeEach(() => {
    prisma = makePrisma();
    prisma.channel.findUnique.mockResolvedValue({ userId: 'user-1' });
    prisma.rule.findMany.mockResolvedValue([ruleRow()]);
    prisma.overlay.findFirst.mockResolvedValue({ id: 'overlay-1' });
    prisma.ttsSettings.findUnique.mockResolvedValue(null);

    tts = { synthesize: jest.fn().mockResolvedValue({ url: 'data:audio/mpeg;base64,AAA' }) };

    emitter = new EventEmitter2();
    emit = jest.spyOn(emitter, 'emit');
    service = new RuleEngineService(
      prisma as unknown as PrismaService,
      emitter,
      tts as unknown as TtsService,
    );
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
  describe('TTS_READ', () => {
    const ttsRule = () =>
      ruleRow({
        actions: [
          {
            type: RuleActionType.TTS_READ,
            payload: { text: 'Cảm ơn {sender} đã tặng {gift} ({coins} xu)' },
          },
        ],
      });

    beforeEach(() => {
      prisma.rule.findMany.mockResolvedValue([ttsRule()]);
    });

    it('synthesises on the server and hands the overlay a playable URL', async () => {
      // The overlay authenticates with a public token alone, so it has no
      // identity to bill and cannot call the metered endpoint itself.
      await service.handleLiveEvent(giftEvent());

      expect(tts.synthesize).toHaveBeenCalledTimes(1);
      expect(dispatched()[0].action.payload.audioUrl).toBe('data:audio/mpeg;base64,AAA');
    });

    it('interpolates placeholders before synthesis, not after', async () => {
      await service.handleLiveEvent(giftEvent());

      // Synthesising the raw template would read "dấu ngoặc sender" aloud.
      expect(tts.synthesize).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Cảm ơn Ngọc Hân đã tặng Sư tử (29999 xu)' }),
        'user-1',
      );
    });

    it('bills the owner of the channel', async () => {
      await service.handleLiveEvent(giftEvent());
      expect(tts.synthesize).toHaveBeenCalledWith(expect.anything(), 'user-1');
    });

    it('uses the saved voice settings of the owner', async () => {
      prisma.ttsSettings.findUnique.mockResolvedValue({
        voiceId: 'vi-VN-Standard-B',
        rate: 0.8,
        pitch: 2,
        volume: 0.5,
      });

      await service.handleLiveEvent(giftEvent());

      expect(tts.synthesize).toHaveBeenCalledWith(
        expect.objectContaining({ voice: 'vi-VN-Standard-B', rate: 0.8 }),
        'user-1',
      );
      expect(dispatched()[0].action.payload.volume).toBe(0.5);
    });

    it('skips the action when the user is out of credits, without throwing', async () => {
      tts.synthesize.mockRejectedValue(new Error('Insufficient credits'));

      await expect(service.handleLiveEvent(giftEvent())).resolves.toBeUndefined();
      expect(dispatched()).toHaveLength(0);
    });

    it('does not spend a credit on an empty template', async () => {
      prisma.rule.findMany.mockResolvedValue([
        ruleRow({ actions: [{ type: RuleActionType.TTS_READ, payload: { text: '   ' } }] }),
      ]);

      await service.handleLiveEvent(giftEvent());

      expect(tts.synthesize).not.toHaveBeenCalled();
      expect(dispatched()).toHaveLength(0);
    });
  });

  describe('delivery target', () => {
    it('addresses one overlay instead of the whole user room', async () => {
      // Broadcasting would make a streamer with a chat source and an alerts
      // source open hear every line spoken twice.
      await service.handleLiveEvent(giftEvent());
      expect(dispatched()[0].overlayId).toBe('overlay-1');
    });

    it('drops the action when the user has no enabled MEDIA overlay', async () => {
      prisma.overlay.findFirst.mockResolvedValue(null);

      await service.handleLiveEvent(giftEvent());

      expect(dispatched()).toHaveLength(0);
    });

    it('interpolates the caption of a media popup too', async () => {
      prisma.rule.findMany.mockResolvedValue([
        ruleRow({
          actions: [
            {
              type: RuleActionType.MEDIA_POPUP,
              payload: { mediaType: 'image', url: 'https://x/y.png', caption: 'Cảm ơn {sender}!' },
            },
          ],
        }),
      ]);

      await service.handleLiveEvent(giftEvent());

      expect(dispatched()[0].action.payload.caption).toBe('Cảm ơn Ngọc Hân!');
    });
  });
});
