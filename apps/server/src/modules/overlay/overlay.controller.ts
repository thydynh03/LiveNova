import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OverlayService } from './overlay.service';
import { OverlayType, Prisma } from '@prisma/client';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { userId: string };
}

@UseGuards(JwtAuthGuard)
@Controller('overlays')
export class OverlayController {
  constructor(private readonly overlayService: OverlayService) {}

  @Get()
  async getOverlays(@Req() req: AuthenticatedRequest) {
    return this.overlayService.getOverlays(req.user.userId);
  }

  @Post()
  async createOverlay(@Req() req: AuthenticatedRequest, @Body() body: { type: OverlayType; config: Prisma.InputJsonObject }) {
    return this.overlayService.createOverlay(req.user.userId, body.type, body.config);
  }

  @Post(':id/rotate-token')
  async rotateToken(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.overlayService.rotateToken(id, req.user.userId);
  }
}
