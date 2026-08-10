import { BattleCoordinatorService } from './battle-coordinator.service';
import { RedisService } from '../../common/redis/redis.service';
import { resetEnvCache } from '../../common/config/env';

/**
 * A stand-in for Redis that two coordinators can share, so a test can play the
 * part of two server instances competing for the same battle.
 */
class FakeRedis {
  available = true;
  private readonly leases = new Map<string, string>();
  private readonly subscribers = new Map<string, Set<(payload: string) => void>>();

  isAvailable() {
    return this.available;
  }

  async acquireLease(key: string, owner: string) {
    const held = this.leases.get(key);
    if (held === undefined || held === owner) {
      this.leases.set(key, owner);
      return true;
    }
    return false;
  }

  async releaseLease(key: string, owner: string) {
    if (this.leases.get(key) === owner) this.leases.delete(key);
  }

  async subscribe(channel: string, handler: (payload: string) => void) {
    const set = this.subscribers.get(channel) ?? new Set();
    set.add(handler);
    this.subscribers.set(channel, set);
  }

  async publish(channel: string, payload: string) {
    // Delivered asynchronously, like the real thing — a handler must never be
    // able to rely on being called before publish() returns.
    const set = this.subscribers.get(channel);
    if (!set) return;
    for (const fn of [...set]) setImmediate(() => fn(payload));
  }

  /** Simulate the owning instance dying without releasing. */
  expire(key: string) {
    this.leases.delete(key);
  }

  as(): RedisService {
    return this as unknown as RedisService;
  }
}

const settle = () => new Promise((r) => setTimeout(r, 10));

describe('BattleCoordinatorService', () => {
  let redis: FakeRedis;

  beforeEach(() => {
    resetEnvCache();
    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.JWT_REFRESH_SECRET = 'y'.repeat(40);
    redis = new FakeRedis();
  });

  const makeInstance = async (id: string) => {
    process.env.INSTANCE_ID = id;
    resetEnvCache();
    const svc = new BattleCoordinatorService(redis.as());
    await svc.onModuleInit();
    return svc;
  };

  it('gives a battle to exactly one instance', async () => {
    const a = await makeInstance('a');
    const b = await makeInstance('b');

    expect(await a.claim('user_1')).toBe(true);
    // The whole point: the second instance is told no, so it never starts a
    // second copy of the same round.
    expect(await b.claim('user_1')).toBe(false);

    expect(a.isOwner('user_1')).toBe(true);
    expect(b.isOwner('user_1')).toBe(false);

    await a.onModuleDestroy();
    await b.onModuleDestroy();
  });

  it('claims everything when Redis is absent, because there is no peer', async () => {
    redis.available = false;
    const solo = await makeInstance('solo');

    expect(await solo.claim('user_1')).toBe(true);
    expect(solo.isOwner('user_anything')).toBe(true);

    await solo.onModuleDestroy();
  });

  it('runs a forwarded mutation on the owner and returns its result', async () => {
    const owner = await makeInstance('owner');
    const other = await makeInstance('other');

    await owner.claim('user_1');
    const handler = jest.fn().mockResolvedValue({ score: 42 });
    owner.registerHandler(handler);

    const result = await other.forward('user_1', 'simulate', { gift: 'Rose' });

    expect(handler).toHaveBeenCalledWith('simulate', 'user_1', { gift: 'Rose' });
    expect(result).toEqual({ score: 42 });

    await owner.onModuleDestroy();
    await other.onModuleDestroy();
  });

  it('does not run a forwarded mutation on an instance that does not own it', async () => {
    const owner = await makeInstance('owner');
    const other = await makeInstance('other');

    await owner.claim('user_1');
    const otherHandler = jest.fn();
    other.registerHandler(otherHandler);
    owner.registerHandler(jest.fn().mockResolvedValue('ok'));

    await owner.forward('user_2', 'simulate', {}).catch(() => undefined);
    await settle();

    // `user_2` is owned by nobody, so nothing should have executed anywhere.
    expect(otherHandler).not.toHaveBeenCalled();

    await owner.onModuleDestroy();
    await other.onModuleDestroy();
  });

  it('surfaces an error thrown by the owner rather than swallowing it', async () => {
    const owner = await makeInstance('owner');
    const other = await makeInstance('other');

    await owner.claim('user_1');
    owner.registerHandler(jest.fn().mockRejectedValue(new Error('tran da ket thuc')));

    await expect(other.forward('user_1', 'simulate', {})).rejects.toThrow('tran da ket thuc');

    await owner.onModuleDestroy();
    await other.onModuleDestroy();
  });

  it('stops claiming ownership once the lease is lost', async () => {
    const a = await makeInstance('a');
    const b = await makeInstance('b');

    await a.claim('user_1');
    expect(a.isOwner('user_1')).toBe(true);

    // A stalled process: its lease expires and another instance takes over
    // while it still believes it is the owner.
    redis.expire('battle:owner:user_1');
    await b.claim('user_1');

    await a['renewAll']();

    // It must find out on the next renew, or it keeps ticking the clock and
    // flushing stale scores over the new owner's live ones.
    expect(a.isOwner('user_1')).toBe(false);
    expect(b.isOwner('user_1')).toBe(true);

    await a.onModuleDestroy();
    await b.onModuleDestroy();
  });

  it('hands battles back on shutdown instead of making the next owner wait', async () => {
    const a = await makeInstance('a');
    const b = await makeInstance('b');

    await a.claim('user_1');
    expect(await b.claim('user_1')).toBe(false);

    await a.onModuleDestroy();

    // A rolling deploy otherwise freezes every live round for the lease TTL.
    expect(await b.claim('user_1')).toBe(true);

    await b.onModuleDestroy();
  });
});
