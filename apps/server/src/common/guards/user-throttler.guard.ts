import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

interface RequestWithUser {
  ip?: string;
  user?: { userId?: string; sub?: string; id?: string };
  ips?: string[];
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

/**
 * Rate-limit each account, not each IP address.
 *
 * The default guard buckets by IP, which is wrong at both ends for this
 * product. A viral broadcast drives thousands of requests from the streamer's
 * own dashboard and overlay behind one address, so the streamer whose show is
 * going well is the first person the limiter punishes — it breaks their round
 * at the exact moment it matters. And an abusive account gets a fresh budget
 * simply by moving to another IP, which costs nothing.
 *
 * Keying on the authenticated user fixes both. Anonymous traffic — login,
 * register, the marketing pages — has no user to key on and falls back to IP,
 * which is correct there: those endpoints are exactly where you are defending
 * against someone who does not have an account yet.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: RequestWithUser): Promise<string> {
    // The JWT strategy attaches the user; the field name has varied across
    // strategies in this codebase, so accept any of the three rather than
    // silently falling back to IP for authenticated traffic.
    const userId = req.user?.userId ?? req.user?.sub ?? req.user?.id;
    if (userId) return `user:${userId}`;

    const forwarded = req.headers?.['x-forwarded-for'];
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim();
    return `ip:${first || req.ip || req.socket?.remoteAddress || 'unknown'}`;
  }

  /**
   * Overlay traffic is exempt.
   *
   * An OBS browser source polls and reconnects on its own schedule, and it
   * authenticates with a per-overlay token rather than a session, so it has no
   * user to bucket under. Throttling it would drop the broadcast, and the token
   * already bounds who can reach it.
   */
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ path?: string; url?: string }>();
    const path = req?.path ?? req?.url ?? '';
    return path.startsWith('/overlays/') || path.startsWith('/health');
  }
}
