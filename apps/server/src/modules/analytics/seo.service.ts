import { Injectable, Logger } from '@nestjs/common';

/**
 * Kiểm tra SEO bằng cách thật sự tải trang về.
 *
 * Đây là điểm khác biệt đáng nói: một bảng SEO đọc mã nguồn rồi báo "có thẻ
 * title" thì luôn xanh, kể cả khi trang đang trả về 500 hoặc khi biến môi
 * trường sai làm canonical trỏ về localhost. Cái duy nhất trả lời được câu hỏi
 * "SEO có hoạt động không" là lấy đúng thứ Googlebot lấy, từ đúng địa chỉ công
 * khai, rồi đọc nó.
 *
 * Không chấm điểm tổng thành một con số. Một con số 87/100 không cho ai biết
 * phải sửa gì, và tệ hơn, nó tạo cảm giác đã xong việc.
 */

export interface PageCheck {
  path: string;
  status: number | null;
  /** Lý do không tải được, nếu có. */
  error: string | null;
  title: string | null;
  titleLength: number | null;
  description: string | null;
  descriptionLength: number | null;
  canonical: string | null;
  ogTitle: string | null;
  ogImage: string | null;
  h1Count: number;
  robotsMeta: string | null;
  /** Vấn đề tìm thấy, viết cho người đọc chứ không phải mã lỗi. */
  issues: string[];
}

/** Các trang công khai đáng để Google lập chỉ mục. */
const PUBLIC_PATHS = ['/', '/huong-dan', '/login', '/register'];

@Injectable()
export class SeoService {
  private readonly logger = new Logger(SeoService.name);

  private siteUrl(): string {
    const explicit = process.env.PUBLIC_WEB_URL;
    const firstCors = (process.env.CORS_ORIGIN ?? '').split(',')[0]?.trim();
    return (explicit || firstCors || 'http://localhost:3000').replace(/\/$/, '');
  }

  private text(html: string, re: RegExp): string | null {
    const m = html.match(re);
    return m ? m[1].trim().replace(/\s+/g, ' ') : null;
  }

