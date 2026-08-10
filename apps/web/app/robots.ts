import type { MetadataRoute } from 'next';
import { absoluteUrl } from '../lib/site';

/**
 * Khu vực cần đăng nhập. Liệt kê một lần rồi dùng lại cho mọi nhóm bot, để
 * thêm một bot mới không kéo theo nguy cơ quên chặn một đường.
 */
const PRIVATE_PATHS = [
  // Behind auth — nothing here is useful to a crawler and some of it
  // names the user's channels.
  '/dashboard',
  '/channels',
  '/rules',
  '/tts',
  '/billing',
  // Added after an audit found four authenticated areas missing from
  // this list. `/admin` is the worst of them: the users and audit
  // screens are staff-only, and a crawler advertising their existence
  // is an invitation to probe them.
  '/admin',
  '/templates',
  '/settings',
  '/battle',
  // One-time flows reached from an emailed link. They carry a token,
  // they are worthless in results, and an indexed one is a stale link
  // that lands a searcher on an error.
  '/verify-otp',
  '/reset-password',
  '/forgot-password',
  // Overlay URLs embed a secret token. A crawler that indexed one would
  // publish a working handle to someone's live overlay.
  '/overlays/',
  // BFF auth endpoints.
  '/api/',
];

/**
 * Bot của trợ lý AI, tách theo mục đích chứ không gộp làm một.
 *
 * Nhóm này là loại **truy xuất**: chúng tải trang tại thời điểm ai đó đang hỏi,
 * rồi trả lời kèm trích dẫn và liên kết. Với một sản phẩm mới chưa ai biết tên,
 * đó là nguồn người dùng thật — nên chúng được mở đường rõ ràng thay vì chỉ dựa
 * vào luật `*`.
 *
 * Nhóm còn lại là loại **huấn luyện** (`GPTBot`, `CCBot`, `Google-Extended`):
 * chúng thu thập để luyện mô hình, không trích dẫn và không dẫn người về. Ở đây
 * không chặn chúng — nội dung này vốn là tài liệu công khai và việc mô hình
 * biết sản phẩm tồn tại là có lợi — nhưng chúng được ghi ra riêng để lần sau
 * đổi ý thì có đúng một chỗ để sửa.
 */
const AI_RETRIEVAL_BOTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'Perplexity-User',
  'Claude-SearchBot',
  'Claude-User',
  'Google-Extended',
  'Applebot-Extended',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: AI_RETRIEVAL_BOTS,
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
