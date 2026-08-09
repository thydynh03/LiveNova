import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { loadEnv } from '../config/env';

/**
 * The one place that owns Redis connections.
 *
 * Optional on purpose. A solo streamer running a single process needs no
 * coordination, and `REDIS_URL` unset is a supported configuration — every
 * caller here degrades to "I am the only instance", which is exactly true.
 *
 * Three connections rather than one, because ioredis puts a connection into
 * subscriber mode permanently once it subscribes: it will refuse ordinary
 * commands afterwards. The Socket.IO adapter needs its own matched pair for the
 * same reason.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private ready = false;

  private readonly handlers = new Map<string, Set<(payload: string) => void>>();

  onModuleInit(): void {
    const { redisUrl, instanceId } = loadEnv();
    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL khong duoc dat — chay che do mot instance. ' +
          'Dung chay hai tien trinh voi cau hinh nay.',
      );
      return;
    }

    // `lazyConnect: false` and a bounded retry: a Redis that is briefly
    // unreachable should not take the API down with it, because every path that
    // uses Redis here has a single-instance fallback that is still correct for
    // one process.
    const options = {
      maxRetriesPerRequest: 2,
      retryStrategy: (times: number) => Math.min(times * 200, 3000),
      enableOfflineQueue: false,
    };

    this.client = new Redis(redisUrl, options);
    this.subscriber = new Redis(redisUrl, options);

    this.client.on('ready', () => {
      this.ready = true;
      this.logger.log(`Redis san sang (instance ${instanceId})`);
    });
    this.client.on('error', (err: Error) => {
      this.ready = false;
      this.logger.error(`Redis loi: ${err.message}`);
    });
    this.client.on('end', () => {
      this.ready = false;
    });

    this.subscriber.on('message', (channel: string, payload: string) => {
      const set = this.handlers.get(channel);
      if (!set) return;
      for (const fn of set) {
        try {
          fn(payload);
        } catch (err) {
          // One bad handler must not stop the others on the same channel.
          this.logger.error(
            `Handler kenh ${channel} loi: ${(err as Error).message}`,
          );
        }
      }
    });
    this.subscriber.on('error', (err: Error) => {
      this.logger.error(`Redis subscriber loi: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.client?.quit(), this.subscriber?.quit()]);
    this.client = null;
    this.subscriber = null;
    this.ready = false;
  }

  /**
   * Whether coordination is available right now.
   *
   * Deliberately not "is Redis configured": a configured but currently
   * unreachable Redis has to read as unavailable, or callers will wait on
   * commands that cannot complete.
   */
  isAvailable(): boolean {
    return this.ready && this.client !== null;
  }

  /**
   * A fresh connection for something that manages its own lifecycle, such as
   * the Socket.IO adapter's publisher/subscriber pair.
   */
  duplicate(): Redis | null {
    return this.client ? this.client.duplicate() : null;
  }

  /**
   * Take or extend a lease.
   *
   * `SET key owner NX PX` for a first claim; the extension is a Lua script so
   * that checking the owner and pushing the expiry cannot be split by another
   * instance sneaking in between — the read-then-write version of this has a
   * window where two instances both believe they hold the lease.
   */
  async acquireLease(
    key: string,
    owner: string,
    ttlMs: number,
  ): Promise<boolean> {
    if (!this.isAvailable() || !this.client) return false;
    try {
      const taken = await this.client.set(key, owner, 'PX', ttlMs, 'NX');
      if (taken === 'OK') return true;

      const extended = await this.client.eval(
        `if redis.call('get', KEYS[1]) == ARGV[1] then
           return redis.call('pexpire', KEYS[1], ARGV[2])
         else
           return 0
         end`,
        1,
        key,
        owner,
        ttlMs,
      );
      return extended === 1;
    } catch (err) {
      this.logger.warn(
        `Khong lay duoc lease ${key}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /** Release only if still ours — never drop a lease another instance now holds. */
  async releaseLease(key: string, owner: string): Promise<void> {
    if (!this.isAvailable() || !this.client) return;
    try {
      await this.client.eval(
        `if redis.call('get', KEYS[1]) == ARGV[1] then
           return redis.call('del', KEYS[1])
         else
           return 0
         end`,
        1,
        key,
        owner,
      );
    } catch (err) {
      this.logger.warn(
        `Khong tra duoc lease ${key}: ${(err as Error).message}`,
      );
    }
  }

  async publish(channel: string, payload: string): Promise<void> {
    if (!this.isAvailable() || !this.client) return;
    try {
      await this.client.publish(channel, payload);
    } catch (err) {
      this.logger.warn(
        `Khong publish duoc ${channel}: ${(err as Error).message}`,
      );
    }
  }

  async subscribe(
    channel: string,
    handler: (payload: string) => void,
  ): Promise<void> {
    if (!this.subscriber) return;
    const existing = this.handlers.get(channel);
    if (existing) {
      existing.add(handler);
      return;
    }
    this.handlers.set(channel, new Set([handler]));
    try {
      await this.subscriber.subscribe(channel);
    } catch (err) {
      this.logger.error(
        `Khong subscribe duoc ${channel}: ${(err as Error).message}`,
      );
    }
  }
}
