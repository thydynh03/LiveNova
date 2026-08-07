import { Module, forwardRef } from '@nestjs/common';
import { TiktokService } from './tiktok.service';
import { TiktokController } from './tiktok.controller';
import { ChannelModule } from '../channel/channel.module';

@Module({
  imports: [forwardRef(() => ChannelModule)],
  controllers: [TiktokController],
  providers: [TiktokService],
  exports: [TiktokService],
})
export class TiktokModule {}
