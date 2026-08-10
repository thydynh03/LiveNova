import { Module } from '@nestjs/common';
import { BattleService } from './battle.service';
import { BattleCoordinatorService } from './battle-coordinator.service';
import { BattleController } from './battle.controller';

@Module({
  controllers: [BattleController],
  providers: [BattleService, BattleCoordinatorService],
  exports: [BattleService],
})
export class BattleModule {}
