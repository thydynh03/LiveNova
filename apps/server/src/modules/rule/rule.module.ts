import { Module } from '@nestjs/common';
import { RuleService } from './rule.service';
import { RuleEngineService } from './rule-engine.service';
import { RuleController } from './rule.controller';

@Module({
  providers: [RuleService, RuleEngineService],
  controllers: [RuleController],
  exports: [RuleService, RuleEngineService],
})
export class RuleModule {}
