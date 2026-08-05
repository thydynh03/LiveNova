import { Controller, Get, Post, Query, UseGuards, Req, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreditService } from './credit.service';
import { LedgerReason } from '@prisma/client';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { userId: string };
}

@UseGuards(JwtAuthGuard)
@Controller('credits')
export class CreditController {
  constructor(private readonly creditService: CreditService) {}

  @Get('balance')
  async getBalance(@Req() req: AuthenticatedRequest) {
    return this.creditService.getBalance(req.user.userId);
  }

  @Get('ledger')
  async getLedger(@Req() req: AuthenticatedRequest, @Query('skip') skip = '0', @Query('take') take = '50') {
    return this.creditService.getLedger(req.user.userId, parseInt(skip, 10), parseInt(take, 10));
  }

  @Post('purchase')
  async purchase(@Req() req: AuthenticatedRequest, @Body() body: { amount: number }) {
    // Mock purchase
    return this.creditService.addCredits(req.user.userId, body.amount, LedgerReason.PURCHASE, 'Mock purchase');
  }
}
