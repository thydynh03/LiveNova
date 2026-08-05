import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditService } from '../credit/credit.service';
import { LedgerReason } from '@prisma/client';
import { createHash } from 'crypto';

interface TtsRequest {
  text: string;
  voice: string;
  pitch?: number;
  rate?: number;
}

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService
  ) {}

  computeCacheKey(req: TtsRequest): string {
    const data = `${req.text}|${req.voice}|${req.pitch || 1}|${req.rate || 1}`;
    return createHash('md5').update(data).digest('hex');
  }

  async synthesize(req: TtsRequest, userId: string) {
    const cacheKey = this.computeCacheKey(req);
    
    // Check cache first
    const cached = await this.prisma.ttsCache.findUnique({ where: { cacheKey } });
    if (cached) {
      await this.prisma.ttsCache.update({
        where: { cacheKey },
        data: { hitCount: { increment: 1 }, lastHitAt: new Date() }
      });
      return { url: cached.audioUrl, cached: true };
    }

    // Deduct credit if cache miss
    await this.creditService.deductCredits(userId, 1, LedgerReason.TTS_SYNTHESIS, 'TTS Generation');

    try {
      // Mock TTS provider call
      const audioUrl = `https://cdn.example.com/tts/${cacheKey}.mp3`;
      
      // Store in cache
      await this.prisma.ttsCache.create({
        data: { cacheKey, audioUrl }
      });

      return { url: audioUrl, cached: false };
    } catch (error) {
      // Refund on failure
      this.logger.error('TTS Generation failed, refunding credit');
      await this.creditService.refundCredits(userId, 1);
      throw error;
    }
  }

  async getProviderStatus() {
    return { status: 'healthy', latency: 45 };
  }

  async getCacheStats() {
    const total = await this.prisma.ttsCache.count();
    const stats = await this.prisma.ttsCache.aggregate({
      _sum: { hitCount: true }
    });
    return { totalEntries: total, totalHits: stats._sum.hitCount || 0 };
  }
}
