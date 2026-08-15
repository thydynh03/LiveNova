import { Module } from '@nestjs/common';
import { OverlayService } from './overlay.service';
import { GoalService } from './goal.service';
import { PkService } from './pk.service';
import { DiscoSyncService } from './disco-sync.service';
import { OverlayController, PublicOverlayController } from './overlay.controller';

@Module({
  providers: [OverlayService, GoalService, PkService, DiscoSyncService],
  controllers: [OverlayController, PublicOverlayController],
  exports: [OverlayService, GoalService, PkService, DiscoSyncService],
})
export class OverlayModule {}
