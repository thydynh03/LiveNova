/**
 * Hướng dẫn — nội dung, không phải trang.
 *
 * Tách khỏi component vì ba chỗ cùng đọc: trang bài viết, trang danh sách, và
 * `sitemap.ts`. Một sitemap viết tay sẽ lệch khỏi danh sách bài ngay lần thêm
 * bài thứ hai, và cái lệch đó im lặng — Google vẫn nhận sitemap, chỉ là thiếu
 * bài mới.
 *
 * Mỗi bài nhắm một truy vấn thật của streamer Việt. Trang chủ không thể xếp
 * hạng cho những truy vấn đó: nó có ~500 chữ và phải nói về cả sản phẩm cùng
 * lúc, trong khi người tìm "cách đọc bình luận tự động khi live tiktok" đang
 * hỏi đúng một câu và muốn đúng một câu trả lời.
 *
 * Nội dung mô tả đúng thứ sản phẩm làm được hôm nay. Một bài hướng dẫn hứa hẹn
 * tính năng không tồn tại sẽ được Google xếp hạng đúng một lần, rồi người đọc
 * rời trang trong mười giây và thứ hạng đó biến mất.
 */

export interface GuideStep {
  name: string;
  text: string;
}

export interface GuideSection {
  heading: string;
  paragraphs: string[];
  steps?: GuideStep[];
  note?: string;
}

export interface Guide {
  slug: string;
  /** Dùng cho thẻ <title>. Giữ dưới 60 ký tự để không bị cắt trên kết quả tìm kiếm. */
  title: string;
  /** Câu người ta thật sự gõ vào Google. Ghi ra để lần sau không ai đoán lại. */
  targetQuery: string;
  description: string;
  /** Câu mở đầu, cũng là đoạn Google hay trích làm mô tả. */
  intro: string;
  sections: GuideSection[];
  faq: { q: string; a: string }[];
  /** Phút đọc, ước lượng thô cho người đọc chứ không phải cho máy. */
  readingMinutes: number;
  updated: string;
}

