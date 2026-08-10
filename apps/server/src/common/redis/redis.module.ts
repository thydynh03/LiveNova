import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Global because coordination is cross-cutting: the websocket adapter, the
 * battle owner leases and anything added later all need the same connections,
 * and threading the module import through each feature buys nothing.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
