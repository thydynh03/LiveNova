import type { Metadata } from 'next';

/**
 * Metadata for a client page.
 *
 * `page.tsx` here is a Client Component, and Next only reads a `metadata`
 * export from a Server Component — so this layout exists purely to carry it.
 *
 * A transactional step, not a landing page. Nothing here answers a search query.
 */
export const metadata: Metadata = {
  title: 'Quên mật khẩu',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
