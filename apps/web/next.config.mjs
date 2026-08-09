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
};

export default nextConfig;
