import { Module } from '@nestjs/common';
import { RuleService } from './rule.service';
import { RuleController } from './rule.controller';

@Module({
  providers: [RuleService],
  controllers: [RuleController],
  exports: [RuleService],
})
export class RuleModule {}
