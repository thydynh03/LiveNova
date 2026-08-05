import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CreditModule } from './modules/credit/credit.module';
import { TtsModule } from './modules/tts/tts.module';
import { RuleModule } from './modules/rule/rule.module';
import { OverlayModule } from './modules/overlay/overlay.module';
import { EventsGateway } from './modules/websocket/events.gateway';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100, // 100 requests per minute
    }]),
    PrismaModule,
    AuthModule,
    UserModule,
    CreditModule,
    TtsModule,
    RuleModule,
    OverlayModule
  ],
  providers: [EventsGateway],
})
export class AppModule {}
