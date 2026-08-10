import type { Metadata } from 'next';
import { SITE_NAME } from '../../lib/site';

/**
 * `page.tsx` is a Client Component and Next only reads `metadata` from a Server
 * Component, so this layout carries it.
 *
 * Indexable, unlike the token flows next door: "livenova đăng nhập" is a real
 * navigational query, and the sign-in page is the honest answer to it.
 */
export const metadata: Metadata = {
  title: 'Đăng nhập',
  description: `Đăng nhập ${SITE_NAME} để quản lý kênh, luật quà tặng và overlay OBS cho buổi livestream TikTok.`,
  alternates: { canonical: '/login' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
