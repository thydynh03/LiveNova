import { GUIDES, guideBySlug } from './guides';

/**
 * Với chín bài, rủi ro đã đổi.
 *
 * Lúc có bốn bài thì cái đáng lo là thiếu nội dung. Từ đây trở đi cái đáng lo là
 * hai bài của chính mình cùng nhắm một truy vấn: Google phải chọn một trong hai,
 * thường chọn sai, và cả hai cùng xếp thấp hơn so với khi chỉ có một. Không có
 * cảnh báo nào cho chuyện đó — nó chỉ hiện ra dưới dạng thứ hạng không lên.
 */
describe('bộ bài hướng dẫn', () => {
  it('không có hai bài nào nhắm cùng một truy vấn', () => {
    const seen = new Map<string, string>();

    for (const g of GUIDES) {
      const key = g.targetQuery.trim().toLowerCase();
      const truoc = seen.get(key);
      expect(truoc ? `${truoc} và ${g.slug} cùng nhắm "${key}"` : null).toBeNull();
      seen.set(key, g.slug);
    }
  });

  it('slug không trùng', () => {
    // Trùng slug nghĩa là một bài không bao giờ mở được: `guideBySlug` trả về
    // bài đầu tiên, còn bài kia vẫn nằm trong sitemap và dẫn Google tới một
    // trang hiển thị nội dung của bài khác.
    expect(new Set(GUIDES.map((g) => g.slug)).size).toBe(GUIDES.length);
  });

  it('mỗi slug mở được đúng bài của nó', () => {
    for (const g of GUIDES) {
      expect(guideBySlug(g.slug)?.title).toBe(g.title);
    }
  });

  it('tiêu đề đủ ngắn để không bị cắt trên kết quả tìm kiếm', () => {
    // Google cắt tiêu đề quanh 60 ký tự. Một tiêu đề bị cắt giữa chừng vẫn xếp
    // hạng như thường, nhưng người đọc thấy một câu cụt và ít bấm vào hơn.
    // Báo kèm slug khi đỏ: với chín bài, "60 < 64" một mình không cho biết phải
    // sửa bài nào.
    const qua_dai = GUIDES.filter((g) => g.title.length > 60).map(
      (g) => `${g.slug} (${g.title.length})`,
    );
    expect(qua_dai).toEqual([]);
  });

  it('mô tả nằm trong khoảng Google hiển thị', () => {
    for (const g of GUIDES) {
      // Ngắn quá thì Google tự bịa đoạn mô tả từ nội dung trang; dài quá thì bị
      // cắt. Khoảng này là chỗ đoạn mình viết được dùng nguyên văn.
      expect(g.description.length).toBeGreaterThanOrEqual(70);
      expect(g.description.length).toBeLessThanOrEqual(165);
    }
  });

  it('mỗi bài có nội dung thật, không phải vỏ rỗng', () => {
    for (const g of GUIDES) {
      expect(g.sections.length).toBeGreaterThanOrEqual(2);
      expect(g.faq.length).toBeGreaterThanOrEqual(2);
      for (const s of g.sections) {
        expect(s.paragraphs.join('').length).toBeGreaterThan(120);
      }
    }
  });
});
