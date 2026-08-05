import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** DR-06 / FR-009 — grace window before personal data is hard-deleted. */
export const DELETION_GRACE_DAYS = 30;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    email: string;
    displayName?: string;
    avatar?: string;
    passwordHash?: string;
  }) {
    return this.prisma.user.create({ data });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async update(id: string, data: Partial<{ displayName: string; locale: string; timezone: string }>) {
    return this.prisma.user.update({ where: { id }, data });
  }

  /**
   * `deletedAt` records when deletion was *requested*, not when the grace period
   * ends. Storing a future date meant every "is this account deleted?" check
   * (`deletedAt != null`) treated the account as already gone while
   * simultaneously making the timestamp useless for scheduling the purge.
   */
  async softDelete(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** Accounts whose grace period has elapsed and may now be hard-deleted. */
  async findPurgeable(now = new Date()) {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - DELETION_GRACE_DAYS);
    return this.prisma.user.findMany({
      where: { deletedAt: { not: null, lte: cutoff } },
      select: { id: true, email: true, deletedAt: true },
    });
  }
}
