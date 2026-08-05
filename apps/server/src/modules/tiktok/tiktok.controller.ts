import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TiktokService } from './tiktok.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('tiktok')
@UseGuards(JwtAuthGuard)
export class TiktokController {
  constructor(private readonly tiktokService: TiktokService) {}

  /**
   * Connect to a TikTok LIVE channel and start receiving events.
   * TODO: Tie to the authenticated user's linked channel.
   */
  @Post('channels/:channelId/connect')
  @HttpCode(HttpStatus.OK)
  async connect(@Param('channelId') channelId: string) {
    await this.tiktokService.connect(channelId);
    return { status: 'connected', channelId };
  }

  /**
   * Disconnect from a TikTok LIVE channel.
   */
  @Delete('channels/:channelId/connect')
  @HttpCode(HttpStatus.OK)
  async disconnect(@Param('channelId') channelId: string) {
    await this.tiktokService.disconnect(channelId);
    return { status: 'disconnected', channelId };
  }

  /**
   * Get all currently active channel sessions.
   */
  @Get('sessions')
  getSessions() {
    return {
      activeSessions: this.tiktokService.getActiveSessions(),
      count: this.tiktokService.getActiveSessions().length,
    };
  }
}
