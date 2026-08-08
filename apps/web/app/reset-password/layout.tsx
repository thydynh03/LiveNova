import type { Metadata } from 'next';

/**
 * Metadata for a client page.
 *
 * `page.tsx` here is a Client Component, and Next only reads a `metadata`
 * export from a Server Component — so this layout exists purely to carry it.
 *
 * Carries a reset token in the URL. Indexing it would publish a stale link that lands a searcher on an expired-token error.
 */
export const metadata: Metadata = {
  title: 'Đặt lại mật khẩu',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
