import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';
import { ChannelModule } from '../channel/channel.module';
import { loadEnv } from '../../common/config/env';

@Module({
  imports: [
    ChannelModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const env = loadEnv();
        return { secret: env.jwtSecret, signOptions: { expiresIn: env.accessTokenTtl } };
      },
    }),
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class WebsocketModule {}
