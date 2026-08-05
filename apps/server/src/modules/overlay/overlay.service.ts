import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { OverlayType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OverlayService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * M-08 — 256 bits of entropy, per SRS §B.8.1.
   *
   * uuid v4 carries only 122 bits, and these tokens end up pasted into OBS and
   * frequently shown on stream, so they must be genuinely unguessable rather
   * than merely unique.
   */
  private static generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  async createOverlay(userId: string, type: OverlayType, config: Prisma.InputJsonObject) {
    return this.prisma.overlay.create({
      data: {
        userId,
        type,
        config: config ?? {},
        publicToken: OverlayService.generateToken(),
      },
    });
  }

  async getOverlays(userId: string) {
    return this.prisma.overlay.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * FR-046 / FR-047 — public, token-authenticated read for the OBS browser
   * source. Returns only render config; never the owner id or any account data,
   * because this response is fetched by a page with no session.
   */
  async getPublicByToken(token: string) {
    const overlay = await this.prisma.overlay.findUnique({
      where: { publicToken: token },
      select: { id: true, type: true, config: true, enabled: true, updatedAt: true },
    });

    if (!overlay || !overlay.enabled) {
      // Same response for "missing" and "disabled" so the endpoint cannot be
      // used to probe which tokens exist.
      throw new NotFoundException('Overlay not found');
    }

    return overlay;
  }

  async updateConfig(id: string, userId: string, config: Prisma.InputJsonObject) {
    const result = await this.prisma.overlay.updateMany({
      where: { id, userId },
      data: { config },
    });
    if (result.count === 0) throw new NotFoundException('Overlay not found');
    return this.prisma.overlay.findUnique({ where: { id } });
  }

  async rotateToken(id: string, userId: string) {
    const result = await this.prisma.overlay.updateMany({
      where: { id, userId },
      data: { publicToken: OverlayService.generateToken() },
    });
    if (result.count === 0) throw new NotFoundException('Overlay not found');
    return this.prisma.overlay.findUnique({
      where: { id },
      select: { id: true, publicToken: true },
    });
  }

  async deleteOverlay(id: string, userId: string) {
    const result = await this.prisma.overlay.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw new NotFoundException('Overlay not found');
    return { success: true };
  }
}
