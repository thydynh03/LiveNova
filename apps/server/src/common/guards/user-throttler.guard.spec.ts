import { UserThrottlerGuard } from './user-throttler.guard';
import type { ExecutionContext } from '@nestjs/common';

/** Only `getTracker` and `shouldSkip` are under test; the base guard is Nest's. */
const guard = Object.create(UserThrottlerGuard.prototype) as UserThrottlerGuard & {
  getTracker(req: unknown): Promise<string>;
  shouldSkip(ctx: ExecutionContext): Promise<boolean>;
};

const ctxFor = (path: string) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ path }) }) }) as unknown as ExecutionContext;

describe('UserThrottlerGuard', () => {
  it('buckets an authenticated request by account, not by address', async () => {
    // The default IP bucket punishes the streamer whose show is going well:
    // their dashboard and overlay share one address, so a viral round trips
    // the limit and breaks itself.
    const a = await guard.getTracker({ ip: '1.2.3.4', user: { userId: 'u1' } });
    const b = await guard.getTracker({ ip: '9.9.9.9', user: { userId: 'u1' } });

    expect(a).toBe('user:u1');
    expect(b).toBe(a);
  });

  it('accepts any of the shapes the JWT strategy has used for the id', async () => {
    // Silently falling through to IP for authenticated traffic would undo the
    // whole guard, and nothing would fail loudly enough to notice.
    expect(await guard.getTracker({ user: { sub: 'u2' } })).toBe('user:u2');
    expect(await guard.getTracker({ user: { id: 'u3' } })).toBe('user:u3');
  });

  it('falls back to the address for anonymous traffic', async () => {
    // Correct here: login and register are exactly where you are defending
    // against somebody who does not have an account yet.
    expect(await guard.getTracker({ ip: '1.2.3.4' })).toBe('ip:1.2.3.4');
  });

  it('reads the client address from x-forwarded-for behind a proxy', async () => {
    const t = await guard.getTracker({
      ip: '10.0.0.1',
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    });

    // Bucketing every anonymous request under the load balancer's own address
    // would rate-limit the whole world as one client.
    expect(t).toBe('ip:203.0.113.7');
  });

  it('never throttles overlay traffic', async () => {
    // An OBS browser source reconnects on its own schedule and authenticates
    // with a token, not a session. Throttling it drops the broadcast.
    expect(await guard.shouldSkip(ctxFor('/overlays/battle'))).toBe(true);
    expect(await guard.shouldSkip(ctxFor('/battle/simulate'))).toBe(false);
  });
});