export const GUIDES: Guide[] = [
  {
    slug: 'doc-binh-luan-tu-dong-khi-live-tiktok',
    title: 'Cách đọc bình luận tự động khi live TikTok',
    targetQuery: 'cách đọc bình luận tự động khi live tiktok',
    description:
      'Hướng dẫn để bình luận của người xem được đọc lên bằng giọng nói ngay trong lúc bạn đang live TikTok, không cần rời mắt khỏi camera.',
    intro:
      'Vấn đề của việc đọc bình luận bằng mắt không phải là đọc chậm. Là bạn phải rời mắt khỏi camera. Khán giả thấy bạn nhìn đi chỗ khác, nhịp buổi live gãy, và những bình luận đến trong lúc bạn đang cúi xuống thì trôi mất luôn.',
    sections: [
      {
        heading: 'Cách hoạt động',
        paragraphs: [
          'Hệ thống nối vào phòng live TikTok của bạn qua tên tài khoản, nhận bình luận theo thời gian thực, rồi chuyển thành giọng nói phát ra trong lúc bạn đang diễn. Bạn nghe được nội dung mà không cần nhìn khung chat.',
          'Bạn đặt luật cho phần này: đọc mọi bình luận, hay chỉ đọc của người đã tặng quà, hay chỉ đọc bình luận chứa từ khoá nhất định. Một phòng live đông thì đọc tất cả sẽ thành tiếng ồn — lọc lại là việc nên làm ngay từ đầu.',
        ],
        steps: [
          { name: 'Nối kênh', text: 'Vào mục Kênh trong bảng điều khiển, thêm tên tài khoản TikTok của bạn.' },
          { name: 'Bật đọc bình luận', text: 'Vào mục Giọng đọc, chọn giọng và tốc độ đọc.' },
          { name: 'Đặt luật lọc', text: 'Vào mục Luật, chọn bình luận nào được đọc — tất cả, hoặc theo điều kiện.' },
          { name: 'Phát âm thanh', text: 'Chạy ứng dụng máy tính để tiếng đọc phát ra ở máy bạn và lọt vào OBS.' },
        ],
      },
      {
        heading: 'Vì sao cần ứng dụng máy tính cho phần âm thanh',
        paragraphs: [
          'Overlay hình ảnh chạy thẳng trong OBS qua Browser Source, không cần cài gì. Nhưng âm thanh thì khác: OBS không lấy được tiếng phát ra từ một Browser Source một cách đáng tin cậy trên mọi máy, nên phần đọc chạy qua ứng dụng máy tính để tiếng đi thẳng vào thiết bị âm thanh bạn chọn.',
        ],
        note: 'Nếu bạn chỉ cần hiệu ứng hình ảnh và bảng điểm, không cần giọng đọc, thì không phải cài gì cả.',
      },
      {
        heading: 'Chi phí',
        paragraphs: [
          'Mỗi ngày có một lượng credit miễn phí cho giọng đọc, tính theo số ký tự được đọc. Hết credit thì phần đọc dừng lại, còn overlay, hiệu ứng quà và bảng xếp hạng vẫn chạy bình thường — buổi live không hỏng, chỉ mất phần đọc.',
        ],
      },
    ],
    faq: [
      {
        q: 'Giọng đọc có tiếng Việt không?',
        a: 'Có. Giọng đọc hỗ trợ tiếng Việt, và bạn chọn được giọng cùng tốc độ đọc trong phần cài đặt.',
      },
      {
        q: 'Phòng live đông quá thì đọc có kịp không?',
        a: 'Bình luận được xếp hàng và đọc lần lượt. Khi phòng quá đông, nên đặt luật lọc để chỉ đọc bình luận của người tặng quà hoặc bình luận chứa từ khoá, nếu không tiếng đọc sẽ chồng thành tạp âm.',
      },
      {
        q: 'Hết credit thì buổi live có dừng không?',
        a: 'Không. Chỉ phần đọc bằng giọng nói dừng lại. Mọi thứ khác chạy tiếp.',
      },
    ],
    readingMinutes: 4,
    updated: '2026-08-09',
  },

  {
    slug: 'hieu-ung-qua-tang-tiktok',
    title: 'Tạo hiệu ứng khi có quà tặng TikTok',
    targetQuery: 'phần mềm hiệu ứng quà tặng tiktok',
    description:
      'Cách để mỗi món quà trên TikTok kích hoạt một hiệu ứng riêng trên sóng — video, ảnh hoặc âm thanh — để người tặng thấy phản hồi ngay lập tức.',
    intro:
      'Người tặng quà muốn thấy điều gì đó xảy ra. Nếu món quà biến mất vào khung chat mà không có gì trên màn hình đổi, họ không tặng lần thứ hai. Khoảng cách giữa lúc tặng và lúc màn hình phản ứng là thứ quyết định người đó có tặng tiếp hay không.',
    sections: [
      {
        heading: 'Một luật gồm hai vế',
        paragraphs: [
          'Mỗi luật là một cặp: điều kiện và hành động. Điều kiện là "quà nào" — theo tên quà hoặc theo giá trị coin. Hành động là "chạy gì" — phát video, hiện ảnh, phát âm thanh, hoặc kết hợp.',
          'Nên chia bậc theo giá trị quà. Quà nhỏ thì hiệu ứng ngắn một hai giây, đừng che mặt bạn. Quà lớn mới đáng một đoạn video chiếm màn hình. Nếu quà nào cũng chạy hiệu ứng to thì buổi live thành một chuỗi quảng cáo xen kẽ, và người tặng quà lớn không còn cảm giác được ưu tiên.',
        ],
        steps: [
          { name: 'Vào mục Luật', text: 'Mở bảng điều khiển, chọn mục Luật.' },
          { name: 'Chọn điều kiện', text: 'Chọn loại sự kiện là Quà tặng, rồi chọn tên quà hoặc đặt ngưỡng giá trị.' },
          { name: 'Chọn hành động', text: 'Tải lên video hoặc ảnh muốn phát, hoặc chọn từ bộ có sẵn của mẫu.' },
          { name: 'Thử trước khi lên sóng', text: 'Dùng nút thử trong bảng điều khiển để xem hiệu ứng chạy đúng chưa.' },
        ],
      },
      {
        heading: 'Định dạng video nên dùng',
        paragraphs: [
          'Video có nền trong suốt sẽ đẹp hơn hẳn video nền đen, vì nó nổi lên trên hình bạn thay vì che kín một mảng. Định dạng WebM có kênh alpha là lựa chọn chạy được trong OBS.',
          'Giữ video ngắn. Một hiệu ứng ba giây được nhớ; một hiệu ứng mười giây khiến người xem chờ cho nó hết.',
        ],
      },
    ],
    faq: [
      {
        q: 'Hiệu ứng có tốn credit không?',
        a: 'Không. Chỉ giọng đọc tốn credit. Hiệu ứng quà, overlay và bảng mục tiêu chạy không giới hạn.',
      },
      {
        q: 'Tôi tự làm video hiệu ứng được không?',
        a: 'Được. Tải lên video của bạn, ưu tiên WebM nền trong suốt để hiệu ứng nổi trên hình thay vì che mảng lớn.',
      },
      {
        q: 'Nhiều người tặng cùng lúc thì sao?',
        a: 'Hiệu ứng được xếp hàng và chạy lần lượt, không chồng lên nhau, nên không có chuyện hai video cùng tranh màn hình.',
      },
    ],
    readingMinutes: 4,
    updated: '2026-08-09',
  },

  {
    slug: 'cach-lam-overlay-obs-cho-live-tiktok',
    title: 'Cách làm overlay OBS cho live TikTok',
    targetQuery: 'cách làm overlay obs cho live tiktok',
    description:
      'Hướng dẫn thêm overlay tương tác vào OBS cho buổi live TikTok bằng Browser Source, đúng khổ dọc 1080×1920.',
    intro:
      'Overlay trong OBS chỉ là một trang web đặt đè lên hình của bạn. Hiểu đúng điều đó thì phần còn lại dễ: bạn dán một đường link vào OBS, và mọi thứ xảy ra trong buổi live sẽ tự thay đổi nội dung trang đó theo thời gian thực.',
    sections: [
      {
        heading: 'Thêm vào OBS',
        paragraphs: [
          'Overlay chạy qua Browser Source, nghĩa là không phải cài phần mềm nào thêm. Đường link chứa một mã bí mật gắn với tài khoản bạn — ai có link đó là xem được overlay của bạn, nên đừng để lộ nó lên sóng hay trong ảnh chụp màn hình.',
        ],
        steps: [
          { name: 'Lấy link overlay', text: 'Vào mục Overlay trong bảng điều khiển, bấm sao chép link OBS.' },
          { name: 'Thêm nguồn trong OBS', text: 'Trong OBS, thêm Source mới, chọn Browser.' },
          { name: 'Dán link và đặt kích thước', text: 'Dán link vào ô URL, đặt Width 1080 và Height 1920.' },
          { name: 'Kéo vào đúng vị trí', text: 'Kéo lớp overlay lên trên nguồn camera trong danh sách Sources.' },
        ],
        note: 'Kích thước 1080×1920 là bắt buộc, không phải gợi ý — xem phần dưới.',
      },
      {
        heading: 'Vì sao phải là 1080×1920 chứ không phải 1920×1080',
        paragraphs: [
          'TikTok Live là khổ dọc. Overlay được dựng cho tỉ lệ 9:16, và mọi vị trí trong đó — bảng máu, thanh tỉ số, hàng quà — được tính theo phần trăm của khung dọc.',
          'Đặt Browser Source ở khổ ngang thì trình duyệt cắt mất hai đầu trên dưới. Phần bị cắt là phần thú vị nhất: bảng thông tin trên đỉnh và hàng nút quà dưới đáy. Đây là lỗi phổ biến nhất khi dựng overlay lần đầu, và nó không báo lỗi gì cả — chỉ là thiếu.',
        ],
      },
      {
        heading: 'Overlay không cập nhật thì kiểm gì',
        paragraphs: [
          'Nếu overlay hiện ra nhưng đứng yên khi có quà, thì hình đã tải được còn kết nối thời gian thực thì chưa. Thử bấm chuột phải vào Browser Source trong OBS rồi chọn tải lại. Nếu vẫn đứng, kiểm lại xem link đã sao chép đủ chưa — mã bí mật ở cuối link rất dễ bị cắt mất khi dán.',
        ],
      },
    ],
    faq: [
      {
        q: 'Có cần cài phần mềm gì không?',
        a: 'Không. Overlay chạy thẳng trong OBS qua Browser Source. Chỉ phần đọc bình luận bằng giọng nói mới cần ứng dụng máy tính.',
      },
      {
        q: 'Link overlay lộ ra thì sao?',
        a: 'Ai có link là xem được overlay của bạn. Link không cho phép điều khiển gì, nhưng nên tạo lại link mới nếu bạn lỡ để nó lên sóng.',
      },
      {
        q: 'Dùng được cho Facebook hay YouTube không?',
        a: 'Browser Source thì nền tảng nào cũng hiện được, nhưng dữ liệu sự kiện hiện lấy từ TikTok Live.',
      },
    ],
    readingMinutes: 5,
    updated: '2026-08-09',
  },

  {
    slug: 'game-tuong-tac-live-tiktok-4-phe',
    title: 'Game tương tác live TikTok: chia 4 phe đấu nhau',
    targetQuery: 'game tương tác live tiktok 4 phe',
    description:
      'Cách dựng một trận đấu bốn vương quốc trên sóng live TikTok, nơi quà của người xem biến thành quân lính và điểm số theo thời gian thực.',
    intro:
      'Trò chơi tương tác giải quyết một vấn đề rất cụ thể: người xem không có lý do để ở lại. Khi phòng live chia phe và quà của họ đẩy phe mình lên, họ ở lại để xem phe mình có thắng không — và họ kéo bạn bè vào cho đông.',
    sections: [
      {
        heading: 'Luật chơi',
        paragraphs: [
          'Bốn vương quốc, mỗi vương quốc gắn với một nhóm quà. Người xem tặng quà nào là ủng hộ phe đó. Điểm được tính theo giá trị coin thật của món quà, không phải theo tên — nên quà càng lớn càng đẩy phe mình mạnh.',
          'Quà biến thành lính hành quân trên bản đồ, và những món quà lớn kích hoạt kỹ năng riêng như bom, rồng, đại bác. Mỗi phe có một toà thành với thanh máu; hạ hết máu thành của ba phe kia là thắng ngay, còn không thì hết giờ ai điểm cao hơn người đó thắng.',
        ],
        steps: [
          { name: 'Chọn mẫu trận đấu', text: 'Vào mục Mẫu, áp dụng mẫu trận đấu bốn vương quốc.' },
          { name: 'Gán quà cho từng phe', text: 'Mỗi phe nhận một nhóm quà. Nói rõ trên sóng để người xem biết tặng gì là theo phe nào.' },
          { name: 'Thêm overlay vào OBS', text: 'Dùng link overlay, đặt Browser Source 1080×1920.' },
          { name: 'Chạy thử trước', text: 'Dùng trình mô phỏng trong bảng điều khiển để bắn sự kiện giả và cân lại luật trước khi lên sóng.' },
        ],
      },
      {
        heading: 'Like và share cũng được tính, nhưng có trần',
        paragraphs: [
          'Người xem không tặng quà vẫn tham gia được: like, share và follow đều cộng điểm cho phe mà họ đã tặng quà gần nhất. Nhưng phần này có trần, và mỗi người có một hạn mức riêng.',
          'Lý do là nếu không có trần thì một người giữ nút tim cũng đua được với người tặng quà thật, và người bỏ tiền sẽ thấy điều đó là bất công. Trần giữ cho like là gia vị chứ không phải nguồn điểm chính.',
        ],
      },
      {
        heading: 'Khoảnh khắc kết trận',
        paragraphs: [
          'Khi trận kết thúc, overlay chạy màn ăn mừng: vương miện, tên vương quốc thắng, rồi bảng công thần — top người tặng quà của phe thắng. Đây là lúc trả công cho cả buổi, và là đoạn đáng cắt ra làm video ngắn nhất.',
        ],
      },
    ],
    faq: [
      {
        q: 'Người xem không tặng quà thì chơi được không?',
        a: 'Được. Like, share và follow đều cộng điểm cho phe họ theo, nhưng có trần để không lấn át người tặng quà thật.',
      },
      {
        q: 'Một trận kéo dài bao lâu?',
        a: 'Thời lượng đặt được trong mẫu. Trận cũng kết thúc sớm nếu một phe hạ hết máu thành của ba phe còn lại.',
      },
      {
        q: 'Tôi thử trước được không?',
        a: 'Được. Trình mô phỏng cho bạn bắn quà giả, xem lính chạy và cân lại luật mà không cần lên sóng thật.',
      },
    ],
    readingMinutes: 5,
    updated: '2026-08-09',
  },

  {
    slug: 'chuan-bi-buoi-live-tiktok-dau-tien',
    title: 'Chuẩn bị buổi live TikTok đầu tiên với OBS',
    targetQuery: 'cách live tiktok bằng obs cho người mới',
    description:
      'Danh sách việc cần làm trước buổi live TikTok đầu tiên: cấu hình OBS khổ dọc, thêm overlay, và những lỗi hay gặp trong mười phút đầu.',
    intro:
      'Hầu hết sự cố của buổi live đầu tiên không nằm ở nội dung. Chúng nằm ở ba thứ đặt sai trước khi bấm nút phát, và cả ba đều sửa được trong mười phút nếu biết trước.',
    sections: [
      {
        heading: 'Đặt OBS về khổ dọc trước tiên',
        paragraphs: [
          'Mặc định OBS là 1920×1080 ngang. TikTok Live là dọc. Nếu không đổi, mọi thứ bạn dựng sau đó đều sai vị trí, và bạn sẽ chỉnh lại từ đầu.',
        ],
        steps: [
          { name: 'Mở cài đặt video', text: 'Trong OBS, vào Settings, chọn Video.' },
          { name: 'Đặt độ phân giải', text: 'Đặt cả Base và Output thành 1080×1920.' },
          { name: 'Đặt khung hình', text: 'Đặt FPS 30 hoặc 60 tuỳ máy. Máy yếu thì 30 ổn định hơn 60 giật.' },
        ],
      },
      {
        heading: 'Thêm nguồn theo đúng thứ tự',
        paragraphs: [
          'Thứ tự lớp trong OBS quyết định cái gì che cái gì. Overlay phải nằm trên camera, nếu không nó bị hình bạn che mất và bạn sẽ tưởng overlay hỏng.',
        ],
        steps: [
          { name: 'Camera trước', text: 'Thêm nguồn camera hoặc màn hình.' },
          { name: 'Overlay sau', text: 'Thêm Browser Source với link overlay, 1080×1920.' },
          { name: 'Kéo overlay lên trên', text: 'Trong danh sách Sources, kéo overlay lên trên camera.' },
        ],
      },
      {
        heading: 'Ba lỗi hay gặp trong mười phút đầu',
        paragraphs: [
          'Overlay bị cắt mất phần trên và dưới: Browser Source đang để khổ ngang. Đặt lại 1080×1920.',
          'Overlay hiện nhưng đứng yên: kết nối thời gian thực chưa lên. Tải lại Browser Source, và kiểm xem link đã sao chép đủ mã bí mật ở cuối chưa.',
          'Không nghe thấy giọng đọc: phần đọc phát qua ứng dụng máy tính, không phải qua Browser Source. Kiểm ứng dụng đã chạy và đã chọn đúng thiết bị âm thanh.',
        ],
      },
    ],
    faq: [
      {
        q: 'Máy yếu có chạy được không?',
        a: 'Overlay tự giảm tải khi nhịp khung hình rớt, nên nó nhường tài nguyên cho phần mã hoá video thay vì tranh giành. Nhưng nếu máy yếu, hãy đặt OBS ở 30 FPS thay vì 60.',
      },
      {
        q: 'Tôi cần chuẩn bị gì trước buổi live?',
        a: 'Đặt OBS khổ dọc, thêm overlay và kiểm thứ tự lớp, chạy thử vài sự kiện bằng trình mô phỏng, và nói trước với người xem luật chơi nếu bạn dùng trò tương tác.',
      },
    ],
    readingMinutes: 5,
    updated: '2026-08-09',
  },
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
