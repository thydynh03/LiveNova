import { Injectable } from '@nestjs/common';
import { Prisma, WebEventKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CollectEventDto } from './dto/analytics.dto';

/**
 * Lưu lượng web, đo bằng bảng của chính mình.
 *
 * Nguyên tắc giống hệt `AdminService.getMetrics`: cái gì chưa đo được thì nói
 * là chưa đo được, không thay bằng một con số hợp lý. Ở đây điều đó đặc biệt
 * quan trọng, vì báo cáo lưu lượng là thứ người ta hay đem đi khoe với nhà đầu
 * tư — một dashboard bịa số ở chỗ này gây hại xa hơn phạm vi sản phẩm.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Phân loại thiết bị từ user-agent.
   *
   * Chỉ ba nhóm, và user-agent thô không được lưu lại. Chuỗi đó đủ đặc trưng để
   * nhận ra một người qua nhiều phiên, nên giữ nó lại là đi ngược với lý do
   * bảng này không dùng Google Analytics ngay từ đầu.
   */
  private classifyDevice(userAgent: string | undefined): string | null {
    if (!userAgent) return null;
    const ua = userAgent.toLowerCase();
    if (/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|lighthouse/.test(ua)) {
      return 'bot';
    }
    if (/mobile|android|iphone|ipad|ipod/.test(ua)) return 'mobile';
    return 'desktop';
  }

  /** Chỉ giữ tên miền của nguồn giới thiệu. Xem chú thích trong schema. */
  private hostOf(referrer: string | undefined): string | null {
    if (!referrer) return null;
    try {
      return new URL(referrer).hostname || null;
    } catch {
      // Trình duyệt đôi khi gửi thẳng tên miền. Nhận, nhưng vẫn chặn độ dài.
      return referrer.slice(0, 253) || null;
    }
  }

  async collect(dto: CollectEventDto, userAgent?: string): Promise<void> {
    // Bỏ query string. Nó có thể chứa token đặt lại mật khẩu hoặc mã OTP, và
    // không có câu hỏi báo cáo nào cần tới nó.
    const path = dto.path.split('?')[0].split('#')[0].slice(0, 512) || '/';

    await this.prisma.webEvent.create({
      data: {
        kind: dto.kind as WebEventKind,
        path,
        label: dto.label ?? null,
        dwellMs: dto.dwellMs ?? null,
        referrer: this.hostOf(dto.referrer),
        device: this.classifyDevice(userAgent),
        visitorId: dto.visitorId,
      },
    });
  }

  /**
   * Báo cáo cho trang quản trị.
   *
   * `days` là cửa sổ thời gian. Bot bị loại khỏi mọi con số về người: một con
   * bot của Google đi qua 40 trang không phải là 40 lượt xem của khách, và gộp
   * chung là cách nhanh nhất để tự lừa mình về lượng truy cập.
   */
  async getReport(days: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const humans: Prisma.WebEventWhereInput = {
      createdAt: { gte: since },
      NOT: { device: 'bot' },
    };

    const [
      totalViews,
      uniqueVisitors,
      totalClicks,
      botViews,
      topPages,
      topClicks,
      referrers,
      devices,
      dwellRows,
      newUsers,
      dailyRows,
      firstEventAt,
    ] = await Promise.all([
      this.prisma.webEvent.count({ where: { ...humans, kind: 'VIEW' } }),
      this.prisma.webEvent
        .findMany({
          where: humans,
          select: { visitorId: true },
          distinct: ['visitorId'],
        })
        .then((r) => r.length),
      this.prisma.webEvent.count({ where: { ...humans, kind: 'CLICK' } }),
      this.prisma.webEvent.count({
        where: { createdAt: { gte: since }, kind: 'VIEW', device: 'bot' },
      }),
      this.prisma.webEvent.groupBy({
        by: ['path'],
        where: { ...humans, kind: 'VIEW' },
        _count: { _all: true },
        orderBy: { _count: { path: 'desc' } },
        take: 12,
      }),
      this.prisma.webEvent.groupBy({
        by: ['label'],
        where: { ...humans, kind: 'CLICK', label: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { label: 'desc' } },
        take: 12,
      }),
      this.prisma.webEvent.groupBy({
        by: ['referrer'],
        where: { ...humans, kind: 'VIEW', referrer: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { referrer: 'desc' } },
        take: 8,
      }),
      this.prisma.webEvent.groupBy({
        by: ['device'],
        where: { createdAt: { gte: since }, kind: 'VIEW' },
        _count: { _all: true },
      }),
      // Thời gian ở lại: gom theo trang ở tầng ứng dụng vì Prisma groupBy
      // không trả về trung vị, mà trung bình thì bị một tab để quên kéo lệch.
      this.prisma.webEvent.findMany({
        where: { ...humans, kind: 'LEAVE', dwellMs: { not: null, gt: 0 } },
        select: { path: true, dwellMs: true },
        take: 20_000,
      }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.webEvent.findMany({
        where: { ...humans, kind: 'VIEW' },
        select: { createdAt: true, visitorId: true },
        take: 50_000,
      }),
      this.prisma.webEvent.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    // ── Thời gian ở lại, theo trung vị ────────────────────────────────────
    //
    // Trung vị chứ không phải trung bình. Phân bố này luôn có đuôi dài về bên
    // phải — vài tab mở rồi bỏ đó — và trung bình sẽ báo "5 phút mỗi trang"
    // trong khi phần lớn người đọc 20 giây rồi đi.
    const median = (values: number[]): number | null => {
      if (values.length === 0) return null;
      const s = [...values].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
    };

    const dwellByPath = new Map<string, number[]>();
    for (const row of dwellRows) {
      if (row.dwellMs == null) continue;
      const list = dwellByPath.get(row.path) ?? [];
      list.push(row.dwellMs);
      dwellByPath.set(row.path, list);
    }

    const medianDwellMs = median(
      dwellRows.map((r) => r.dwellMs).filter((d): d is number => d != null),
    );

    // ── Chuỗi theo ngày ───────────────────────────────────────────────────
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const daily = new Map<string, { views: number; visitors: Set<string> }>();
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      daily.set(dayKey(d), { views: 0, visitors: new Set() });
    }
    for (const row of dailyRows) {
      const bucket = daily.get(dayKey(row.createdAt));
      if (!bucket) continue;
      bucket.views += 1;
      bucket.visitors.add(row.visitorId);
    }

    const viewsByPath = new Map(topPages.map((p) => [p.path, p._count._all]));

    return {
      window: { days, since: since.toISOString() },
      summary: {
        totalViews,
        uniqueVisitors,
        totalClicks,
        newUsers,
        botViews,
        medianDwellMs,
        /**
         * Tỉ lệ chỉ-xem-một-trang.
         *
         * Gọi đúng tên là "phiên một trang", không gọi là "bounce rate": bounce
         * rate theo định nghĩa của các công cụ khác còn tính cả thời gian ở
         * lại, mà cách đo đó ở đây chưa có. Dùng lại cái tên quen thuộc cho một
         * phép đo khác là cách chắc chắn để người đọc hiểu sai.
         */
        singlePageSessions: null as number | null,
      },
      /** Những gì bảng này chưa đo được — trang quản trị in đúng như vậy. */
      unmeasured: ['singlePageSessions', 'conversionRate'],
      daily: [...daily.entries()].map(([date, v]) => ({
        date,
        views: v.views,
        visitors: v.visitors.size,
      })),
      topPages: topPages.map((p) => ({
        path: p.path,
        views: p._count._all,
        medianDwellMs: median(dwellByPath.get(p.path) ?? []),
      })),
      topClicks: topClicks.map((c) => ({ label: c.label ?? 'Không rõ', clicks: c._count._all })),
      referrers: referrers.map((r) => ({
        host: r.referrer ?? 'Trực tiếp',
        views: r._count._all,
      })),
      devices: devices.map((d) => ({ device: d.device ?? 'Không rõ', views: d._count._all })),
      /** Trang có lượt xem nhưng chưa ai ở lại đủ lâu để ghi nhận LEAVE. */
      pagesWithoutDwell: [...viewsByPath.keys()].filter((p) => !dwellByPath.has(p)),
      collectingSince: firstEventAt?.createdAt.toISOString() ?? null,
    };
  }
}
