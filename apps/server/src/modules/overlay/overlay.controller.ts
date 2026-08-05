import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { IsEnum, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { OverlayType, Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { OverlayService } from './overlay.service';

class CreateOverlayDto {
  @IsEnum(OverlayType)
  type!: OverlayType;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

class UpdateOverlayConfigDto {
  @IsObject()
  config!: Record<string, unknown>;
}

class OverlayTokenParamDto {
  @IsString()
  @Length(32, 64)
  token!: string;
}

/**
 * Split into two controllers on purpose: the OBS browser source has no session
 * and must never be forced through JwtAuthGuard, while everything the streamer
 * manages must be.
 */
@Controller('public/overlays')
export class PublicOverlayController {
  constructor(private readonly overlayService: OverlayService) {}

  @Get(':token')
  async getByToken(@Param() params: OverlayTokenParamDto) {
    return this.overlayService.getPublicByToken(params.token);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('overlays')
export class OverlayController {
  constructor(private readonly overlayService: OverlayService) {}

  @Get()
  async getOverlays(@CurrentUserId() userId: string) {
    return this.overlayService.getOverlays(userId);
  }

  @Post()
  async createOverlay(@CurrentUserId() userId: string, @Body() dto: CreateOverlayDto) {
    return this.overlayService.createOverlay(
      userId,
      dto.type,
      (dto.config ?? {}) as Prisma.InputJsonObject,
    );
  }

  @Patch(':id/config')
  async updateConfig(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOverlayConfigDto,
  ) {
    return this.overlayService.updateConfig(id, userId, dto.config as Prisma.InputJsonObject);
  }

  @Post(':id/rotate-token')
  @HttpCode(HttpStatus.OK)
  async rotateToken(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.overlayService.rotateToken(id, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteOverlay(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.overlayService.deleteOverlay(id, userId);
  }
}
