import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TiktokService } from './tiktok.service';
import { ChannelService } from '../channel/channel.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';

@Controller('tiktok')
@UseGuards(JwtAuthGuard)
export class TiktokController {
  constructor(
    private readonly tiktokService: TiktokService,
    private readonly channelService: ChannelService,
  ) {}

  /**
   * H-07 — `channelId` is a Channel row id owned by the caller, not an arbitrary
   * platform handle. The previous version accepted any string from the URL and
   * connected an ingest session to it.
   */
  @Post('channels/:channelId/connect')
  @HttpCode(HttpStatus.OK)
  async connect(
    @CurrentUserId() userId: string,
    @Param('channelId', ParseUUIDPipe) channelId: string,
  ) {
    const channel = await this.channelService.assertOwnedAndVerified(userId, channelId);
    await this.tiktokService.connect(channel.id, channel.platformChannelId);
    return { status: 'connected', channelId: channel.id };
  }

  @Delete('channels/:channelId/connect')
  @HttpCode(HttpStatus.OK)
  async disconnect(
    @CurrentUserId() userId: string,
    @Param('channelId', ParseUUIDPipe) channelId: string,
  ) {
    const owned = await this.channelService.isOwnedBy(userId, channelId);
    if (!owned) {
      // Same shape as a successful disconnect so the endpoint cannot be used to
      // enumerate which channel ids exist.
      return { status: 'disconnected', channelId };
    }
    await this.tiktokService.disconnect(channelId);
    return { status: 'disconnected', channelId };
  }

  /** Scoped to the caller — previously returned every active session globally. */
  @Get('sessions')
  async getSessions(@CurrentUserId() userId: string) {
    const channels = await this.channelService.listForUser(userId);
    const ownedIds = new Set(channels.map((c) => c.id));
    const active = this.tiktokService.getActiveSessions().filter((id) => ownedIds.has(id));
    return { activeSessions: active, count: active.length };
  }
}
