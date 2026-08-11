import type { MetadataRoute } from 'next';
import { absoluteUrl } from '../lib/site';
import { GUIDES } from '../lib/guides';

/**
 * Generated at build time, so it can never go stale the way a hand-written file
 * does. The audited competitor shipped a sitemap produced by a free online tool
 * in 2021 that did not even contain its flagship product page.
 *
 * Only public marketing routes belong here. Dashboard pages are behind auth and
 * overlay routes carry a secret token — indexing either would be a leak, not a
 * ranking opportunity.
 */
/**
 * Ngày sửa nội dung thật của từng trang tĩnh, khai bằng tay.
 *
 * Trước đây bốn trang này dùng `new Date()` — tức thời điểm dựng bản. Nghĩa là
 * một lần deploy chỉ đụng tới ứng dụng máy tính cũng đẩy `lastmod` của trang
 * chủ, trang đăng nhập và trang đăng ký lên ngày hôm đó, báo với Google rằng
 * chúng vừa đổi trong khi không có gì đổi cả.
 *
 * Google nói rõ: nếu `lastmod` của một trang web thường xuyên không đáng tin,
 * họ bỏ qua nó cho toàn bộ trang web. Nên một ngày tháng sai không chỉ vô dụng
 * — nó làm hỏng luôn giá trị của những ngày tháng đúng, kể cả của các bài
 * hướng dẫn vốn đang khai đúng.
 *
 * Khai bằng tay thì phải nhớ sửa. Đổi lại, quên sửa chỉ khiến một ngày bị cũ,
 * còn cách kia thì mọi ngày đều sai theo cùng một kiểu.
 */
const PAGE_UPDATED: Record<string, string> = {
  '/': '2026-08-10',
  '/login': '2026-08-10',
  '/register': '2026-08-09',
  '/huong-dan': '2026-08-09',
};

export default function sitemap(): MetadataRoute.Sitemap {
  // Trang danh sách hướng dẫn đổi mỗi khi có bài mới hoặc bài được sửa, nên
  // ngày của nó là ngày mới nhất trong số các bài — không phải một hằng số
  // riêng sẽ lặng lẽ cũ đi sau bài tiếp theo.
  const newestGuide = GUIDES.reduce(
    (latest, g) => (g.updated > latest ? g.updated : latest),
    PAGE_UPDATED['/huong-dan'],
  );

  return [
    {
      url: absoluteUrl('/'),
      lastModified: new Date(PAGE_UPDATED['/']),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: absoluteUrl('/login'),
      lastModified: new Date(PAGE_UPDATED['/login']),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      // Was missing. Sign-up is the page a searcher who has already decided is
      // looking for, and it was the only public route not listed.
      url: absoluteUrl('/register'),
      lastModified: new Date(PAGE_UPDATED['/register']),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: absoluteUrl('/huong-dan'),
      lastModified: new Date(newestGuide),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    // Derived from the guide list rather than typed out again. A hand-written
    // copy drifts on the second article added, and the drift is silent: Google
    // still accepts the sitemap, it just never learns the new page exists.
    ...GUIDES.map((guide) => ({
      url: absoluteUrl(`/huong-dan/${guide.slug}`),
      lastModified: new Date(guide.updated),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
