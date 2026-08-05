import { Module } from '@nestjs/common';
import { CreditService } from './credit.service';
import { CreditController } from './credit.controller';

@Module({
  providers: [CreditService],
  controllers: [CreditController],
  exports: [CreditService],
})
export class CreditModule {}
