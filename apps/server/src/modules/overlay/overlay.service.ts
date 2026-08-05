import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OverlayType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OverlayService {
  constructor(private readonly prisma: PrismaService) {}

  async createOverlay(userId: string, type: OverlayType, config: Record<string, unknown>) {
    return this.prisma.overlay.create({
      data: {
        userId,
        type,
        config: config || {},
      },
    });
  }

  async getOverlays(userId: string) {
    return this.prisma.overlay.findMany({
      where: { userId },
    });
  }

  async getByToken(token: string) {
    return this.prisma.overlay.findUnique({
      where: { publicToken: token },
    });
  }

  async rotateToken(id: string, userId: string) {
    return this.prisma.overlay.update({
      where: { id, userId },
      data: { publicToken: uuidv4() },
    });
  }
}
