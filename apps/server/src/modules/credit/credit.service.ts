import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerReason } from '@prisma/client';

@Injectable()
export class CreditService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string) {
    let balance = await this.prisma.creditBalance.findUnique({ where: { userId } });
    if (!balance) {
      balance = await this.prisma.creditBalance.create({ data: { userId, balance: 0, version: 0n } });
    }
    return balance;
  }

  async deductCredits(userId: string, amount: number, reason: LedgerReason, description?: string) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');
    
    // Optimistic Locking implementation
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.creditBalance.findUnique({ where: { userId } });
      if (!current || current.balance < amount) {
        throw new BadRequestException('Insufficient credits');
      }

      const updated = await tx.creditBalance.updateMany({
        where: { userId, version: current.version },
        data: {
          balance: { decrement: amount },
          version: { increment: 1n },
        },
      });

      if (updated.count === 0) {
        throw new ConflictException('Concurrent transaction conflict');
      }

      await tx.creditLedger.create({
        data: {
          userId,
          delta: -amount,
          reason,
          description,
          balanceAfter: current.balance - amount,
        },
      });

      return { balance: current.balance - amount };
    });
  }

  async addCredits(userId: string, amount: number, reason: LedgerReason, description?: string) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.creditBalance.findUnique({ where: { userId } }) 
        || await tx.creditBalance.create({ data: { userId, balance: 0, version: 0n } });

      await tx.creditBalance.update({
        where: { userId },
        data: {
          balance: { increment: amount },
          version: { increment: 1n },
        },
      });

      await tx.creditLedger.create({
        data: {
          userId,
          delta: amount,
          reason,
          description,
          balanceAfter: current.balance + amount,
        },
      });

      return { balance: current.balance + amount };
    });
  }

  async grantDailyQuota(userId: string) {
    return this.addCredits(userId, 50, LedgerReason.DAILY_QUOTA, 'Daily free quota');
  }

  async refundCredits(userId: string, amount: number) {
    return this.addCredits(userId, amount, LedgerReason.REFUND, 'Refund for failed service');
  }

  async getLedger(userId: string, skip = 0, take = 50) {
    return this.prisma.creditLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }
}
