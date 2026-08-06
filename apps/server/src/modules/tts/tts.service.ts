import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import * as googleTTS from 'google-tts-api';
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

/**
 * Split text into pieces no longer than `limit`, preferring natural breaks.
 *
 * Tries sentence punctuation first, then whitespace, and only slices mid-word
 * when a single run of characters is itself over the limit. That last case is
 * not hypothetical: a viewer holding down a key produces exactly it, and a
 * splitter that throws instead would fail the whole utterance.
 *
 * Length is measured in code points, matching the service's own validation, so
 * Vietnamese combining marks are never severed from their base letter.
 */
export function chunkText(text: string, limit: number): string[] {
  const trimmed = text.trim();
  if (trimmed === '') return [];
  if ([...trimmed].length <= limit) return [trimmed];

  const chunks: string[] = [];
  let current = '';

  const push = () => {
    const value = current.trim();
    if (value !== '') chunks.push(value);
    current = '';
  };

  // Keep the delimiter attached to the piece it ends, so the pause lands where
  // the speaker would put it.
  for (const segment of trimmed.split(/(?<=[.!?,;:])\s+|\s+/)) {
    if (segment === '') continue;

    const units = [...segment];
    if (units.length > limit) {
      push();
      for (let i = 0; i < units.length; i += limit) {
        chunks.push(units.slice(i, i + limit).join(''));
      }
      continue;
    }

    const candidate = current === '' ? segment : `${current} ${segment}`;
    if ([...candidate].length > limit) {
      push();
      current = segment;
    } else {
      current = candidate;
    }
  }

  push();
  return chunks;
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

  /** Google Translate TTS rejects any single request longer than this. */
  private static readonly PROVIDER_CHAR_LIMIT = 200;

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
   * Google Translate TTS.
   *
   * This endpoint is not a contracted provider and offers no SLA, so the credit
   * formula in BR-03 stays provisional (Q-21). It does produce usable
   * Vietnamese, which is enough to run the product end to end.
   *
   * Two of its constraints shape this method:
   *
   * 1. It rejects anything over 200 characters. `TTS_MAX_CHARS` defaults to 500,
   *    so every utterance in the 201..500 range has to be split. The previous
   *    version called `getAudioBase64` directly and fell back to `getAudioUrl`,
   *    which enforces the same 200-character limit — so the fallback threw too
   *    and every long utterance failed outright.
   * 2. It exposes only language and a slow/normal flag. Pitch and arbitrary
   *    voice ids cannot be honoured; see `providerParams`.
   */
  private async callProvider(req: TtsRequest, _cacheKey: string): Promise<string> {
    const { lang, slow } = this.providerParams(req);

    // The library's own splitter is not used: it throws outright when a segment
    // has no punctuation to break on, and unpunctuated 200+ character comments
    // are exactly what a live chat produces.
    const chunks = chunkText(req.text, TtsService.PROVIDER_CHAR_LIMIT);
    if (chunks.length === 0) {
      throw new Error('TTS provider received no speakable text');
    }

    const parts: string[] = [];
    for (const chunk of chunks) {
      // Sequential rather than parallel: the endpoint is unauthenticated and
      // rate-limits aggressively, and the pieces have to keep their order.
      parts.push(
        await googleTTS.getAudioBase64(chunk, {
          lang,
          slow,
          host: 'https://translate.google.com',
          timeout: 10_000,
        }),
      );
    }

    // MPEG frames are self-delimiting, so concatenating the chunks yields a
    // single stream every browser decoder plays back in order.
    const audio = Buffer.concat(parts.map((part) => Buffer.from(part, 'base64')));
    return `data:audio/mpeg;base64,${audio.toString('base64')}`;
  }

  /**
   * Map a request onto what this provider can actually do.
   *
   * The voice id is the product's own (`vi-VN-Wavenet-A`); only its language
   * prefix survives. Rate is collapsed to the slow flag, and pitch is dropped.
   * The cache key still covers all three, so switching voice re-synthesises
   * rather than silently serving audio recorded under different settings.
   */
  private providerParams(req: TtsRequest): { lang: string; slow: boolean } {
    const langMatch = /^([a-z]{2})(?:-[A-Z]{2})?/.exec(req.voice ?? '');
    return {
      lang: langMatch ? langMatch[1] : 'vi',
      slow: (req.rate ?? 1) < 0.85,
    };
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
