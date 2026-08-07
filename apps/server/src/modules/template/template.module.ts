import { Module } from '@nestjs/common';
import { TemplateService } from './template.service';
import { AdminTemplateController, TemplateController } from './template.controller';
import { RuleModule } from '../rule/rule.module';

@Module({
  // Applying a RULE_PACK materialises real rules, which is what the old
  // hard-coded applyPreset did.
  imports: [RuleModule],
  providers: [TemplateService],
  controllers: [AdminTemplateController, TemplateController],
  exports: [TemplateService],
})
export class TemplateModule {}
