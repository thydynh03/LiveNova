import { Module } from '@nestjs/common';
import { RuleService } from './rule.service';
import { RuleEngineService } from './rule-engine.service';
import { RuleController } from './rule.controller';
import { TtsModule } from '../tts/tts.module';

@Module({
  // The engine synthesises TTS_READ actions before dispatching them, so the
  // overlay never has to hold a credential to reach the metered endpoint.
  imports: [TtsModule],
  providers: [RuleService, RuleEngineService],
  controllers: [RuleController],
  exports: [RuleService, RuleEngineService],
})
export class RuleModule {}
