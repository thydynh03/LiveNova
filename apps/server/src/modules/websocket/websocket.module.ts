import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';
import { OverlayGateway } from './overlay.gateway';
import { ChannelModule } from '../channel/channel.module';
import { OverlayModule } from '../overlay/overlay.module';
import { loadEnv } from '../../common/config/env';

@Module({
  imports: [
    ChannelModule,
    OverlayModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const env = loadEnv();
        return { secret: env.jwtSecret, signOptions: { expiresIn: env.accessTokenTtl } };
      },
    }),
  ],
  providers: [EventsGateway, OverlayGateway],
  exports: [EventsGateway, OverlayGateway],
})
export class WebsocketModule {}
