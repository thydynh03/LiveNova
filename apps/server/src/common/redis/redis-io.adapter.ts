import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { ServerOptions, Server } from 'socket.io';
import { RedisService } from './redis.service';

/**
 * Carries room broadcasts between server instances.
 *
 * Without it, `server.to(room).emit(...)` only reaches sockets held by the
 * process that called it. That is the quietest failure in the system: an OBS
 * overlay connects to instance B, the TikTok gift webhook lands on instance A,
 * A broadcasts the new score to a room whose only member lives in B — and the
 * overlay simply never updates again. Nothing throws. Nothing is logged. The
 * streamer sees a frozen scoreboard mid-broadcast and no error anywhere
 * explains it.
 *
 * Falls back to the default in-memory adapter when Redis is not configured,
 * which is correct for a single process and wrong for anything else — hence the
 * production guard in `loadEnv`.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterFactory: ReturnType<typeof createAdapter> | null = null;

  constructor(
    app: INestApplicationContext,
    private readonly redis: RedisService,
  ) {
    super(app);
  }

  /**
   * Must run before the first gateway is created, because `createIOServer` is
   * called during gateway initialisation and needs the factory ready.
   */
  async connect(): Promise<boolean> {
    const pub = this.redis.duplicate();
    const sub = this.redis.duplicate();
    if (!pub || !sub) {
      this.logger.warn(
        'Socket.IO chay adapter trong bo nho — chi dung cho mot instance.',
      );
      return false;
    }

    await Promise.all([
      pub.connect().catch(() => undefined),
      sub.connect().catch(() => undefined),
    ]);
    this.adapterFactory = createAdapter(pub, sub);
    this.logger.log(
      'Socket.IO dung Redis adapter — broadcast di duoc qua nhieu instance.',
    );
    return true;
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server: Server = super.createIOServer(port, options);
    if (this.adapterFactory) {
      server.adapter(this.adapterFactory);
    }
    return server;
  }
}
