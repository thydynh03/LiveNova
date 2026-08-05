import { BadRequestException, ConflictException } from '@nestjs/common';
import { LedgerReason } from '@prisma/client';
import { CreditService } from './credit.service';
import { PaymentRequiredException } from '../../common/exceptions/payment-required.exception';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * The money path. These are the tests SRS §B.17 asks for.
 */

type MockTx = {
  creditBalance: {
    findUnique: jest.Mock;
    updateMany: jest.Mock;
    update: jest.Mock;
    upsert: jest.Mock;
  };
  creditLedger: { create: jest.Mock; findFirst: jest.Mock };
  transaction: { findUnique: jest.Mock };
};

function makeTx(): MockTx {
  return {
    creditBalance: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    creditLedger: { create: jest.fn(), findFirst: jest.fn() },
    transaction: { findUnique: jest.fn() },
  };
}

function makePrisma(tx: MockTx) {
  return {
    $transaction: jest.fn(async (cb: (t: MockTx) => unknown) => cb(tx)),
    creditBalance: tx.creditBalance,
    creditLedger: tx.creditLedger,
    transaction: tx.transaction,
  } as unknown as PrismaService;
}

describe('CreditService', () => {
  let tx: MockTx;
  let service: CreditService;

  beforeEach(() => {
    tx = makeTx();
    service = new CreditService(makePrisma(tx));
  });

  describe('creditsForText (BR-03)', () => {
    it('charges one credit per 200 characters, rounded up', () => {
      expect(service.creditsForText('a')).toBe(1);
      expect(service.creditsForText('a'.repeat(200))).toBe(1);
      expect(service.creditsForText('a'.repeat(201))).toBe(2);
      expect(service.creditsForText('a'.repeat(400))).toBe(2);
      expect(service.creditsForText('a'.repeat(401))).toBe(3);
    });

    it('counts Vietnamese characters and emoji by code point, not UTF-16 unit', () => {
      // A naive `.length` would over-count astral-plane characters and
      // over-charge users whose comments are mostly emoji.
      expect(service.creditsForText('🎁'.repeat(200))).toBe(1);
    });

    it('charges nothing for empty text', () => {
      expect(service.creditsForText('')).toBe(0);
    });
  });

  describe('deductCredits', () => {
    it('rejects non-positive and non-integer amounts', async () => {
      await expect(
        service.deductCredits('u1', 0, LedgerReason.TTS_SYNTHESIS),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.deductCredits('u1', -5, LedgerReason.TTS_SYNTHESIS),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.deductCredits('u1', 1.5, LedgerReason.TTS_SYNTHESIS),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('raises 402 rather than 400 when the balance is too low (BR-10)', async () => {
      tx.creditBalance.findUnique.mockResolvedValue({ balance: 3, version: 0n });

      await expect(
        service.deductCredits('u1', 10, LedgerReason.TTS_SYNTHESIS),
      ).rejects.toBeInstanceOf(PaymentRequiredException);

      expect(tx.creditBalance.updateMany).not.toHaveBeenCalled();
      expect(tx.creditLedger.create).not.toHaveBeenCalled();
    });

    it('raises 402 when no balance row exists at all', async () => {
      tx.creditBalance.findUnique.mockResolvedValue(null);
      await expect(
        service.deductCredits('u1', 1, LedgerReason.TTS_SYNTHESIS),
      ).rejects.toBeInstanceOf(PaymentRequiredException);
    });

    it('debits and writes a matching ledger row', async () => {
      tx.creditBalance.findUnique.mockResolvedValue({ balance: 10, version: 4n });
      tx.creditBalance.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.deductCredits(
        'u1',
        3,
        LedgerReason.TTS_SYNTHESIS,
        'test',
        'ref-1',
      );

      expect(result).toEqual({ balance: 7 });

      // The version guard is what makes the update safe under concurrency.
      expect(tx.creditBalance.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', version: 4n },
        data: { balance: { decrement: 3 }, version: { increment: 1n } },
      });

      expect(tx.creditLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u1',
          delta: -3,
          reason: LedgerReason.TTS_SYNTHESIS,
          balanceAfter: 7,
          refId: 'ref-1',
        }),
      });
    });

    it('retries a lost optimistic-lock race instead of failing the caller (M-01)', async () => {
      tx.creditBalance.findUnique.mockResolvedValue({ balance: 10, version: 1n });
      tx.creditBalance.updateMany
        .mockResolvedValueOnce({ count: 0 }) // another writer won
        .mockResolvedValueOnce({ count: 0 }) // and again
        .mockResolvedValueOnce({ count: 1 }); // then we win

      const result = await service.deductCredits('u1', 1, LedgerReason.TTS_SYNTHESIS);

      expect(result).toEqual({ balance: 9 });
      expect(tx.creditBalance.updateMany).toHaveBeenCalledTimes(3);
    });

    it('gives up with a conflict once retries are exhausted', async () => {
      tx.creditBalance.findUnique.mockResolvedValue({ balance: 10, version: 1n });
      tx.creditBalance.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.deductCredits('u1', 1, LedgerReason.TTS_SYNTHESIS),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(tx.creditBalance.updateMany).toHaveBeenCalledTimes(5);
    });

    it('does not retry an insufficient-balance failure', async () => {
      tx.creditBalance.findUnique.mockResolvedValue({ balance: 0, version: 0n });

      await expect(
        service.deductCredits('u1', 1, LedgerReason.TTS_SYNTHESIS),
      ).rejects.toBeInstanceOf(PaymentRequiredException);

      expect(tx.creditBalance.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('addCredits', () => {
    it('rejects non-positive amounts', async () => {
      await expect(service.addCredits('u1', 0, LedgerReason.REFUND)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('increments and records balanceAfter from the post-update row', async () => {
      tx.creditBalance.upsert.mockResolvedValue({ balance: 5, version: 0n });
      tx.creditBalance.update.mockResolvedValue({ balance: 12, version: 1n });

      const result = await service.addCredits('u1', 7, LedgerReason.REFUND, 'refund');

      expect(result).toEqual({ balance: 12 });
      expect(tx.creditLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ delta: 7, balanceAfter: 12 }),
      });
    });
  });

  describe('creditFromSettledTransaction (C-01 / FR-063)', () => {
    it('refuses a transaction that is not settled', async () => {
      tx.transaction.findUnique.mockResolvedValue({ id: 't1', status: 'PENDING' });
      await expect(service.creditFromSettledTransaction('t1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('refuses an unknown transaction', async () => {
      tx.transaction.findUnique.mockResolvedValue(null);
      await expect(service.creditFromSettledTransaction('nope')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('credits exactly once even if the webhook is replayed', async () => {
      tx.transaction.findUnique.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        status: 'SUCCESS',
        creditAmount: 500,
        provider: 'vnpay',
      });
      tx.creditLedger.findFirst.mockResolvedValue({ id: 'existing-ledger-row' });

      const result = await service.creditFromSettledTransaction('t1');

      expect(result).toBeNull();
      expect(tx.creditBalance.update).not.toHaveBeenCalled();
      expect(tx.creditLedger.create).not.toHaveBeenCalled();
    });

    it('credits the purchase on first delivery', async () => {
      tx.transaction.findUnique.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        status: 'SUCCESS',
        creditAmount: 500,
        provider: 'vnpay',
      });
      tx.creditLedger.findFirst.mockResolvedValue(null);
      tx.creditBalance.upsert.mockResolvedValue({ balance: 0, version: 0n });
      tx.creditBalance.update.mockResolvedValue({ balance: 500, version: 1n });

      const result = await service.creditFromSettledTransaction('t1');

      expect(result).toEqual({ balance: 500 });
      expect(tx.creditLedger.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          delta: 500,
          reason: LedgerReason.PURCHASE,
          refId: 't1',
        }),
      });
    });
  });

  describe('getLedger', () => {
    it('clamps pagination so a caller cannot request the whole table', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const prisma = { creditLedger: { findMany } } as unknown as PrismaService;
      const svc = new CreditService(prisma);

      await svc.getLedger('u1', -10, 100_000);

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 200 }),
      );
    });
  });
});
