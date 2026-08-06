import { EventEmitter2 } from '@nestjs/event-emitter';
import { LiveEventType } from '@livenova/shared';

/**
 * A stand-in for the webcast client.
 *
 * `connect()` is deliberately deferrable so a test can hold the handshake open
 * and drive the race the real service has to survive.
 */
class FakeLive {
  static instances: FakeLive[] = [];

  readonly handlers = new Map<string, (...args: unknown[]) => void>();
  disconnected = false;
  listenersRemoved = false;
  roomId = 'room-1';

  private resolveConnect?: () => void;
  private rejectConnect?: (err: Error) => void;

  constructor(readonly options: { uniqueId: string; apiKey: string }) {
    FakeLive.instances.push(this);
  }

  on(event: string, handler: (...args: unknown[]) => void): this {
    this.handlers.set(event, handler);
    return this;
  }

  removeAllListeners(): this {
    this.listenersRemoved = true;
    this.handlers.clear();
    return this;
  }

  connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.resolveConnect = resolve;
      this.rejectConnect = reject;
    });
  }

  settle(): void {
    this.resolveConnect?.();
  }

  fail(message: string): void {
    this.rejectConnect?.(new Error(message));
  }

  disconnect(): void {
    this.disconnected = true;
  }

  fire(event: string, ...args: unknown[]): void {
    this.handlers.get(event)?.(...args);
  }
}

jest.mock('@tiktool/live', () => ({
  TikTokLive: jest.fn().mockImplementation((options) => new FakeLive(options)),
}));

// jest.mock is hoisted above the imports, so the service picks up the fake.
import { TiktokService } from './tiktok.service';

