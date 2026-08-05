import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { TtsService } from './tts.service';
import { SynthesizeDto, PreviewDto } from './dto/tts.dto';

/**
 * The TTS module previously had no controller at all, so none of it was
 * reachable. It is exposed here behind auth, DTO validation and per-route
 * throttling.
 */
@UseGuards(JwtAuthGuard)
@Controller('tts')
export class TtsController {
  constructor(private readonly ttsService: TtsService) {}

  @Post('synthesize')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async synthesize(@CurrentUserId() userId: string, @Body() dto: SynthesizeDto) {
    return this.ttsService.synthesize(dto, userId);
  }

  /** BR-05 — free, so it must be throttled harder than the metered route. */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async preview(@Body() dto: PreviewDto) {
    return this.ttsService.preview(dto);
  }

  @Get('cache-stats')
  async cacheStats() {
    return this.ttsService.getCacheStats();
  }
}
