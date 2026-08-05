import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { LedgerReason } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditService } from '../credit/credit.service';
import { loadEnv } from '../../common/config/env';

export interface TtsRequest {
  text: string;
  voice: string;
  pitch?: number;
  rate?: number;
}

export interface TtsResult {
  url: string;
  cached: boolean;
  creditsCharged: number;
}

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private readonly env = loadEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService,
  ) {}

  /**
   * H-06 — sha256, per SRS §B.8.1.
   *
   * The previous md5 key was both weaker than specified and collision-computable,
   * which matters because the cache is shared: a deliberate collision would let
   * one user's text resolve to another user's audio.
   */
  computeCacheKey(req: TtsRequest): string {
    const normalised = JSON.stringify({
      text: req.text,
      voice: req.voice,
      pitch: req.pitch ?? 0,
      rate: req.rate ?? 1,
    });
    return createHash('sha256').update(normalised).digest('hex');
  }

  private cacheExpiry(): Date {
    const d = new Date();
    d.setDate(d.getDate() + this.env.ttsCacheTtlDays);
    return d;
  }

  private validate(req: TtsRequest): void {
    if (!req.text || req.text.trim() === '') {
      throw new BadRequestException('text must not be empty');
    }
    // FR-016 / H-05 — an unbounded request length meant a single credit could buy
    // an arbitrarily large (and arbitrarily expensive) provider call.
    const length = [...req.text].length;
    if (length > this.env.ttsMaxChars) {
      throw new BadRequestException(
        `text exceeds the ${this.env.ttsMaxChars} character limit (got ${length})`,
      );
    }
  }

  private async readCache(cacheKey: string) {
    const cached = await this.prisma.ttsCache.findUnique({ where: { cacheKey } });
    if (!cached) return null;
    if (cached.expiresAt.getTime() <= Date.now()) return null;
    return cached;
  }

  private async touchCache(cacheKey: string) {
    // A hit extends the TTL, so hot phrases (gift names, thank-you templates)
    // stay resident and keep paying for themselves. DR-03.
    return this.prisma.ttsCache.update({
      where: { cacheKey },
      data: {
        hitCount: { increment: 1 },
        lastHitAt: new Date(),
        expiresAt: this.cacheExpiry(),
      },
    });
  }

  /**
   * BR-03 / BR-04 — cache-first synthesis.
   *
   * Cache hits are free; misses cost ceil(len / charsPerCredit) credits. Credits
   * are debited before the provider call and refunded if it fails, so a provider
   * outage never silently bills the user.
   */
  async synthesize(req: TtsRequest, userId: string): Promise<TtsResult> {
    this.validate(req);

    const cacheKey = this.computeCacheKey(req);

    const hit = await this.readCache(cacheKey);
    if (hit) {
      await this.touchCache(cacheKey);
      return { url: hit.audioUrl, cached: true, creditsCharged: 0 };
    }

    const cost = this.creditService.creditsForText(req.text);
    await this.creditService.deductCredits(
      userId,
      cost,
      LedgerReason.TTS_SYNTHESIS,
      `TTS synthesis (${[...req.text].length} chars)`,
      cacheKey,
    );

    // M-02 — a concurrent identical request may have populated the cache while we
    // were debiting. Check once more before paying the provider, and give the
    // credits back if so.
    const raced = await this.readCache(cacheKey);
    if (raced) {
      await this.creditService.refundCredits(userId, cost, cacheKey);
      await this.touchCache(cacheKey);
      return { url: raced.audioUrl, cached: true, creditsCharged: 0 };
    }

    try {
      const audioUrl = await this.callProvider(req, cacheKey);

      await this.prisma.ttsCache.upsert({
        where: { cacheKey },
        create: { cacheKey, audioUrl, expiresAt: this.cacheExpiry() },
        update: { audioUrl, expiresAt: this.cacheExpiry() },
      });

      return { url: audioUrl, cached: false, creditsCharged: cost };
    } catch (error) {
      // BR-11 — a system failure must not cost the user credits.
      this.logger.error(
        `TTS synthesis failed for user ${userId}; refunding ${cost} credit(s)`,
        error instanceof Error ? error.stack : undefined,
      );
      await this.creditService.refundCredits(userId, cost, cacheKey);
      throw error;
    }
  }

  /**
   * FR-020 — preview is free and heavily rate-limited at the controller. It never
   * touches the credit ledger and never writes to the shared cache.
   */
  async preview(req: TtsRequest): Promise<{ url: string }> {
    this.validate(req);
    const url = await this.callProvider(req, `preview_${this.computeCacheKey(req)}`);
    return { url };
  }

  /**
   * ⚠️ Q-21 UNRESOLVED — no TTS provider has been chosen or contracted.
   *
   * This is deliberately not wired to Google Cloud TTS yet: provider choice,
   * Vietnamese voice quality, and per-character pricing are open questions that
   * directly determine the credit formula in BR-03. Everything around this
   * method (caching, metering, refunds) is real and tested; only the outbound
   * call is pending.
   */
  private async callProvider(_req: TtsRequest, cacheKey: string): Promise<string> {
    this.logger.warn('Q-21 UNRESOLVED: no TTS provider configured; returning placeholder URL');
    return `https://cdn.placeholder.invalid/tts/${cacheKey}.mp3`;
  }

  async getCacheStats() {
    const [total, aggregate, expired] = await Promise.all([
      this.prisma.ttsCache.count(),
      this.prisma.ttsCache.aggregate({ _sum: { hitCount: true } }),
      this.prisma.ttsCache.count({ where: { expiresAt: { lte: new Date() } } }),
    ]);

    const totalHits = aggregate._sum.hitCount ?? 0;
    const totalRequests = totalHits + total;

    return {
      totalEntries: total,
      totalHits,
      expiredEntries: expired,
      // NFR-26 — hit rate is a direct margin indicator; surface it, do not infer it.
      hitRate: totalRequests === 0 ? 0 : Number((totalHits / totalRequests).toFixed(4)),
    };
  }

  /** DR-03 housekeeping. */
  async pruneExpiredCache(): Promise<number> {
    const result = await this.prisma.ttsCache.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return result.count;
  }
}
