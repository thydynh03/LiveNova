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
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { OverlayType, Prisma } from '@prisma/client';
import type { DiscoEffect } from '@livenova/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { OverlayService } from './overlay.service';
import { DiscoSyncService } from './disco-sync.service';

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
 * Lệnh điều khiển sàn nhảy gửi từ dashboard.
 *
 * Mọi trường đều tuỳ chọn: dashboard chỉ gửi thứ vừa đổi. `ledDim` bị chặn trên
 * ở 1 vì giá trị lớn hơn sẽ làm màn LED đen kịt — không phải lỗi bảo mật, nhưng
 * là thứ đáng chặn ở biên thay vì phải đi tìm khi màn hình tự nhiên tối om.
 */
class DiscoSyncDto {
  @IsOptional() @IsString() @Length(0, 2048) musicUrl?: string;
  @IsOptional() @IsString() @Length(0, 200) trackTitle?: string;
  @IsOptional() @IsString() @Length(0, 2048) videoUrl?: string;
  @IsOptional() @IsBoolean() isMuted?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(1) ledDim?: number;

  @IsOptional()
  @IsIn(['DJ_POV', 'SPOTLIGHT_ZOOM', 'CRANE_SWOOP', 'WIDE_ORBIT'])
  cameraShot?: 'DJ_POV' | 'SPOTLIGHT_ZOOM' | 'CRANE_SWOOP' | 'WIDE_ORBIT';

  @IsOptional() @IsNumber() @Min(0) @Max(60_000) cameraDurationMs?: number;
  @IsOptional() @IsString() @Length(0, 120) cameraTargetId?: string;
  @IsOptional()
  @IsIn(['confetti', 'strobe', 'firework_burst', 'smoke_blast', 'laser_show'])
  effect?: DiscoEffect;
  @IsOptional() @IsString() @Length(0, 500) speechText?: string;
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
  constructor(
    private readonly overlayService: OverlayService,
    private readonly discoSync: DiscoSyncService,
  ) {}

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

  /**
   * Đẩy lệnh điều khiển sàn nhảy tới overlay đang phát sóng.
   *
   * Kênh thay thế cho `BroadcastChannel` — xem `DiscoSyncService` để biết vì sao
   * cách cũ không tới được OBS.
   */
  @Post(':id/disco-sync')
  @HttpCode(HttpStatus.OK)
  async discoSyncPublish(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DiscoSyncDto,
  ) {
    return this.discoSync.publish(userId, id, dto);
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
