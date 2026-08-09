import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisModule } from './common/redis/redis.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ChannelModule } from './modules/channel/channel.module';
import { CreditModule } from './modules/credit/credit.module';
import { TtsModule } from './modules/tts/tts.module';
import { RuleModule } from './modules/rule/rule.module';
import { OverlayModule } from './modules/overlay/overlay.module';
import { TiktokModule } from './modules/tiktok/tiktok.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { UploadModule } from './modules/upload/upload.module';
import { AdminModule } from './modules/admin/admin.module';
import { TemplateModule } from './modules/template/template.module';
import { BattleModule } from './modules/battle/battle.module';

@Module({
  imports: [
    // Two buckets, both keyed on the account rather than the IP.
    //
    // `short` stops a burst — a stuck retry loop or a script hammering an
    // endpoint — without waiting a minute to notice. `long` is the sustained
    // ceiling. A single limit cannot do both: set it low enough to catch a
    // burst and normal dashboard use trips it; set it high enough for normal
    // use and a burst runs free for a full minute.
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 20 },
      { name: 'long', ttl: 60_000, limit: 300 },
    ]),
    // H-10 — forRoot() registers EventEmitter2 globally. TiktokService injects it,
    // and EventsGateway consumes `live.any` from it.
    EventEmitterModule.forRoot({ wildcard: false, maxListeners: 20 }),
    PrismaModule,
    // Global: the websocket adapter and the battle owner leases both need the
    // same connections, and it must be constructed before any gateway.
    RedisModule,
    MetricsModule,
    AuthModule,
    UserModule,
    ChannelModule,
    CreditModule,
    TtsModule,
    RuleModule,
    OverlayModule,
    TiktokModule,
    WebsocketModule,
    UploadModule,
    AdminModule,
    TemplateModule,
    BattleModule,
  ],
  providers: [
    {
      // H-01 — ThrottlerModule.forRoot() on its own does nothing. Without this
      // guard registration there was no rate limiting anywhere in the app.
      provide: APP_GUARD,
      // Keyed on userId, not IP. See the guard for why IP is the wrong bucket
      // at both ends here.
      useClass: UserThrottlerGuard,
    },
  ],
})
export class AppModule {}
