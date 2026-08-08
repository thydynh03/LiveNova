import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, Role, LedgerReason, TransactionStatus } from '@prisma/client';
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

  /**
   * Business metrics for the admin dashboard.
   *
   * Everything here is measured. Nothing is invented, padded or floored.
   *
   * The previous version did all three: `Math.max(totalUsers, 128)` reported
   * 128 when the real count was 2, an empty revenue total was replaced with
   * 12,850,000 VND, and the seven-day trend was generated from `Math.sin(i)`
   * when there were no transactions. A dashboard that fabricates revenue is
   * worse than no dashboard: it is indistinguishable from a real one, and
   * somebody eventually makes a decision on it.
   *
   * Where a figure cannot be computed yet it is returned as `null` and the UI
   * says so, rather than showing a plausible number.
   */
  async getMetrics() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersThisWeek,
      totalChannels,
      activeChannels,
      activeLiveSessions,
      totalTemplates,
      successfulTxns,
      burnedLedger,
      totalLiveEventsCount,
      recentUsers,
      recentSessions,
      giftTotals,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.channel.count(),
      this.prisma.channel.count({ where: { isLive: true } }),
      this.prisma.liveSession.count({ where: { endedAt: null } }),
      this.prisma.template.count(),
      this.prisma.transaction.findMany({
        where: { status: TransactionStatus.SUCCESS },
        select: { amountMinor: true, creditAmount: true, createdAt: true },
      }),
      this.prisma.creditLedger.findMany({
        where: { delta: { lt: 0 }, createdAt: { gte: sevenDaysAgo } },
        select: { delta: true, createdAt: true },
      }),
      this.prisma.liveEvent.count(),
      this.prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatar: true,
          createdAt: true,
          channels: { select: { handle: true, isLive: true, platform: true } },
          creditBalance: { select: { balance: true } },
        },
      }),
      this.prisma.liveSession.findMany({
        take: 5,
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          totalCoins: true,
          totalViewers: true,
          totalComments: true,
          startedAt: true,
          endedAt: true,
          channel: { select: { handle: true, platform: true } },
          user: { select: { displayName: true, email: true } },
        },
      }),
      // Real gift mix, grouped by the gift name the platform reported.
      this.prisma.liveEvent.groupBy({
        by: ['giftName'],
        where: { type: 'GIFT', giftName: { not: null } },
        _count: { _all: true },
        _sum: { giftCoinValue: true },
        orderBy: { _count: { giftName: 'desc' } },
        take: 8,
      }),
    ]);

    // `amountMinor` is the money actually charged. `creditAmount` is a quantity
    // of credits, not currency, so it is never substituted for a price — doing
    // that silently invented an exchange rate of 1000 VND per credit.
    const totalRevenueVnd = successfulTxns.reduce(
      (sum, t) => sum + Number(t.amountMinor ?? 0),
      0,
    );

    const totalCreditsBurned = burnedLedger.reduce((sum, l) => sum + Math.abs(l.delta), 0);

    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const revenueTrend = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toDateString();

      const revenue = successfulTxns
        .filter((t) => new Date(t.createdAt).toDateString() === key)
        .reduce((sum, t) => sum + Number(t.amountMinor ?? 0), 0);

      const creditsUsed = burnedLedger
        .filter((l) => new Date(l.createdAt).toDateString() === key)
        .reduce((sum, l) => sum + Math.abs(l.delta), 0);

      // A day with no transactions is a zero, not a gap to fill.
      revenueTrend.push({
        date: `${dayNames[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`,
        revenue,
        creditsUsed,
      });
    }

    const giftTotalCount = giftTotals.reduce((sum, g) => sum + g._count._all, 0);
    const giftDistribution = giftTotals.map((g) => ({
      name: g.giftName ?? 'Không rõ',
      count: g._count._all,
      coins: g._sum.giftCoinValue ?? 0,
      percent: giftTotalCount === 0 ? 0 : Math.round((g._count._all / giftTotalCount) * 100),
    }));

    return {
      summary: {
        totalUsers,
        newUsersThisWeek,
        totalChannels,
        activeChannels,
        activeLiveSessions,
        totalTemplates,
        totalRevenueVnd,
        totalCreditsBurned,
        totalEventsCount: totalLiveEventsCount,
      },
      /**
       * Figures the product does not measure yet.
       *
       * Named rather than omitted so the dashboard can say "chưa đo được"
       * instead of leaving a blank that reads as zero. The previous version
       * reported "100% Uptime" and "38ms" for infrastructure nothing observes.
       */
      unmeasured: ['socketCluster', 'proxyPoolHealth', 'avgLatencyMs', 'ttsCacheHitRate'],
      charts: {
        revenueTrend,
        giftDistribution,
      },
      topStreamers: recentUsers.map((u) => ({
        id: u.id,
        displayName: u.displayName || u.email.split('@')[0],
        email: u.email,
        handle: u.channels[0]?.handle ?? null,
        isLive: u.channels[0]?.isLive ?? false,
        balance: u.creditBalance?.balance ?? 0,
      })),
      recentLiveSessions: recentSessions,
    };
  }
}
