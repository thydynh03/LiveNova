import { Controller, Get, Post, Param, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OverlayService } from './overlay.service';

@UseGuards(JwtAuthGuard)
@Controller('overlays')
export class OverlayController {
  constructor(private readonly overlayService: OverlayService) {}

  @Get()
  async getOverlays(@Req() req: any) {
    return this.overlayService.getOverlays(req.user.userId);
  }

  @Post()
  async createOverlay(@Req() req: any, @Body() body: any) {
    return this.overlayService.createOverlay(req.user.userId, body.type, body.config);
  }

  @Post(':id/rotate-token')
  async rotateToken(@Req() req: any, @Param('id') id: string) {
    return this.overlayService.rotateToken(id, req.user.userId);
  }
}
