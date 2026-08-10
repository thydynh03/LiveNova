/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@livenova/shared'],

  /**
   * Let a build write somewhere other than `.next`.
   *
   * `next build` and `next dev` share `.next` by default, so running a build to
   * verify something while the dev server is up replaces the dev server's
   * chunks with production ones. The dev server keeps serving HTML that
   * references chunks that are no longer there, and the site comes back as
   * unstyled text with 404s on every CSS file — which looks like a broken
   * stylesheet, not like a clobbered build directory. It has cost us that
   * confusion twice.
   *
   * CI and deploys set nothing and get `.next` as before:
   *   NEXT_DIST_DIR=.next-verify pnpm --filter @livenova/web build
   */
  distDir: process.env.NEXT_DIST_DIR || '.next',

  /**
   * One canonical hostname, and a permanent redirect for the other.
   *
   * Serving the site at both `livenova.website` and `www.livenova.website`
   * means competing with yourself: search engines treat them as two sites,
   * split whatever authority the pages earn between them, and pick a winner on
   * their own. Which one is chosen matters far less than choosing.
   *
   * Bare domain wins here because that is what `NEXT_PUBLIC_SITE_URL`, the
   * sitemap and every canonical tag already say.
   */
  async redirects() {
    const host = (process.env.NEXT_PUBLIC_SITE_URL || '')
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
    if (!host || host.startsWith('localhost')) return [];

    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: `www.${host}` }],
        destination: `https://${host}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
