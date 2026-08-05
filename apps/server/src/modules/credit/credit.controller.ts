import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { CreditService } from './credit.service';

class LedgerQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number = 50;
}

@UseGuards(JwtAuthGuard)
@Controller('credits')
export class CreditController {
  constructor(private readonly creditService: CreditService) {}

  @Get('balance')
  async getBalance(@CurrentUserId() userId: string) {
    const balance = await this.creditService.getBalance(userId);
    return {
      balance: balance.balance,
      dailyFreeUsed: balance.dailyFreeUsed,
      resetsAt: balance.resetsAt,
    };
  }

  @Get('ledger')
  async getLedger(@CurrentUserId() userId: string, @Query() query: LedgerQueryDto) {
    return this.creditService.getLedger(userId, query.skip ?? 0, query.take ?? 50);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // C-01 — `POST /credits/purchase` has been REMOVED.
  //
  // It called addCredits() straight from a request body with no payment
  // verification, so any authenticated user could mint unlimited credits by
  // posting {"amount": 999999999}.
  //
  // Credits may now only be minted by CreditService.creditFromSettledTransaction(),
  // which requires a settled Transaction row. The route that drives it belongs in
  // a BillingModule behind signature-verified provider webhooks (FR-063) — that
  // module is blocked on Q-02 (Vietnamese legal entity for VNPay/MoMo) and is
  // deliberately not stubbed here.
  // ───────────────────────────────────────────────────────────────────────────
}
