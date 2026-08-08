import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { CreditModule } from '../credit/credit.module';

@Module({
  // Credit adjustments go through CreditService so they land in the ledger with
  // LedgerReason.ADMIN_ADJUST rather than writing CreditBalance directly.
  imports: [CreditModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
