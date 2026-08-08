import type { Metadata } from 'next';

/**
 * Metadata for a client page.
 *
 * `page.tsx` here is a Client Component, and Next only reads a `metadata`
 * export from a Server Component — so this layout exists purely to carry it.
 *
 * Reached from a one-time emailed link. robots.txt only asks a crawler not to fetch it; this is what actually keeps it out of an index if the URL is shared or linked.
 */
export const metadata: Metadata = {
  title: 'Xác minh tài khoản',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
