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

const LOCAL_FALLBACK = 'http://localhost:3000';

/**
 * Absolute origin of the site. Must have no trailing slash.
 *
 * Refuses to guess in production, because guessing wrong here is silent and
 * expensive. Everything built on this — `canonical`, `og:url`, `metadataBase`,
 * every `<loc>` in the sitemap, the `Sitemap:` and `Host:` lines in robots.txt
 * — would carry `http://localhost:3000` on the live site. Nothing errors,
 * nothing looks broken to a visitor, and Google reads canonical tags pointing at
 * an address it cannot reach. The first symptom is ranking that never arrives,
 * months later.
 *
 * So a production build with no `NEXT_PUBLIC_SITE_URL` fails at build time,
 * where somebody is watching. The check is deliberately server-only: it must
 * never throw inside a visitor's browser, where the value is already baked into
 * the bundle and a throw would blank the page instead of fixing anything.
 */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');

  if (process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
    throw new Error(
      '[site] NEXT_PUBLIC_SITE_URL chua duoc dat cho ban build production.\n' +
        'Neu de trong, sitemap, canonical va og:url se tro ve http://localhost:3000 ' +
        'tren trang that — khong bao loi, va Google se doc dia chi no khong voi toi duoc.\n' +
        'Dat vi du: NEXT_PUBLIC_SITE_URL=https://livenova.website',
    );
  }

  return LOCAL_FALLBACK;
}

export function absoluteUrl(path = '/'): string {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}
