import sitemap from './sitemap';
import { GUIDES } from '../lib/guides';

/**
 * Sitemap phải nói thật về ngày sửa.
 *
 * Google bỏ qua `lastmod` của cả một trang web nếu giá trị đó thường xuyên
 * không đáng tin. Nên một ngày sai không chỉ vô dụng — nó làm hỏng luôn giá trị
 * của những ngày đúng, kể cả của các bài hướng dẫn vốn đang khai chính xác.
 */
describe('sitemap', () => {
  it('cho cùng kết quả bất kể dựng bản vào lúc nào', () => {
    const stamp = () =>
      sitemap().map((e) => `${e.url}@${e.lastModified ? new Date(e.lastModified).toISOString() : ''}`);

    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-08-11T10:00:00Z'));
      const homNay = stamp();
      // Deploy lại sau ba tháng mà không sửa một chữ nội dung nào.
      jest.setSystemTime(new Date('2026-11-20T03:00:00Z'));
      const baThangSau = stamp();

      // Đây là lỗi cũ: bốn trang tĩnh dùng `new Date()`, nên mọi lần deploy —
      // kể cả lần chỉ đụng tới ứng dụng máy tính — đều báo với Google rằng
      // trang chủ vừa đổi. Google bỏ qua `lastmod` của cả trang web nếu nó
      // thường xuyên sai, nên chuyện đó làm hỏng luôn ngày của các bài hướng
      // dẫn vốn khai đúng.
      expect(baThangSau).toEqual(homNay);
    } finally {
      jest.useRealTimers();
    }
  });

  it('mỗi bài hướng dẫn mang đúng ngày của chính nó', () => {
    const byUrl = new Map(
      sitemap().map((e) => [String(e.url), e.lastModified ? new Date(e.lastModified) : null]),
    );

    for (const guide of GUIDES) {
      const found = [...byUrl.entries()].find(([url]) => url.endsWith(`/${guide.slug}`));
      expect(found).toBeDefined();
      expect(found?.[1]?.toISOString().slice(0, 10)).toBe(guide.updated);
    }
  });

  it('trang danh sách mang ngày của bài mới nhất', () => {
    const entry = sitemap().find((e) => String(e.url).endsWith('/huong-dan'));
    const newest = GUIDES.reduce((a, g) => (g.updated > a ? g.updated : a), '0000-00-00');

    // Một hằng số riêng cho trang này sẽ lặng lẽ cũ đi ngay sau bài tiếp theo;
    // suy ra từ danh sách thì nó không thể lệch.
    expect(new Date(entry!.lastModified!).toISOString().slice(0, 10)).toBe(newest);
  });

  it('không lộ trang sau đăng nhập hay overlay có token', () => {
    const urls = sitemap().map((e) => String(e.url));

    // Overlay mang token bí mật trong URL và trang trong bảng điều khiển nằm
    // sau đăng nhập. Đưa vào sitemap là rò rỉ, không phải cơ hội xếp hạng.
    for (const url of urls) {
      expect(url).not.toMatch(/\/(dashboard|overlays|admin|settings|billing|api)\b/);
    }
  });
});
