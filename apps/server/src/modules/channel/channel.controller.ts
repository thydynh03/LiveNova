import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { Platform } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { ChannelService } from './channel.service';

class LinkChannelDto {
  @IsEnum(Platform)
  platform!: Platform;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  platformChannelId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  handle!: string;
}

@UseGuards(JwtAuthGuard)
@Controller('channels')
export class ChannelController {
  constructor(
    private readonly channelService: ChannelService,
    private readonly tiktokService: TiktokService,
  ) {}

  @Get()
  async list(@CurrentUserId() userId: string) {
    return this.channelService.listForUser(userId);
  }

  @Post()
  async link(@CurrentUserId() userId: string, @Body() dto: LinkChannelDto) {
    const channel = await this.channelService.link(
      userId,
      dto.platform,
      dto.platformChannelId,
      dto.handle,
    );
    if (channel.verified && channel.platform === Platform.TIKTOK) {
      this.tiktokService.connect(channel.id, channel.handle).catch(() => undefined);
    }
    return channel;
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  async verify(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    const channel = await this.channelService.verify(userId, id);
    if (channel.verified && channel.platform === Platform.TIKTOK) {
      this.tiktokService.connect(channel.id, channel.handle).catch(() => undefined);
    }
    return channel;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async unlink(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.channelService.unlink(userId, id);
  }
}
