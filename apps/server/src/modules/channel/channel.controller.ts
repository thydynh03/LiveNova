import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { Platform, BroadcastSource } from '@prisma/client';
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

class SetBroadcastSourceDto {
  @IsEnum(BroadcastSource)
  broadcastSource!: BroadcastSource;
}

@UseGuards(JwtAuthGuard)
@Controller('channels')
export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

  @Get()
  async list(@CurrentUserId() userId: string) {
    return this.channelService.listForUser(userId);
  }

  @Post()
  async link(@CurrentUserId() userId: string, @Body() dto: LinkChannelDto) {
    return this.channelService.link(userId, dto.platform, dto.platformChannelId, dto.handle);
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  async verify(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.channelService.verify(userId, id);
  }

  @Patch(':id/broadcast-source')
  @HttpCode(HttpStatus.OK)
  async setBroadcastSource(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetBroadcastSourceDto,
  ) {
    return this.channelService.setBroadcastSource(userId, id, dto.broadcastSource);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async unlink(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.channelService.unlink(userId, id);
  }
}
