import { Module } from '@nestjs/common';
import { OverlayService } from './overlay.service';
import { GoalService } from './goal.service';
import { OverlayController, PublicOverlayController } from './overlay.controller';

@Module({
  providers: [OverlayService, GoalService],
  controllers: [OverlayController, PublicOverlayController],
  exports: [OverlayService, GoalService],
})
export class OverlayModule {}
