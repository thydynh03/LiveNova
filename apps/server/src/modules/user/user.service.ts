import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { email: string; displayName?: string; avatar?: string; passwordHash?: string }) {
    return this.prisma.user.create({ data });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id, deletedAt: null } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email, deletedAt: null } });
  }

  async update(id: string, data: Partial<{ displayName: string; locale: string; timezone: string }>) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string) {
    // Soft delete with 30-day grace period
    const graceDate = new Date();
    graceDate.setDate(graceDate.getDate() + 30);
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: graceDate },
    });
  }
}
