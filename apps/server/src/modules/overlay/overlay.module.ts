import { Module } from '@nestjs/common';
import { OverlayService } from './overlay.service';
import { GoalService } from './goal.service';
import { PkService } from './pk.service';
import { OverlayController, PublicOverlayController } from './overlay.controller';

@Module({
  providers: [OverlayService, GoalService, PkService],
  controllers: [OverlayController, PublicOverlayController],
  exports: [OverlayService, GoalService, PkService],
})
export class OverlayModule {}
