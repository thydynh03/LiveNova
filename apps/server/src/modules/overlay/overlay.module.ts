import { Module } from '@nestjs/common';
import { OverlayService } from './overlay.service';
import { OverlayController, PublicOverlayController } from './overlay.controller';

@Module({
  providers: [OverlayService],
  controllers: [OverlayController, PublicOverlayController],
  exports: [OverlayService],
})
export class OverlayModule {}