  private async fetchText(url: string, timeoutMs = 10_000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        // Tự khai là công cụ kiểm tra. Giả làm Googlebot để lấy nội dung khác
        // đi là cloaking — thứ chính Google phạt.
        headers: { 'user-agent': 'LiveNova-SEO-Check/1.0' },
      });
      return { status: res.status, body: await res.text(), error: null as string | null };
    } catch (err) {
      return {
        status: null,
        body: '',
        error: err instanceof Error ? err.message : 'Không tải được',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async checkPage(base: string, path: string): Promise<PageCheck> {
    const { status, body, error } = await this.fetchText(`${base}${path}`);

    const title = this.text(body, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description = this.text(
      body,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    );
    const canonical = this.text(
      body,
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i,
    );
    const ogTitle = this.text(
      body,
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
    );
    const ogImage = this.text(
      body,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i,
    );
    const robotsMeta = this.text(
      body,
      /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i,
    );
    const h1Count = (body.match(/<h1[\s>]/gi) ?? []).length;

    const issues: string[] = [];
    if (error) {
      issues.push(`Không tải được trang: ${error}`);
    } else if (status !== 200) {
      issues.push(`Trang trả về mã ${status}, Google sẽ không lập chỉ mục`);
    } else {
      if (!title) issues.push('Thiếu thẻ <title>');
      else if (title.length > 60) issues.push(`Tiêu đề ${title.length} ký tự, bị cắt trên kết quả tìm kiếm (nên ≤ 60)`);
      else if (title.length < 15) issues.push(`Tiêu đề chỉ ${title.length} ký tự, quá ngắn để mô tả trang`);

      if (!description) issues.push('Thiếu meta description');
      else if (description.length > 160) issues.push(`Mô tả ${description.length} ký tự, bị cắt (nên ≤ 160)`);
      else if (description.length < 50) issues.push(`Mô tả chỉ ${description.length} ký tự, quá ngắn`);

      if (!canonical) issues.push('Thiếu link canonical');
      else if (/localhost|127\.0\.0\.1/.test(canonical)) {
        issues.push(`Canonical trỏ về ${canonical} — sai biến môi trường, Google sẽ bỏ qua trang`);
      }

      if (!ogTitle) issues.push('Thiếu og:title — link chia sẻ lên Facebook/Zalo sẽ trống');
      if (!ogImage) issues.push('Thiếu og:image — link chia sẻ không có ảnh');

      if (h1Count === 0) issues.push('Không có thẻ <h1>');
      else if (h1Count > 1) issues.push(`Có ${h1Count} thẻ <h1>, nên chỉ một`);

      if (robotsMeta && /noindex/i.test(robotsMeta)) {
        issues.push(`Trang tự đánh dấu noindex ("${robotsMeta}")`);
      }
    }

    return {
      path,
      status,
      error,
      title,
      titleLength: title?.length ?? null,
      description,
      descriptionLength: description?.length ?? null,
      canonical,
      ogTitle,
      ogImage,
      h1Count,
      robotsMeta,
      issues,
    };
  }

  async audit() {
    const base = this.siteUrl();

    const [pages, robots, sitemap] = await Promise.all([
      Promise.all(PUBLIC_PATHS.map((p) => this.checkPage(base, p))),
      this.fetchText(`${base}/robots.txt`),
      this.fetchText(`${base}/sitemap.xml`),
    ]);

    const sitemapUrls = (sitemap.body.match(/<loc>([^<]+)<\/loc>/gi) ?? []).length;

    const robotsIssues: string[] = [];
    if (robots.status !== 200) {
      robotsIssues.push(`robots.txt trả về ${robots.error ?? robots.status}`);
    } else {
      if (!/sitemap:/i.test(robots.body)) {
        robotsIssues.push('robots.txt không khai báo Sitemap');
      }
      // `Disallow: /` chặn toàn bộ site. Đây là lỗi tốn nhiều tháng nhất để
      // phát hiện, vì mọi thứ khác vẫn xanh trong khi không trang nào lên
      // được kết quả tìm kiếm.
      if (/^\s*disallow:\s*\/\s*$/im.test(robots.body)) {
        robotsIssues.push('robots.txt đang chặn TOÀN BỘ trang (Disallow: /)');
      }
    }

    const sitemapIssues: string[] = [];
    if (sitemap.status !== 200) {
      sitemapIssues.push(`sitemap.xml trả về ${sitemap.error ?? sitemap.status}`);
    } else if (sitemapUrls === 0) {
      sitemapIssues.push('sitemap.xml không chứa URL nào');
    }

    // Trang nằm trong sitemap mà không trang nào trỏ tới thì Google coi là ít
    // quan trọng — cùng lý do trang chủ có khối liên kết tới bộ hướng dẫn.
    const sitemapPaths = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/gi)]
      .map((m) => {
        try {
          return new URL(m[1]).pathname;
        } catch {
          return null;
        }
      })
      .filter((p): p is string => p != null);

    const notChecked = sitemapPaths.filter((p) => !PUBLIC_PATHS.includes(p));

    return {
      baseUrl: base,
      checkedAt: new Date().toISOString(),
      /** Nếu đúng bằng localhost thì mọi kết luận bên dưới là về máy chủ, không phải về trang thật. */
      baseUrlIsLocal: /localhost|127\.0\.0\.1/.test(base),
      pages,
      robots: {
        status: robots.status,
        declaresSitemap: /sitemap:/i.test(robots.body),
        issues: robotsIssues,
      },
      sitemap: {
        status: sitemap.status,
        urlCount: sitemapUrls,
        issues: sitemapIssues,
      },
      /** URL có trong sitemap nhưng bảng này chưa kiểm — nói rõ thay vì lờ đi. */
      notChecked,
      totalIssues:
        pages.reduce((n, p) => n + p.issues.length, 0) +
        robotsIssues.length +
        sitemapIssues.length,
    };
  }
}