/** Lets the pending connect promise settle before assertions run. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('TiktokService', () => {
  let emitter: EventEmitter2;
  let emit: jest.SpyInstance;
  let service: TiktokService;

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setImmediate'] });
    FakeLive.instances = [];
    process.env.TIKTOOL_API_KEY = 'test-key';

    emitter = new EventEmitter2();
    emit = jest.spyOn(emitter, 'emit');
    service = new TiktokService(emitter);
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.TIKTOOL_API_KEY;
  });

  async function connectOne(): Promise<FakeLive> {
    const pending = service.connect('chan-1', '@ngochan');
    const live = FakeLive.instances[0];
    live.settle();
    await pending;
    return live;
  }

  it('strips a leading @ from the handle', async () => {
    await connectOne();
    expect(FakeLive.instances[0].options.uniqueId).toBe('ngochan');
  });

  it('does not open a second socket while the first handshake is in flight', async () => {
    // The session is only registered after the handshake resolves, so without
    // an explicit in-flight guard the second call sees an empty session map and
    // opens a socket nothing holds a handle to.
    const first = service.connect('chan-1', 'ngochan');
    const second = service.connect('chan-1', 'ngochan');

    expect(FakeLive.instances).toHaveLength(1);

    FakeLive.instances[0].settle();
    await Promise.all([first, second]);
    expect(FakeLive.instances).toHaveLength(1);
  });

  it('closes a socket whose handshake finished after an explicit disconnect', async () => {
    const pending = service.connect('chan-1', 'ngochan');
    service.disconnect('chan-1');

    FakeLive.instances[0].settle();
    await pending;

    expect(FakeLive.instances[0].disconnected).toBe(true);
    expect(service.isConnected('chan-1')).toBe(false);
  });

  it('does not reconnect after the operator disconnects on purpose', async () => {
    const live = await connectOne();

    // A deliberate close is indistinguishable from a dropped one at the socket,
    // so the close frame is delivered *before* the handle is torn down — which
    // is the ordering a real websocket produces.
    const onDisconnected = live.handlers.get('disconnected');
    service.disconnect('chan-1');
    onDisconnected?.(1000, 'client closed');

    jest.advanceTimersByTime(60_000);
    await flush();

    expect(FakeLive.instances).toHaveLength(1);
  });

  it('reconnects with backoff after an unexpected drop', async () => {
    const live = await connectOne();

    live.fire('disconnected', 1006, 'abnormal closure');
    expect(FakeLive.instances).toHaveLength(1);

    jest.advanceTimersByTime(2_000);
    expect(FakeLive.instances).toHaveLength(2);
  });

  it('gives up after five consecutive failures', async () => {
    // First attempt, then five scheduled retries, each failing its handshake.
    const first = service.connect('chan-1', 'ngochan');
    FakeLive.instances[0].fail('handshake refused');
    await first;

    for (let i = 0; i < 5; i += 1) {
      jest.advanceTimersByTime(60_000);
      await flush();
      const latest = FakeLive.instances[FakeLive.instances.length - 1];
      latest.fail('handshake refused');
      await flush();
    }

    // 1 initial + 5 retries. A sixth would mean the cap is not enforced.
    expect(FakeLive.instances).toHaveLength(6);

    jest.advanceTimersByTime(60_000);
    await flush();
    expect(FakeLive.instances).toHaveLength(6);
  });

  it('stops the reconnect ladder on shutdown', async () => {
    const live = await connectOne();
    live.fire('disconnected', 1006, 'abnormal closure');

    // A retry is now pending; shutdown must cancel it.
    service.onModuleDestroy();
    jest.advanceTimersByTime(60_000);

    expect(FakeLive.instances).toHaveLength(1);
  });

  it('refuses to connect without an API key', async () => {
    delete process.env.TIKTOOL_API_KEY;
    await service.connect('chan-1', 'ngochan');
    expect(FakeLive.instances).toHaveLength(0);
  });

  describe('event mapping', () => {
    let live: FakeLive;

    beforeEach(async () => {
      live = await connectOne();
      emit.mockClear();
    });

    function lastEvent() {
      const call = emit.mock.calls.find((c) => c[0] === 'live.any');
      return call?.[1];
    }

    it('maps a chat message to a COMMENT event', () => {
      live.fire('chat', {
        user: { nickname: 'Ngọc Hân', uniqueId: 'ngochan' },
        comment: 'đọc tên em với',
        timestamp: 1_700_000_000_000,
      });

      expect(lastEvent()).toMatchObject({
        type: LiveEventType.COMMENT,
        senderDisplayName: 'Ngọc Hân',
        senderUsername: 'ngochan',
        content: 'đọc tên em với',
      });
    });

    it('ignores the intermediate frames of a gift streak', () => {
      live.fire('gift', {
        user: { nickname: 'Tuấn Kiệt' },
        giftName: 'Hoa hồng',
        giftType: 1,
        repeatEnd: false,
        repeatCount: 3,
        diamondCount: 1,
        timestamp: 1_700_000_000_000,
      });

      expect(lastEvent()).toBeUndefined();
    });

    it('multiplies the unit value by the streak on the closing frame', () => {
      live.fire('gift', {
        user: { nickname: 'Tuấn Kiệt' },
        giftName: 'Hoa hồng',
        giftType: 1,
        repeatEnd: true,
        repeatCount: 10,
        diamondCount: 5,
        timestamp: 1_700_000_000_000,
      });

      // 10 roses at 5 diamonds each is 50, not 5 and not 10.
      expect(lastEvent()).toMatchObject({ giftCoinValue: 50, giftName: 'Hoa hồng' });
    });

    it('separates follow from share on the social channel', () => {
      live.fire('social', { user: { nickname: 'Minh Quân' }, action: 'follow' });
      expect(lastEvent()).toMatchObject({ type: LiveEventType.FOLLOW });

      emit.mockClear();
      live.fire('social', { user: { nickname: 'Minh Quân' }, action: 'share' });
      expect(lastEvent()).toMatchObject({ type: LiveEventType.SHARE });
    });

    it.each([
      ['missing', 0],
      // Some frames carry seconds rather than milliseconds; taken literally
      // that dates the event to 1970 and sorts the whole feed wrong.
      ['seconds-scale', 1_700_000_000],
    ])('falls back to now on a %s timestamp', (_label, timestamp) => {
      live.fire('like', { user: { nickname: 'Bảo Trâm' }, likeCount: 5, timestamp });

      const occurredAt = lastEvent().occurredAt as Date;
      expect(occurredAt.getFullYear()).toBeGreaterThan(2000);
    });

    it('emits both the typed and the catch-all channel', () => {
      live.fire('member', { user: { nickname: 'Khách' }, timestamp: 1_700_000_000_000 });

      const names = emit.mock.calls.map((c) => c[0]);
      expect(names).toContain(`live.${LiveEventType.JOIN}`);
      expect(names).toContain('live.any');
    });
  });
});
