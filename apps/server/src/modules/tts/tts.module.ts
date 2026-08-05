import { Module } from '@nestjs/common';
import { TtsService } from './tts.service';
import { CreditModule } from '../credit/credit.module';

@Module({
  imports: [CreditModule],
  providers: [TtsService],
  exports: [TtsService],
})
export class TtsModule {}
