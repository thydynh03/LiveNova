import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerReason, Prisma } from '@prisma/client';
import { loadEnv } from '../../common/config/env';
import { PaymentRequiredException } from '../../common/exceptions/payment-required.exception';

/** Bound on how many times a lost optimistic-lock race is retried (M-01). */
const MAX_LOCK_RETRIES = 5;

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);
  private readonly env = loadEnv();

  constructor(private readonly prisma: PrismaService) {}

  /** BR-03 — one credit covers `ttsCharsPerCredit` characters, rounded up. */
  creditsForText(text: string): number {
    const length = [...text].length;
    if (length === 0) return 0;
    return Math.ceil(length / this.env.ttsCharsPerCredit);
  }

  async getBalance(userId: string) {
    const existing = await this.prisma.creditBalance.findUnique({ where: { userId } });
    if (existing) return existing;

    // Concurrent first-reads would both try to create; upsert makes that safe.
    return this.prisma.creditBalance.upsert({
      where: { userId },
      create: { userId, balance: 0, version: 0n },
      update: {},
    });
  }

  /**
   * Atomically debits credits.
   *
   * M-01 — losing the optimistic-lock race is an expected outcome under the
   * concurrency of a live stream, not an error the caller should see. We retry a
   * bounded number of times and only surface a conflict if contention persists.
   */
  async deductCredits(
    userId: string,
    amount: number,
    reason: LedgerReason,
    description?: string,
    refId?: string,
  ): Promise<{ balance: number }> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be a positive integer');
    }

    for (let attempt = 0; attempt < MAX_LOCK_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const current = await tx.creditBalance.findUnique({ where: { userId } });

          if (!current || current.balance < amount) {
            // 402 rather than 400: the request is well-formed, the account simply
            // cannot pay for it. Callers branch on this to keep overlays running
            // while TTS stops (BR-10).
            throw new PaymentRequiredException(
              `Insufficient credits: balance ${current?.balance ?? 0}, required ${amount}`,
            );
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
              refId,
              balanceAfter: current.balance - amount,
            },
          });

          return { balance: current.balance - amount };
        });
      } catch (error) {
        const isLockConflict = error instanceof ConflictException;
        if (!isLockConflict || attempt === MAX_LOCK_RETRIES - 1) {
          throw error;
        }
        // Small jittered backoff so retries do not resynchronise into each other.
        await new Promise((resolve) => setTimeout(resolve, 5 + Math.floor(Math.random() * 20)));
      }
    }

    throw new ConflictException('Could not acquire credit balance lock');
  }

  async addCredits(
    userId: string,
    amount: number,
    reason: LedgerReason,
    description?: string,
    refId?: string,
  ): Promise<{ balance: number }> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be a positive integer');
    }

    return this.prisma.$transaction(async (tx) => {
      // M-03 — upsert removes the read-then-create race the previous
      // `findUnique() || create()` had.
      const before = await tx.creditBalance.upsert({
        where: { userId },
        create: { userId, balance: 0, version: 0n },
        update: {},
      });

      const after = await tx.creditBalance.update({
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
          refId,
          balanceAfter: after.balance,
        },
      });

      void before;
      return { balance: after.balance };
    });
  }

  /**
   * BR-01 / BR-06 — grants the daily free allowance, at most once per reset
   * window. `resetsAt` makes the operation idempotent, so a retried or
   * double-scheduled job cannot grant twice.
   */
  async grantDailyQuota(userId: string): Promise<{ granted: boolean; balance: number }> {
    const now = new Date();
    const balance = await this.getBalance(userId);

    if (balance.resetsAt && balance.resetsAt > now) {
      return { granted: false, balance: balance.balance };
    }

    const nextReset = new Date(now);
    nextReset.setUTCDate(nextReset.getUTCDate() + 1);
    nextReset.setUTCHours(0, 0, 0, 0);

    const result = await this.addCredits(
      userId,
      this.env.dailyFreeCredits,
      LedgerReason.DAILY_QUOTA,
      'Daily free quota',
    );

    await this.prisma.creditBalance.update({
      where: { userId },
      data: { resetsAt: nextReset, dailyFreeUsed: 0 },
    });

    return { granted: true, balance: result.balance };
  }

  async refundCredits(userId: string, amount: number, refId?: string) {
    return this.addCredits(
      userId,
      amount,
      LedgerReason.REFUND,
      'Refund for failed service',
      refId,
    );
  }

  async getLedger(userId: string, skip = 0, take = 50) {
    const safeTake = Math.min(Math.max(take, 1), 200);
    const safeSkip = Math.max(skip, 0);
    return this.prisma.creditLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: safeSkip,
      take: safeTake,
    });
  }

  /**
   * FR-063 / C-01 — the ONLY path that may mint credits from a payment.
   * Requires a settled Transaction row; the unique idempotency key means a
   * replayed provider webhook cannot credit twice.
   */
  async creditFromSettledTransaction(transactionId: string): Promise<{ balance: number } | null> {
    return this.prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.findUnique({ where: { id: transactionId } });

      if (!txn || txn.status !== 'SUCCESS') {
        throw new BadRequestException('Transaction is not settled');
      }

      const alreadyCredited = await tx.creditLedger.findFirst({
        where: { refId: txn.id, reason: LedgerReason.PURCHASE },
      });
      if (alreadyCredited) {
        this.logger.warn(`Transaction ${txn.id} already credited; ignoring replay`);
        return null;
      }

      const balance = await tx.creditBalance.upsert({
        where: { userId: txn.userId },
        create: { userId: txn.userId, balance: 0, version: 0n },
        update: {},
      });

      const after = await tx.creditBalance.update({
        where: { userId: txn.userId },
        data: {
          balance: { increment: txn.creditAmount },
          version: { increment: 1n },
        },
      });

      await tx.creditLedger.create({
        data: {
          userId: txn.userId,
          delta: txn.creditAmount,
          reason: LedgerReason.PURCHASE,
          description: `Purchase via ${txn.provider}`,
          refId: txn.id,
          balanceAfter: after.balance,
        },
      });

      void balance;
      return { balance: after.balance };
    });
  }

  /** Guards against `Prisma.PrismaClientKnownRequestError` leaking to callers. */
  static isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    );
  }
}
