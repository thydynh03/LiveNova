import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, Role, LedgerReason } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditService } from '../credit/credit.service';
import { AdjustCreditDto, ListUsersQuery } from './dto/admin.dto';

/** Fields an admin may see about another account. */
const USER_SUMMARY = {
  id: true,
  email: true,
  displayName: true,
  avatar: true,
  role: true,
  emailVerified: true,
  deletedAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credit: CreditService,
  ) {}

  /**
   * Every admin action goes through here.
   *
   * Written in the same transaction-less path as the action itself rather than
   * after it: a log written only on success would miss exactly the cases anyone
   * would want to investigate.
   */
  private async record(
    adminId: string,
    action: string,
    detail: Record<string, unknown>,
    targetUserId?: string,
  ) {
    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        targetUserId: targetUserId ?? null,
        action,
        detail: detail as Prisma.InputJsonObject,
      },
    });
  }

  async listUsers(query: ListUsersQuery) {
    const take = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const search = query.search?.trim();

    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SUMMARY,
        orderBy: { createdAt: 'desc' },
        take,
        skip: Math.max(query.offset ?? 0, 0),
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  /**
   * One user in detail.
   *
   * `Overlay.publicToken` is deliberately absent. That token is a broadcast
   * credential — anyone holding it can read the user's live event stream — and
   * an admin has no reason to see it. Counts are enough to support them.
   */
  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...USER_SUMMARY,
        locale: true,
        timezone: true,
        creditBalance: { select: { balance: true, dailyFreeUsed: true } },
        _count: { select: { channels: true, rules: true, overlays: true } },
      },
    });

    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user;
  }

  async setSuspended(adminId: string, userId: string, suspended: boolean) {
    if (adminId === userId) {
      // Locking yourself out leaves nobody able to unlock it.
      throw new BadRequestException('Không thể tự khoá tài khoản của mình');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!target) throw new NotFoundException('Không tìm thấy người dùng');
    if (target.role === Role.ADMIN) {
      throw new ForbiddenException('Không thể khoá một tài khoản quản trị');
    }

    // `deletedAt` is the existing soft-delete marker, and RolesGuard and the
    // auth flow already treat it as "this account is gone". Reusing it keeps
    // one meaning of "disabled" rather than adding a second, divergent flag.
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: suspended ? new Date() : null },
    });

    await this.record(adminId, suspended ? 'user.suspend' : 'user.restore', {}, userId);
    return { success: true, suspended };
  }

  /**
   * Adjust a user's credit balance.
   *
   * Goes through CreditService so it lands in the ledger with
   * `LedgerReason.ADMIN_ADJUST`, which has been in the schema unused since the
   * beginning. Writing `CreditBalance` directly would leave a balance nobody
   * can reconcile, and would sidestep the non-negative constraint's sibling
   * bookkeeping.
   */
  async adjustCredit(adminId: string, userId: string, dto: AdjustCreditDto) {
    const reason = dto.reason.trim();
    if (reason === '') {
      // An unexplained balance change is the thing the audit log exists to
      // prevent, so the reason is required rather than optional.
      throw new BadRequestException('Phải ghi lý do điều chỉnh');
    }

    const exists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Không tìm thấy người dùng');

    const description = `Admin điều chỉnh: ${reason}`;
    const idempotencyKey = `admin_${adminId}_${Date.now()}_${userId}`;

    const result =
      dto.amount > 0
        ? await this.credit.addCredits(
            userId,
            dto.amount,
            LedgerReason.ADMIN_ADJUST,
            description,
            idempotencyKey,
          )
        : await this.credit.deductCredits(
            userId,
            Math.abs(dto.amount),
            LedgerReason.ADMIN_ADJUST,
            description,
            idempotencyKey,
          );

    await this.record(adminId, 'credit.adjust', { amount: dto.amount, reason }, userId);
    return result;
  }

  async listAuditLog(limit = 50) {
    return this.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      select: {
        id: true,
        action: true,
        detail: true,
        createdAt: true,
        admin: { select: { id: true, email: true } },
        targetUser: { select: { id: true, email: true } },
      },
    });
  }
}
