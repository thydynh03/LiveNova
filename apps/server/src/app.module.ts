import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
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

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    // H-10 — forRoot() registers EventEmitter2 globally. TiktokService injects it,
    // and EventsGateway consumes `live.any` from it.
    EventEmitterModule.forRoot({ wildcard: false, maxListeners: 20 }),
    PrismaModule,
    AuthModule,
    UserModule,
    ChannelModule,
    CreditModule,
    TtsModule,
    RuleModule,
    OverlayModule,
    // H-10 — TiktokModule was missing from this list, so tiktok.service.ts and its
    // controller were dead code: no routes registered, no ingest running. Build
    // and lint stayed green, which is why it went unnoticed.
    TiktokModule,
    WebsocketModule,
  ],
  providers: [
    {
      // H-01 — ThrottlerModule.forRoot() on its own does nothing. Without this
      // guard registration there was no rate limiting anywhere in the app.
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
