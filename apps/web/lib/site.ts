/**
 * Single source of truth for site identity, used by metadata, JSON-LD, the
 * sitemap and robots.txt.
 *
 * Keeping it in one place is what stops the canonical URL, the OG url and the
 * sitemap from drifting apart — a classic way to end up with three different
 * "official" addresses for the same page.
 */

export const SITE_NAME = 'LiveNova';

export const SITE_DESCRIPTION =
  'Tự động hoá livestream TikTok: đọc bình luận bằng giọng nói, hiệu ứng quà tặng ' +
  'và overlay tương tác cho OBS. Cấu hình một lần, chạy suốt buổi live.';

/** Absolute origin of the site. Must have no trailing slash. */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');
  return 'http://localhost:3000';
}

export function absoluteUrl(path = '/'): string {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}
