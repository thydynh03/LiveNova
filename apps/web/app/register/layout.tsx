import type { Metadata } from 'next';
import { SITE_NAME } from '../../lib/site';

/**
 * See the note in `app/login/layout.tsx` — same reason, and the same call to
 * keep the page indexable. Sign-up is where a search for the product should
 * land when the searcher has already decided.
 */
export const metadata: Metadata = {
  title: 'Tạo tài khoản',
  description: `Tạo tài khoản ${SITE_NAME}: đọc bình luận bằng giọng nói, hiệu ứng quà tặng và overlay tương tác cho livestream TikTok.`,
  alternates: { canonical: '/register' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
