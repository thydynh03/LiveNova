import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TiktokService } from './tiktok.service';
import { TiktokController } from './tiktok.controller';

@Module({
  imports: [EventEmitterModule],
  controllers: [TiktokController],
  providers: [TiktokService],
  exports: [TiktokService],
})
export class TiktokModule {}
