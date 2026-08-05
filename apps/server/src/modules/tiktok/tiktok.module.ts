import { Module } from '@nestjs/common';
import { TiktokService } from './tiktok.service';
import { TiktokController } from './tiktok.controller';
import { ChannelModule } from '../channel/channel.module';

@Module({
  // H-10 — EventEmitterModule.forRoot() is registered once in AppModule; importing
  // the bare module here would not provide EventEmitter2 and injection would fail.
  imports: [ChannelModule],
  controllers: [TiktokController],
  providers: [TiktokService],
  exports: [TiktokService],
})
export class TiktokModule {}
