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
          { name: 'Thêm overlay media vào OBS', text: 'Tiếng đọc phát ra từ overlay media, nên thêm nó vào OBS như một Browser Source và bật tiếng cho nguồn đó.' },
        ],
      },
      {
        heading: 'Không cần cài phần mềm nào',
        paragraphs: [
          'Cả hình lẫn tiếng đều chạy trong OBS qua Browser Source. Overlay media vừa hiện hiệu ứng vừa phát giọng đọc, nên bạn chỉ cần thêm đúng một nguồn và nhớ bật tiếng cho nó — trong OBS, Browser Source có tuỳ chọn tắt tiếng riêng và nó là lý do phổ biến nhất khiến người ta không nghe thấy gì.',
        ],
        note: 'Ứng dụng máy tính là thứ khác và không liên quan tới giọng đọc: nó dùng khi bạn muốn quà của người xem bấm phím vào một trò chơi đang chạy trên máy bạn.',
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
          {
            name: 'Bỏ tick "Shutdown source when not visible"',
            text: 'Trong cửa sổ thuộc tính của Browser Source, bỏ dấu tick ở ô "Shutdown source when not visible" (bản tiếng Việt: "Tắt nguồn khi không hiển thị"). Ô này bật sẵn.',
          },
          { name: 'Kéo vào đúng vị trí', text: 'Kéo lớp overlay lên trên nguồn camera trong danh sách Sources.' },
        ],
        note: 'Kích thước 1080×1920 là bắt buộc, không phải gợi ý — xem phần dưới.',
      },
      {
        heading: 'Ô tick khiến trận đấu tự về 0 mỗi lần đổi cảnh',
        paragraphs: [
          'OBS bật sẵn "Shutdown source when not visible". Nghĩa là mỗi lần bạn chuyển sang cảnh khác, OBS đóng hẳn trang overlay; khi bạn quay lại, nó mở một trang mới tinh. Trang mới không biết gì về những gì vừa xảy ra.',
          'Hậu quả thấy được là trận đấu về lại vạch xuất phát giữa buổi live, ngay sau một lần chuyển cảnh — thường là lúc bạn vừa cắt qua cảnh "sắp bắt đầu" rồi quay lại. Quà người xem vừa tặng biến mất cùng với nó.',
          'Đây là loại lỗi gần như không ai tự tìm ra, vì chỗ hỏng và chỗ biểu hiện cách nhau quá xa: bạn thấy game reset, còn nguyên nhân là một ô tick trong hộp thoại thuộc tính bạn mở một lần rồi không mở lại nữa. Bỏ tick nó ngay từ đầu, và bỏ cho mọi cảnh có chứa overlay.',
        ],
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
        a: 'Không. Cả hiệu ứng lẫn giọng đọc đều chạy trong OBS qua Browser Source. Ứng dụng máy tính chỉ cần khi bạn muốn quà bấm phím vào một trò chơi trên máy bạn.',
      },
      {
        q: 'Có cần stream key của TikTok không?',
        a: 'Không, và bạn cũng không cần lấy được nó. LiveNova không đẩy hình đi đâu cả: bạn vẫn LIVE như bình thường bằng điện thoại hoặc TikTok LIVE Studio, còn overlay chỉ là một lớp hiển thị nằm trong OBS trên máy bạn. Phần kết nối TikTok chỉ đọc bình luận và quà theo tên kênh — một chiều, không đụng gì tới luồng phát.',
      },
      {
        q: 'Overlay tự về 0 giữa buổi live thì sao?',
        a: 'Gần như chắc chắn là ô "Shutdown source when not visible" trong Browser Source còn được tick. Mỗi lần đổi cảnh, OBS đóng trang overlay và mở lại một trang mới, nên trạng thái trận đấu mất theo. Bỏ tick ô đó ở mọi cảnh có chứa overlay.',
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
    readingMinutes: 6,
    // Thêm mục về ô "Shutdown source when not visible" và hai câu hỏi thường
    // gặp. Bài dài thêm một mục thật mà ngày vẫn đứng yên thì `lastmod` trong
    // sitemap nói dối đúng vào lần nó có tin để báo.
    updated: '2026-08-11',
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
          'Không nghe thấy giọng đọc: giọng đọc phát từ overlay media, và Browser Source trong OBS có tuỳ chọn tắt tiếng riêng. Kiểm nguồn đó chưa bị tắt tiếng, và kiểm trong Audio Mixer xem nó có lên vạch không.',
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

  {
    slug: 'tool-ho-tro-livestream-tiktok',
    title: 'Tool hỗ trợ livestream TikTok gồm những gì',
    targetQuery: 'tool hỗ trợ livestream tiktok',
    description:
      'Các loại công cụ hỗ trợ livestream TikTok, cái nào giải quyết việc gì, và cách chọn theo kiểu kênh bạn đang làm.',
    intro:
      '"Tool hỗ trợ livestream" là một cái tên chung cho bốn nhóm công cụ giải quyết bốn vấn đề khác hẳn nhau. Chọn nhầm nhóm thì bạn trả tiền cho thứ không giải quyết vấn đề mình đang có, nên bài này tách chúng ra trước khi nói tới sản phẩm nào.',
    sections: [
      {
        heading: 'Bốn nhóm, bốn vấn đề khác nhau',
        paragraphs: [
          'Phần mềm phát sóng — OBS, Streamlabs, TikTok LIVE Studio. Chúng lo việc đưa hình và tiếng lên nền tảng. Miễn phí, và bạn cần đúng một cái.',
          'Công cụ tương tác — đọc bình luận thành giọng nói, hiệu ứng khi có quà, trò chơi cho người xem tham gia. Chúng không đụng tới luồng phát; chúng thêm một lớp hiển thị vào buổi live và phản ứng theo bình luận cùng quà tặng.',
          'Công cụ quản lý — lịch phát, thống kê, trả lời tin nhắn. Dùng ngoài giờ live nhiều hơn trong lúc live.',
          'Công cụ dựng nội dung — cắt video, làm ảnh nền, hình động. Dùng trước buổi live.',
        ],
        note: 'LiveNova nằm ở nhóm thứ hai. Nó không thay OBS và không cần bạn bỏ OBS.',
      },
      {
        heading: 'Chọn theo vấn đề đang có, không theo danh sách tính năng',
        paragraphs: [
          'Nếu buổi live của bạn im lặng vì bạn vừa nói vừa đọc bình luận không xuể, thứ cần là công cụ đọc bình luận tự động.',
          'Nếu người xem tặng quà mà trên màn hình không có gì xảy ra, thứ cần là hiệu ứng gắn với quà — và đó cũng là thứ khiến người khác muốn tặng tiếp, vì họ thấy quà của mình có tác dụng nhìn được.',
          'Nếu người xem vào rồi ra sau vài giây, vấn đề không phải công cụ mà là chưa có lý do để ở lại. Một trò chơi mà người xem tham gia bằng bình luận và quà là cách trực tiếp nhất để tạo lý do đó.',
        ],
      },
      {
        heading: 'Ba câu nên hỏi trước khi cài bất cứ thứ gì',
        paragraphs: [
          'Nó có đòi mật khẩu TikTok của bạn không? Không công cụ tương tác nào cần điều đó. Nó chỉ cần tên kênh để đọc bình luận công khai.',
          'Nó có đòi stream key không? Cũng không. Bạn vẫn LIVE như bình thường; công cụ chỉ thêm một lớp hiển thị vào OBS.',
          'Nó cài thêm gì vào máy? Một số bộ cài kéo theo cả runtime và trình chạy nền mà không hỏi. Đọc kỹ trước khi bấm đồng ý.',
        ],
      },
    ],
    faq: [
      {
        q: 'Tool hỗ trợ livestream TikTok có bị khoá kênh không?',
        a: 'Công cụ chỉ đọc bình luận công khai và hiển thị hiệu ứng trên máy bạn thì không can thiệp gì vào nền tảng. Thứ có rủi ro là công cụ hứa tăng mắt xem ảo hoặc tự động tương tác thay bạn — đó là vi phạm điều khoản, và khác hẳn nhóm công cụ nói trong bài này.',
      },
      {
        q: 'Có cần máy cấu hình cao không?',
        a: 'Máy chạy được OBS ở khổ dọc là đủ. Lớp overlay chạy trong trình duyệt nhúng của OBS và tốn ít hơn nhiều so với bản thân việc mã hoá video.',
      },
      {
        q: 'Dùng đồng thời nhiều công cụ được không?',
        a: 'Được, miễn mỗi cái là một Browser Source riêng trong OBS. Cái tốn tài nguyên nhất vẫn là bộ mã hoá, nên thêm lớp hiển thị thứ hai thường không phải chỗ gây giật.',
      },
    ],
    readingMinutes: 5,
    updated: '2026-08-11',
  },

  {
    slug: 'game-livestream-tiktok',
    title: 'Game livestream TikTok cho người xem cùng chơi',
    targetQuery: 'game livestream tiktok',
    description:
      'Các kiểu game livestream TikTok, người xem tham gia bằng bình luận và quà tặng, và cách dựng một trò chơi giữ chân người xem.',
    intro:
      'Game livestream TikTok không phải bạn chơi game cho người ta xem. Nó là trò chơi mà chính người xem tham gia bằng bình luận và quà tặng, ngay trong khung live — nên người vừa vào có việc để làm trong mười giây đầu, thay vì chỉ ngồi nhìn.',
    sections: [
      {
        heading: 'Ba kiểu phổ biến',
        paragraphs: [
          'Chia phe. Người xem chọn một bên bằng bình luận, quà tặng cộng sức mạnh cho phe đó, và có một kết quả rõ ràng lúc kết trận. Kiểu này giữ người lâu nhất vì nó tạo ra phe phái, và người ta ở lại để xem phe mình có thắng không.',
          'Vào sân. Bình luận một từ khoá là nhân vật của bạn xuất hiện trên màn hình mang tên bạn. Đơn giản, dễ hiểu, hiệu quả tức thì — nhưng hết nhanh, vì sau khi vào rồi thì không còn gì để làm.',
          'Quà kích hoạt hiệu ứng. Mỗi món quà gọi một hiệu ứng riêng. Đây không hẳn là trò chơi, nhưng nó là nền của mọi kiểu trên: cảm giác quà của mình có tác dụng nhìn thấy được.',
        ],
      },
      {
        heading: 'Vì sao kiểu chia phe giữ người lâu hơn',
        paragraphs: [
          'Vào sân cho người xem một khoảnh khắc; chia phe cho họ một lý do quay lại xem tiếp. Khi đã chọn phe thì mỗi món quà của người khác cũng thành chuyện của mình, và người ta ở lại tới lúc biết kết quả.',
          'Nó cũng cho streamer thứ để nói. Một buổi live có tỉ số đang thay đổi thì luôn có chuyện để bình luận, còn một màn hình chỉ có hiệu ứng nổ thì sau mười phút là hết chuyện.',
        ],
        note: 'LiveNova làm kiểu chia phe với bốn vương quốc — xem bài riêng về game 4 phe.',
      },
      {
        heading: 'Luật phải nói được trong một câu',
        paragraphs: [
          'Người xem TikTok quyết định ở lại hay lướt tiếp trong vài giây, và họ không đọc bảng hướng dẫn. Nếu luật chơi cần hai câu để giải thích thì phần lớn người vào sẽ không bao giờ tham gia.',
          '"Gõ tên phe để tham gia, tặng quà để phe mạnh lên" là một câu. Nó đủ để một người vừa lướt vào hiểu và bình luận ngay, và đó là toàn bộ mục tiêu của mười giây đầu.',
        ],
      },
      {
        heading: 'Sân trống là vấn đề lớn nhất lúc mới bắt đầu',
        paragraphs: [
          'Một trò chơi chưa có ai tham gia trông không giống một trò chơi đang chờ người — nó trông như phần mềm hỏng. Và không ai muốn là người đầu tiên bước vào một chỗ trống, nên sân trống tự nó giữ cho sân tiếp tục trống.',
          'Cách xử lý là để bản đồ luôn có chuyển động ngay cả khi chưa có ai: vài đơn vị đi lại làm nền, và chúng lui đi ngay khi có người thật tham gia. Đây là dàn cảnh cho khung hình, không phải tên người bịa trong bảng xếp hạng — hai chuyện đó khác nhau, và chỉ chuyện thứ hai mới là lừa người xem.',
        ],
      },
    ],
    faq: [
      {
        q: 'Người xem cần cài gì để chơi không?',
        a: 'Không. Họ chỉ bình luận và tặng quà như bình thường trong khung live TikTok. Mọi thứ khác chạy trên máy của streamer.',
      },
      {
        q: 'Game hiện trong khung live bằng cách nào?',
        a: 'Qua OBS: trò chơi là một trang web thêm vào dưới dạng Browser Source, đặt đè lên hình của bạn. Nhớ bỏ tick "Shutdown source when not visible", nếu không trận đấu sẽ về 0 mỗi lần bạn đổi cảnh.',
      },
      {
        q: 'Không có quà thì chơi được không?',
        a: 'Được. Bình luận đủ để tham gia và chọn phe; quà chỉ làm cho tác động mạnh hơn. Một trò chơi chỉ chơi được khi bỏ tiền sẽ mất phần lớn người xem ngay từ đầu.',
      },
    ],
    readingMinutes: 6,
    updated: '2026-08-11',
  },

  {
    slug: 'live-tiktok-khong-can-stream-key',
    title: 'Live TikTok không cần stream key có được không',
    targetQuery: 'live tiktok không cần stream key',
    description:
      'Vì sao TikTok không cho bạn stream key, và cách vẫn dùng được overlay cùng hiệu ứng khi live bằng điện thoại hoặc TikTok LIVE Studio.',
    intro:
      'Rất nhiều người dừng lại ở đúng chỗ này: muốn dùng overlay nhưng TikTok không đưa stream key, và OBS thì đòi có nó mới phát được. Câu trả lời ngắn là bạn không cần stream key để dùng overlay — hai chuyện đó tách rời nhau.',
    sections: [
      {
        heading: 'Vì sao bạn không thấy stream key',
        paragraphs: [
          'TikTok chỉ mở phát sóng từ phần mềm ngoài cho một số tài khoản, và điều kiện thay đổi theo thời điểm cùng khu vực. Nếu tài khoản của bạn chưa được mở, mục lấy stream key sẽ không xuất hiện — không phải bạn tìm sai chỗ.',
          'Điều quan trọng: stream key chỉ liên quan tới việc *đưa hình lên TikTok*. Nó không liên quan gì tới việc *có overlay trong hình* hay không.',
        ],
      },
      {
        heading: 'Hai đường tách rời nhau',
        paragraphs: [
          'Đường thứ nhất là luồng phát: điện thoại hoặc TikTok LIVE Studio đưa hình lên TikTok. Đường này cần stream key chỉ khi bạn phát từ OBS.',
          'Đường thứ hai là dữ liệu sự kiện: công cụ tương tác đọc bình luận và quà tặng theo tên kênh công khai của bạn. Một chiều, chỉ đọc, và không cần bất cứ khoá nào.',
          'Overlay nằm ở đường thứ hai. Nó là một trang web hiển thị trong OBS trên máy bạn, phản ứng theo dữ liệu sự kiện — hoàn toàn không đụng tới đường thứ nhất.',
        ],
      },
      {
        heading: 'Cách làm khi không có stream key',
        paragraphs: [
          'Bạn dựng cảnh trong OBS như bình thường, rồi dùng chính TikTok LIVE Studio để phát, chọn OBS làm nguồn hình qua tính năng camera ảo. Hoặc phát bằng điện thoại và dùng máy tính làm màn hình phụ có overlay.',
        ],
        steps: [
          { name: 'Dựng cảnh trong OBS', text: 'Thêm camera, hình nền và lớp overlay ở khổ dọc 1080×1920.' },
          { name: 'Bật camera ảo', text: 'Trong OBS bấm "Start Virtual Camera".' },
          { name: 'Chọn nguồn trong TikTok LIVE Studio', text: 'Chọn camera ảo của OBS làm nguồn hình, thay vì webcam.' },
          { name: 'Bắt đầu LIVE', text: 'Phát từ TikTok LIVE Studio như bình thường — không cần stream key ở bước nào.' },
        ],
        note: 'Cách này không phải mẹo lách. Nó chỉ dùng đúng những gì cả hai phần mềm đều cung cấp sẵn.',
      },
    ],
    faq: [
      {
        q: 'Vậy overlay có cần stream key không?',
        a: 'Không, ở bất kỳ trường hợp nào. Overlay chỉ hiển thị trong OBS trên máy bạn, và phần kết nối TikTok chỉ đọc bình luận theo tên kênh.',
      },
      {
        q: 'Camera ảo có làm giảm chất lượng hình không?',
        a: 'Có thêm một bước xử lý nên máy yếu sẽ tốn hơn, nhưng chất lượng hình do cấu hình trong OBS quyết định. Đặt khổ dọc và độ phân giải đúng thì khác biệt gần như không thấy được.',
      },
      {
        q: 'Khi nào thì nên xin quyền phát từ phần mềm ngoài?',
        a: 'Khi bạn cần cảnh phức tạp, nhiều nguồn hình hoặc chuyển cảnh mượt. Còn nếu chỉ cần overlay và hiệu ứng quà thì cách camera ảo đã đủ và không phải chờ duyệt.',
      },
    ],
    readingMinutes: 5,
    updated: '2026-08-11',
  },

  {
    slug: 'overlay-obs-bi-reset-khi-doi-canh',
    title: 'Overlay OBS bị reset khi đổi cảnh — cách sửa',
    targetQuery: 'overlay obs bị reset khi đổi cảnh',
    description:
      'Overlay hoặc game trong OBS về lại trạng thái đầu mỗi lần chuyển cảnh. Nguyên nhân là một ô tick bật sẵn trong Browser Source.',
    intro:
      'Bạn đang live, chuyển sang cảnh khác vài giây rồi quay lại, và overlay về lại như lúc mới mở: tỉ số về 0, trận đấu bắt đầu lại, quà người xem vừa tặng biến mất. Đây gần như luôn là cùng một nguyên nhân, và nó không nằm trong overlay.',
    sections: [
      {
        heading: 'Nguyên nhân',
        paragraphs: [
          'OBS bật sẵn ô "Shutdown source when not visible" cho Browser Source. Khi cảnh chứa overlay không còn hiển thị, OBS đóng hẳn trang web đó. Lúc bạn quay lại, nó mở một trang mới tinh — và trang mới không biết gì về những gì vừa xảy ra.',
          'Tuỳ chọn này có lý do tồn tại: nó giải phóng tài nguyên cho những nguồn nặng bạn ít dùng. Nhưng với một overlay giữ trạng thái theo thời gian thực thì nó chính là thứ xoá sạch trạng thái đó.',
        ],
      },
      {
        heading: 'Cách sửa',
        paragraphs: [
          'Bỏ tick ô đó, và bỏ ở mọi cảnh có chứa overlay — trong OBS, cùng một overlay đặt ở hai cảnh có thể là hai nguồn riêng với hai cấu hình riêng.',
        ],
        steps: [
          { name: 'Mở thuộc tính', text: 'Nhấp chuột phải vào Browser Source của overlay, chọn Properties (Thuộc tính).' },
          { name: 'Bỏ tick', text: 'Bỏ dấu tick ở "Shutdown source when not visible" (bản tiếng Việt: "Tắt nguồn khi không hiển thị").' },
          { name: 'Kiểm tra ô còn lại', text: 'Ô "Refresh browser when scene becomes active" cũng phải bỏ tick — nó gây đúng triệu chứng đó theo một đường khác.' },
          { name: 'Làm cho từng cảnh', text: 'Lặp lại cho mọi cảnh có overlay, hoặc dùng lại cùng một nguồn qua "Add Existing" thay vì tạo nguồn mới.' },
        ],
      },
      {
        heading: 'Nếu vẫn bị reset sau khi đã bỏ tick',
        paragraphs: [
          'Kiểm xem bạn có vô tình tạo hai Browser Source cùng một link ở hai cảnh khác nhau không. Mỗi nguồn là một trang riêng, nên chúng có hai trạng thái riêng và bạn sẽ thấy tỉ số nhảy qua lại khi đổi cảnh.',
          'Nếu overlay reset ngay cả khi không đổi cảnh, nguyên nhân nằm ở chỗ khác: mạng chập chờn làm mất kết nối thời gian thực, hoặc link đã bị cắt mất phần mã ở cuối lúc dán.',
        ],
      },
    ],
    faq: [
      {
        q: 'Bỏ tick thì có tốn tài nguyên hơn không?',
        a: 'Có, nhưng rất ít: trang overlay vẫn chạy khi cảnh không hiển thị. So với việc mã hoá video thì phần này nhỏ, và đổi lại bạn không mất trạng thái giữa buổi live.',
      },
      {
        q: 'Game trong overlay có lưu lại nếu tôi đóng OBS không?',
        a: 'Trạng thái trận đấu do máy chủ giữ, nên đóng rồi mở lại OBS thì overlay nối lại vào trận đang chạy. Cái mà ô tick kia phá là kết nối thời gian thực trong lúc live, không phải dữ liệu.',
      },
    ],
    readingMinutes: 4,
    updated: '2026-08-11',
  },
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
