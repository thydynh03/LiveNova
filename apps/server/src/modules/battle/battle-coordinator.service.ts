import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../../common/redis/redis.service';
import { loadEnv } from '../../common/config/env';

/**
 * Which instance is allowed to run a battle.
 *
 * A live battle is a piece of mutable state with a one-second clock on it. Two
 * processes holding their own copy is not a cache-coherency problem that
 * eventually settles — it is two different games. Both refill energy every
 * second, so the rate doubles. Both flush to Postgres every two seconds, so
 * each overwrites the other's score with its own. Both can decide the round is
 * over and write a FINISHED row, potentially naming different winners.
 *
 * So exactly one instance owns a battle at a time, held as a Redis lease. The
 * others do not run its clock and do not write its scores; they hand mutations
 * to the owner and use its answer.
 *
 * With no Redis configured every method reports "yes, I own it", which is the
 * truth for a single process and keeps the whole mechanism out of the way of a
 * solo streamer.
 */

const LEASE_PREFIX = 'battle:owner:';
/**
 * Long enough to survive a GC pause or a slow flush, short enough that a
 * crashed instance's battles are claimable before the audience notices. The
 * renew interval is a third of it, so two consecutive renew failures still
 * leave a margin.
 */
const LEASE_TTL_MS = 15_000;
const RENEW_INTERVAL_MS = 5_000;

const RPC_CHANNEL = 'battle:rpc';
const RPC_REPLY_CHANNEL = 'battle:rpc:reply';
/**
 * A forwarded call has to beat the caller's own HTTP timeout, and the owner
 * only has to do an in-memory mutation. Two seconds is generous; past that the
 * owner is unhealthy and the caller is better off answering from the database
 * than hanging.
 */
const RPC_TIMEOUT_MS = 2_000;

interface RpcRequest {
  id: string;
  from: string;
  userId: string;
  op: string;
  payload: unknown;
}

interface RpcReply {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

type Handler = (
  op: string,
  userId: string,
  payload: unknown,
) => Promise<unknown>;

@Injectable()
export class BattleCoordinatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BattleCoordinatorService.name);
  private readonly instanceId = loadEnv().instanceId;

  /** Battles this instance currently holds a lease on. */
  private readonly owned = new Set<string>();

  private readonly pending = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (err: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();

  private handler: Handler | null = null;
  private renewTimer: NodeJS.Timeout | null = null;

  constructor(private readonly redis: RedisService) {}

  async onModuleInit(): Promise<void> {
    this.renewTimer = setInterval(
      () => void this.renewAll(),
      RENEW_INTERVAL_MS,
    );
    this.renewTimer.unref?.();

    await this.redis.subscribe(RPC_CHANNEL, (raw) => void this.onRequest(raw));
    await this.redis.subscribe(RPC_REPLY_CHANNEL, (raw) => this.onReply(raw));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.renewTimer) clearInterval(this.renewTimer);
    for (const { timer, reject } of this.pending.values()) {
      clearTimeout(timer);
      reject(new Error('shutting down'));
    }
    this.pending.clear();

    // Hand the battles back rather than making the next owner wait out the TTL.
    // A rolling deploy otherwise leaves every live round frozen for fifteen
    // seconds, which on a busy broadcast is the difference between a hiccup and
    // a visible outage.
    await Promise.allSettled(
      [...this.owned].map((userId) =>
        this.redis.releaseLease(LEASE_PREFIX + userId, this.instanceId),
      ),
    );
    this.owned.clear();
  }

  /** Called by BattleService to execute a forwarded mutation locally. */
  registerHandler(handler: Handler): void {
    this.handler = handler;
  }

  /** Single-instance mode: there is nobody to coordinate with. */
  private get standalone(): boolean {
    return !this.redis.isAvailable();
  }

  isOwner(userId: string): boolean {
    return this.standalone || this.owned.has(userId);
  }

  /**
   * Try to become the owner.
   *
   * Returns false when someone else holds it, and the caller must then forward
   * rather than proceed. Never blocks: an API request should not wait on a
   * lease that may be held for the length of a broadcast.
   */
  async claim(userId: string): Promise<boolean> {
    if (this.standalone) return true;

    const won = await this.redis.acquireLease(
      LEASE_PREFIX + userId,
      this.instanceId,
      LEASE_TTL_MS,
    );
    if (won) this.owned.add(userId);
    else this.owned.delete(userId);
    return won;
  }

  async release(userId: string): Promise<void> {
    this.owned.delete(userId);
    if (!this.standalone) {
      await this.redis.releaseLease(LEASE_PREFIX + userId, this.instanceId);
    }
  }

  /** Every battle this instance may currently tick and flush. */
  ownedBattles(): string[] {
    return [...this.owned];
  }

  /**
   * Ask the owning instance to perform a mutation and return its result.
   *
   * Throws on timeout. The caller decides what a timeout means — usually
   * "answer from the database", because a stale score is better than a hung
   * request.
   */
  async forward(
    userId: string,
    op: string,
    payload: unknown,
  ): Promise<unknown> {
    if (this.standalone) throw new Error('no peer to forward to');

    const id = randomUUID();
    const request: RpcRequest = {
      id,
      from: this.instanceId,
      userId,
      op,
      payload,
    };

    const waiter = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`forward ${op} timed out after ${RPC_TIMEOUT_MS}ms`));
      }, RPC_TIMEOUT_MS);
      timer.unref?.();
      this.pending.set(id, { resolve, reject, timer });
    });

    await this.redis.publish(RPC_CHANNEL, JSON.stringify(request));
    return waiter;
  }

  private async renewAll(): Promise<void> {
    if (this.standalone) return;

    for (const userId of [...this.owned]) {
      const held = await this.redis.acquireLease(
        LEASE_PREFIX + userId,
        this.instanceId,
        LEASE_TTL_MS,
      );
      if (!held) {
        // Lost it — most likely this process stalled long enough for the lease
        // to expire and another instance to take over. Stop ticking and stop
        // flushing immediately; continuing would write our stale scores over
        // the new owner's live ones.
        this.owned.delete(userId);
        this.logger.warn(
          `Mat quyen so huu tran cua user ${userId} — dung tick va flush.`,
        );
      }
    }
  }

  private async onRequest(raw: string): Promise<void> {
    let request: RpcRequest;
    try {
      request = JSON.parse(raw) as RpcRequest;
    } catch {
      return;
    }

    // Everyone sees every request on the shared channel; only the owner acts.
    if (request.from === this.instanceId) return;
    if (!this.owned.has(request.userId) || !this.handler) return;

    const reply: RpcReply = { id: request.id, ok: true };
    try {
      reply.result = await this.handler(
        request.op,
        request.userId,
        request.payload,
      );
    } catch (err) {
      reply.ok = false;
      reply.error = err instanceof Error ? err.message : String(err);
    }
    await this.redis.publish(RPC_REPLY_CHANNEL, JSON.stringify(reply));
  }

  private onReply(raw: string): void {
    let reply: RpcReply;
    try {
      reply = JSON.parse(raw) as RpcReply;
    } catch {
      return;
    }

    const waiter = this.pending.get(reply.id);
    if (!waiter) return;
    this.pending.delete(reply.id);
    clearTimeout(waiter.timer);

    if (reply.ok) waiter.resolve(reply.result);
    else waiter.reject(new Error(reply.error ?? 'forwarded call failed'));
  }
}
