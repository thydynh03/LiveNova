import { BadRequestException } from '@nestjs/common';
import { LedgerReason } from '@prisma/client';
import { TtsService, chunkText } from './tts.service';

/*
 * The provider is an unauthenticated public endpoint. Left unmocked these
 * specs would make real network calls to Google on every CI run, so a
 * rate-limit or an outage there would show up as a failure here.
 */
jest.mock('google-tts-api', () => ({
  getAudioBase64: jest.fn(async () => Buffer.from('fake-mp3').toString('base64')),
}));

import * as googleTTSModule from 'google-tts-api';

const googleTTS = googleTTSModule as unknown as { getAudioBase64: jest.Mock };
import { CreditService } from '../credit/credit.service';
import { PrismaService } from '../../prisma/prisma.service';

interface PrismaMock {
  ttsCache: {
    findUnique: jest.Mock;
    update: jest.Mock;
    upsert: jest.Mock;
    count: jest.Mock;
    aggregate: jest.Mock;
    deleteMany: jest.Mock;
  };
}

interface CreditsMock {
  creditsForText: jest.Mock;
  deductCredits: jest.Mock;
  refundCredits: jest.Mock;
}

function makePrisma(): PrismaMock {
  return {
    ttsCache: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { hitCount: 0 } }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

function makeCredits(): CreditsMock {
  return {
    creditsForText: jest.fn((text: string) => Math.ceil([...text].length / 200) || 0),
    deductCredits: jest.fn().mockResolvedValue({ balance: 99 }),
    refundCredits: jest.fn().mockResolvedValue({ balance: 100 }),
  };
}

describe('TtsService', () => {
  let prisma: PrismaMock;
  let credits: CreditsMock;
  let service: TtsService;

  const future = () => new Date(Date.now() + 86_400_000);
  const past = () => new Date(Date.now() - 1_000);

  beforeEach(() => {
    googleTTS.getAudioBase64.mockClear();
    prisma = makePrisma();
    credits = makeCredits();
    service = new TtsService(
      prisma as unknown as PrismaService,
      credits as unknown as CreditService,
    );
  });

  describe('computeCacheKey (H-06)', () => {
    it('produces a sha256 hex digest, not md5', () => {
      const key = service.computeCacheKey({ text: 'xin chào', voice: 'vi-VN-A' });
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is stable for identical input and differs when any parameter changes', () => {
      const base = { text: 'xin chào', voice: 'vi-VN-A', rate: 1, pitch: 0 };
      expect(service.computeCacheKey(base)).toBe(service.computeCacheKey({ ...base }));
      expect(service.computeCacheKey(base)).not.toBe(
        service.computeCacheKey({ ...base, voice: 'vi-VN-B' }),
      );
      expect(service.computeCacheKey(base)).not.toBe(
        service.computeCacheKey({ ...base, rate: 1.5 }),
      );
    });

    it('does not let field values run together across the delimiter', () => {
      // A naive `${text}|${voice}` template collides on ('a|b', 'c') vs ('a', 'b|c').
      const a = service.computeCacheKey({ text: 'a|b', voice: 'c' });
      const b = service.computeCacheKey({ text: 'a', voice: 'b|c' });
      expect(a).not.toBe(b);
    });
  });

  describe('validation (H-05 / FR-016)', () => {
    it('rejects empty text', async () => {
      await expect(
        service.synthesize({ text: '   ', voice: 'vi-VN-A' }, 'u1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects text beyond the configured maximum', async () => {
      await expect(
        service.synthesize({ text: 'a'.repeat(501), voice: 'vi-VN-A' }, 'u1'),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Nothing is charged for a request that never reaches the provider.
      expect(credits.deductCredits).not.toHaveBeenCalled();
    });
  });

  describe('synthesize', () => {
    it('serves a cache hit for free (BR-04)', async () => {
      prisma.ttsCache.findUnique.mockResolvedValue({
        cacheKey: 'k',
        audioUrl: 'https://cdn/x.mp3',
        expiresAt: future(),
      });

      const result = await service.synthesize({ text: 'xin chào', voice: 'v' }, 'u1');

      expect(result).toEqual({ url: 'https://cdn/x.mp3', cached: true, creditsCharged: 0 });
      expect(credits.deductCredits).not.toHaveBeenCalled();
      expect(prisma.ttsCache.update).toHaveBeenCalled();
    });

    it('treats an expired cache row as a miss', async () => {
      prisma.ttsCache.findUnique.mockResolvedValue({
        cacheKey: 'k',
        audioUrl: 'https://cdn/old.mp3',
        expiresAt: past(),
      });

      const result = await service.synthesize({ text: 'xin chào', voice: 'v' }, 'u1');

      expect(result.cached).toBe(false);
      expect(credits.deductCredits).toHaveBeenCalled();
    });

    it('charges by text length on a miss, not a flat rate (BR-03)', async () => {
      prisma.ttsCache.findUnique.mockResolvedValue(null);

      const result = await service.synthesize({ text: 'a'.repeat(450), voice: 'v' }, 'u1');

      expect(result.creditsCharged).toBe(3);
      expect(credits.deductCredits).toHaveBeenCalledWith(
        'u1',
        3,
        LedgerReason.TTS_SYNTHESIS,
        expect.any(String),
        expect.any(String),
      );
    });

    it('refunds when a concurrent request populated the cache mid-flight (M-02)', async () => {
      prisma.ttsCache.findUnique
        .mockResolvedValueOnce(null) // first check: miss
        .mockResolvedValueOnce({
          cacheKey: 'k',
          audioUrl: 'https://cdn/raced.mp3',
          expiresAt: future(),
        }); // re-check after debit: someone else got there

      const result = await service.synthesize({ text: 'xin chào', voice: 'v' }, 'u1');

      expect(result).toEqual({
        url: 'https://cdn/raced.mp3',
        cached: true,
        creditsCharged: 0,
      });
      expect(credits.refundCredits).toHaveBeenCalledWith('u1', 1, expect.any(String));
      expect(prisma.ttsCache.upsert).not.toHaveBeenCalled();
    });

    it('refunds credits when the provider call fails (BR-11)', async () => {
      prisma.ttsCache.findUnique.mockResolvedValue(null);
      jest
        .spyOn(
          service as unknown as { callProvider: () => Promise<string> },
          'callProvider',
        )
        .mockRejectedValue(new Error('provider down'));

      await expect(
        service.synthesize({ text: 'xin chào', voice: 'v' }, 'u1'),
      ).rejects.toThrow('provider down');

      expect(credits.refundCredits).toHaveBeenCalledWith('u1', 1, expect.any(String));
    });

    it('writes the cache entry with an expiry (DR-03)', async () => {
      prisma.ttsCache.findUnique.mockResolvedValue(null);

      await service.synthesize({ text: 'xin chào', voice: 'v' }, 'u1');

      expect(prisma.ttsCache.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ expiresAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('preview (BR-05)', () => {
    it('never touches the ledger or the shared cache', async () => {
      await service.preview({ text: 'thử giọng', voice: 'v' });

      expect(credits.deductCredits).not.toHaveBeenCalled();
      expect(prisma.ttsCache.upsert).not.toHaveBeenCalled();
    });
  });

  describe('getCacheStats (NFR-26)', () => {
    it('reports a hit rate', async () => {
      prisma.ttsCache.count.mockResolvedValueOnce(40).mockResolvedValueOnce(0);
      prisma.ttsCache.aggregate.mockResolvedValue({ _sum: { hitCount: 60 } });

      const stats = await service.getCacheStats();

      expect(stats.totalEntries).toBe(40);
      expect(stats.totalHits).toBe(60);
      expect(stats.hitRate).toBeCloseTo(0.6, 4);
    });

    it('reports zero rather than NaN on an empty cache', async () => {
      prisma.ttsCache.count.mockResolvedValue(0);
      prisma.ttsCache.aggregate.mockResolvedValue({ _sum: { hitCount: null } });

      const stats = await service.getCacheStats();
      expect(stats.hitRate).toBe(0);
    });
  });
  describe('chunkText', () => {
    it('leaves text under the limit untouched', () => {
      expect(chunkText('xin chào', 200)).toEqual(['xin chào']);
    });

    it('returns nothing for whitespace', () => {
      expect(chunkText('   ', 200)).toEqual([]);
    });

    it('breaks on punctuation and keeps the delimiter with its clause', () => {
      const chunks = chunkText('Một hai ba. Bốn năm sáu.', 12);
      expect(chunks.every((c) => [...c].length <= 12)).toBe(true);
      expect(chunks.join(' ')).toBe('Một hai ba. Bốn năm sáu.');
    });

    it('slices a single over-long run rather than throwing', () => {
      // A viewer holding a key down. The library's own splitter throws here.
      const chunks = chunkText('a'.repeat(450), 200);
      expect(chunks).toHaveLength(3);
      expect(chunks.every((c) => c.length <= 200)).toBe(true);
      expect(chunks.join('')).toBe('a'.repeat(450));
    });

    it('never severs a Vietnamese diacritic from its base letter', () => {
      const chunks = chunkText('ế'.repeat(300), 200);
      expect(chunks.join('')).toBe('ế'.repeat(300));
      expect(chunks.every((c) => [...c].length <= 200)).toBe(true);
    });
  });

  describe('provider chunking', () => {
    it('splits a long utterance into several provider calls (200-char cap)', async () => {
      prisma.ttsCache.findUnique.mockResolvedValue(null);

      // Previously this threw: the library rejects >200 chars, and the
      // getAudioUrl fallback enforced the same limit.
      const result = await service.synthesize({ text: 'a'.repeat(450), voice: 'vi-VN-A' }, 'u1');

      expect(googleTTS.getAudioBase64).toHaveBeenCalledTimes(3);
      expect(result.url.startsWith('data:audio/mpeg;base64,')).toBe(true);
    });

    it('maps a slow rate onto the only speed control the provider has', async () => {
      prisma.ttsCache.findUnique.mockResolvedValue(null);

      await service.synthesize({ text: 'xin chào', voice: 'vi-VN-A', rate: 0.5 }, 'u1');

      expect(googleTTS.getAudioBase64).toHaveBeenCalledWith(
        'xin chào',
        expect.objectContaining({ lang: 'vi', slow: true }),
      );
    });
  });
});
