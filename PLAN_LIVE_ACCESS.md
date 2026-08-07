# LiveNova — Kế hoạch mở rộng cho tài khoản chưa đủ 1.000 followers

**Ngày:** 2026-08-07 · **Nhánh:** `fix/ui-polish-round-2` · **Commit gốc:** `9b3fcfc`
**Nguồn:** đối chiếu trực tiếp với code trong repo + tra cứu chính sách TikTok (nguồn ở cuối file)
**Trạng thái:** đề xuất, chưa triển khai

---

## 0. TL;DR cho người chỉ đọc một đoạn

Rào cản **không nằm ở OBS**. Ngưỡng 1.000 followers gác ở *quyền LIVE*, và quyền đó áp cho cả điện thoại lẫn máy tính.

Nhưng nhóm người dùng đông nhất mà chúng ta đang mất là nhóm **đã có quyền LIVE mà không có stream key**. Nhóm này dùng được **100% sản phẩm ngay hôm nay** qua đường OBS Virtual Camera → TikTok LIVE Studio, và **không cần chúng ta viết một dòng code nào**. Thứ họ thiếu là hướng dẫn.

Vì vậy thứ tự ưu tiên là:

1. **Màn hướng dẫn thiết lập trong app** — rẻ nhất, mở khoá nhiều người nhất. Làm trước.
2. **Chế độ mobile** (`broadcastSource` + gate giao diện) — cho nhóm không dùng được máy tính.
3. **Hoãn:** lệnh audio trong app Go, vòng đời `LiveSession`.

---

## 1. Sự thật về giới hạn của nền tảng

| Điều kiện | Áp cho |
|---|---|
| 1.000 followers (thay đổi theo khu vực) | Quyền LIVE nói chung — **cả mobile lẫn PC** |
| Từ 18 tuổi | Stream key / RTMP |
| Đã có quyền LIVE | Điều kiện tiên quyết của stream key |

Hệ quả quan trọng: **không có quyền LIVE thì không live được ở đâu cả.** Nếu một tài khoản live được trên điện thoại, tức là nó *đã có* quyền LIVE, và vấn đề duy nhất còn lại là đường phát từ máy tính.

### Điều tuyệt đối không làm

Các công cụ sinh stream key ngoài luồng (ví dụ `TikTokStreamKeyGenerator` trên GitHub) **không được đưa vào dự án dưới bất kỳ hình thức nào**. Chúng vượt cơ chế kiểm soát truy cập của nền tảng, vi phạm điều khoản, và rủi ro rơi thẳng vào tài khoản của chính người dùng mà chúng ta đang muốn phục vụ. Đường Virtual Camera ở mục 2 cho kết quả tương đương mà hoàn toàn hợp lệ.

---

## 2. Ba đường phát và cách phân loại người dùng

```
                   Tài khoản có quyền LIVE?
                            │
              ┌─────────────┴─────────────┐
             KHÔNG                        CÓ
              │                            │
              ▼                            ▼
      Nộp đơn xin quyền           Có stream key không?
      hoặc đủ 1.000 follow          ┌──────┴──────┐
      (không có lời giải           CÓ            KHÔNG
       kỹ thuật nào)                │              │
                                    ▼              ▼
                             ĐƯỜNG A          ĐƯỜNG B / C
                          OBS → RTMP      Virtual Camera
                                           hoặc Streamlabs
```

### Đường A — OBS + stream key (hiện tại)

Đường mặc định của dự án. Không đổi gì.

### Đường B — OBS Virtual Camera → TikTok LIVE Studio ⭐

**Đây là phát hiện quan trọng nhất của tài liệu này.**

```
Overlay LiveNova (browser source)
        │
        ▼
   OBS Studio ──"Start Virtual Camera"──► máy thấy như một webcam
                                                  │
                                                  ▼
                                    TikTok LIVE Studio chọn webcam đó
                                                  │
                                                  ▼
                                              Lên sóng
```

- OBS từ **v26** trở lên có sẵn Virtual Camera, không cần plugin.
- LIVE Studio nhìn toàn bộ canvas OBS như một webcam thường.
- **Toàn bộ overlay của dự án đi qua được** — khung bình luận, thanh mục tiêu, thanh PK, popup quà.
- Phải để OBS chạy và Virtual Camera bật suốt buổi; tắt giữa chừng là mất hình.

#### ⚠️ Cái bẫy quyết định thành bại: Virtual Camera **không mang âm thanh**

Không tài liệu hướng dẫn phổ biến nào nhắc điều này, và nó đánh thẳng vào tính năng cốt lõi của dự án.

TTS phát ra từ trang overlay. OBS trộn được vào mixer của nó, nhưng **virtual camera chỉ truyền hình**. Kết quả: khán giả thấy overlay chạy đẹp mà **không nghe thấy gì**.

Bắt buộc phải có cáp âm thanh ảo:

```
OBS (audio mixer, có TTS)
        │
        ▼
VB-Audio Cable / VoiceMeeter  (miễn phí)
        │
        ▼
LIVE Studio chọn cable đó làm micro
```

Muốn có **cả** giọng thật lẫn TTS thì phải dùng VoiceMeeter để trộn, vì một ngõ micro chỉ nhận được một thiết bị.

Đây là bước mà người dùng chắc chắn vấp, và là lý do chính khiến màn hướng dẫn ở mục 4 đáng làm.

### Đường C — Streamlabs Desktop

Streamlabs (Logitech) có tích hợp TikTok LIVE chính thức, không cần stream key. Streamlabs hỗ trợ browser source nên overlay của chúng ta chạy được. Là phương án dự phòng nếu Virtual Camera không hiện trong LIVE Studio (lỗi có ghi nhận trên diễn đàn OBS).

### Đường D — Live từ điện thoại

Không có bộ trộn hình. Xem mục 3.

---

## 3. Tính năng nào sống, tính năng nào chết — đối chiếu code thật

Luận điểm cốt lõi: **cái mất là hình, không phải não.**

`TiktokService` kết nối qua handle rồi phân giải `roomId` — `apps/server/src/modules/tiktok/tiktok.service.ts:226`. Không có chỗ nào trong đường kết nối đụng tới stream key. **Nguồn phát video không liên quan gì tới việc chúng ta nhận sự kiện.** Đã kiểm chứng thực tế: nối `tina.vlr`, server bắt room, bình luận thật chảy về, kịch bản khớp và trừ credit thật.

### Bảng phân tầng đầy đủ 7 loại hành động

Enum tại `packages/shared/src/types/index.ts:19`.

| Hành động | OBS/Virtual Cam | Mobile | Ghi chú |
|---|:--:|:--:|---|
| `TTS_READ` | ✅ | ⚠️ | Mobile: cần đường tiếng riêng, xem 3.1 |
| `SOUND` | ✅ | ⚠️ | Cùng đường với TTS |
| `MEDIA_POPUP` | ✅ | ❌ | Cần bộ trộn hình |
| `EFFECT` | ✅ | ❌ | Cần bộ trộn hình |
| `OBS_COMMAND` | ✅ | ❌ | **Chết hẳn** — không có OBS để điều khiển |
| `GAME_INPUT` | ✅ | ✅ | Qua Local Bridge, độc lập với đường video |
| `WEBHOOK` | ✅ | ✅ | Độc lập hoàn toàn |

Ngoài ra, chạy được ở **mọi chế độ**: rule engine, sổ credit, thống kê, live feed, lọc từ cấm, cảnh báo từ khoá.

### 3.1 Đường tiếng ở chế độ mobile

`useSpeechQueue` đã chạy sẵn trong `apps/web/app/overlays/media/page.tsx` — một trang web bình thường. Chế độ mobile **chỉ cần người dùng mở chính trang đó trong trình duyệt trên PC**, TTS phát ra loa.

**Không thêm lệnh audio vào app Go.** Đã kiểm: `apps/desktop-app/internal/bridge/command.go` chỉ có `key_press`, `halt`, `ping`, `resume`; grep `audio|sound|speaker|codec` trên toàn bộ code Go trả về **rỗng**. Thêm phát audio nghĩa là dựng codec, thiết bị ra và hàng đợi trong một tiến trình chưa từng làm việc đó — trong khi trình duyệt đã làm sẵn.

Đưa tiếng từ PC sang điện thoại:

| Cách | Chi phí | Ổn định | Ghi chú |
|---|---|---|---|
| **Loa ngoài** (khuyến nghị mặc định) | 0 | Trung bình | Đổi lấy tiếng ồn phòng, rủi ro hú |
| Cáp TRRS | Thấp | **Thấp** | Xem cảnh báo dưới |

⚠️ **Cáp TRRS không phải giải pháp ngon như vẻ ngoài:** cổng là mic-level mono nên cắm thẳng line-out vào sẽ méo (cần suy hao); nhiều máy đã bỏ jack; bơm TTS vào mic thì mất giọng streamer trừ khi có mixer; và **TikTok mobile chạy khử vọng/khử ồn trên đường mic — nó sẽ gọt chính cái giọng tổng hợp vừa bơm vào.** Đây là hỗ trợ phần cứng trên vô số mẫu máy. Xếp: ổn định trung bình, bảo trì cao.

### 3.2 Lỗ hổng autoplay phải vá trước

Trang overlay hiện có trạng thái này (`apps/web/app/overlays/media/page.tsx:92`):

```ts
speechStatus === 'blocked'
  ? 'Trình duyệt chặn tự phát âm thanh — mở URL này trong OBS Browser Source'
```

Câu đó bảo người dùng mở OBS — thứ mà người dùng mobile **không có**. Đây là ngõ cụt logic nằm sẵn trong code, và nó sẽ chặn đúng phương án rẻ nhất ở 3.1.

Phải làm:
1. Nút **"Bấm để bật tiếng"** ở lần đầu, mở khoá `AudioContext` cho cả phiên.
2. Sửa câu thông báo theo chế độ — mobile không được bảo họ mở OBS.

---

## 4. Việc cần làm, theo thứ tự ưu tiên

### Giai đoạn 1 — Màn hướng dẫn thiết lập ⭐ làm trước

Rẻ nhất, mở khoá nhiều người dùng nhất, **không cần đổi backend**.

Một trang `/huong-dan` dạng cây quyết định:

```
Bạn live bằng gì?
├── Máy tính
│   └── Có thấy stream key trong TikTok không?
│       ├── Có    → hướng dẫn OBS + stream key (hiện tại)
│       └── Không → hướng dẫn ĐƯỜNG B, gồm cả cáp âm thanh ảo
└── Điện thoại → hướng dẫn chế độ mobile (giai đoạn 2)

Chưa live được ở đâu cả → hướng dẫn nộp đơn xin quyền LIVE
```

Phần cáp âm thanh ảo phải nằm ngay trong luồng, không giấu ở FAQ — đó là chỗ ai cũng vấp.

**Tệp:** `apps/web/app/(dashboard)/huong-dan/page.tsx` (mới), thêm mục nav.

### Giai đoạn 2 — Chế độ mobile

| Việc | Nơi | Cỡ |
|---|---|---|
| `broadcastSource` mặc định trên `Channel` + migration | server | nhỏ |
| Bước chọn nguồn phát khi nối kênh | web | nhỏ |
| Gate giao diện theo bảng 7 hành động ở mục 3 | web | vừa |
| Cử chỉ mở khoá âm thanh + sửa thông báo chặn (mục 3.2) | web | nhỏ |
| Trang "màn hình đạo diễn" — tái dùng overlay làm đường tiếng | web | nhỏ |

#### Vì sao đặt `broadcastSource` trên `Channel` chứ không phải `LiveSession`

Về khái niệm, nguồn phát là thuộc tính của **buổi live**, không phải của kênh — hôm nay live bằng điện thoại, mai bằng PC. Đặt trên `LiveSession` là đúng về mặt mô hình.

Nhưng đã kiểm: **`LiveSession` là model chết.**

```
grep "liveSession" apps/server/src  →  rỗng
grep "liveEvent.create"             →  rỗng
```

Model có trong schema (`apps/server/prisma/schema.prisma:234`) nhưng **không nơi nào tạo ra dòng nào**, và `LiveEvent` cũng không được lưu DB dù schema khai `sessionId` bắt buộc. Nên "thêm một trường vào `LiveSession`" thực chất là dựng vòng đời phiên từ số không: tạo khi kết nối, đóng khi ngắt, xử lý phiên mồ côi khi server restart — chuyện đã xảy ra thật trong lúc test (NestJS `--watch` restart làm mất sạch bản đồ phiên trong RAM).

**Quyết định:** đặt trên `Channel` như **mặc định người dùng chọn**, ghi rõ trong code đó là mặc định chứ không phải chân lý. Khi vòng đời `LiveSession` được dựng thật thì chuyển thành ghi đè theo phiên.

#### Không chặn `MEDIA_POPUP` ở rule engine

Cảnh báo ở UI khi tạo luật là đủ. Chặn ở engine sẽ phá ngữ nghĩa "Thử trước", làm hỏng test hiện có, và sai về mặt logic — overlay vẫn hoạt động đúng, chỉ là khán giả không thấy. Người dùng cũng có thể đang mở overlay ở nơi khác.

### Hoãn

- ~~Lệnh `PLAY_AUDIO` trong app Go~~ — trình duyệt đã làm được, xem 3.1.
- ~~Vòng đời `LiveSession`~~ — việc riêng, không chặn kế hoạch này.

---

## 5. Ghi chú kỹ thuật

**`setSinkId()`** để chọn thiết bị phát: Chrome/Edge có, **Safari không**, Firefox tuỳ phiên bản. Muốn hiện *tên* thiết bị phải xin quyền micro trước. Là ma sát thật trong luồng "chọn đúng sound card nối vào điện thoại", không phải một dòng API.

**Virtual Camera không hiện trong LIVE Studio** — lỗi có ghi nhận trên diễn đàn OBS. Hướng dẫn cần có bước xử lý, và Streamlabs (đường C) là phương án dự phòng.

---

## 6. Câu hỏi còn treo

**Form xin quyền LIVE có mở ở Việt Nam không, và điều kiện hiện tại là gì?**

Tài liệu tôi đọc được viết cho thị trường Mỹ: cấp 14 ngày, gia hạn 180 ngày nếu live đủ 2 buổi trên 25 phút trong 14 ngày đó. **Chưa xác minh cho VN.**

Câu hỏi này quyết định trọng số của cả nhánh "chưa có quyền LIVE" trong cây quyết định ở mục 4. Nếu form không mở ở VN thì nhánh đó chỉ còn "đủ 1.000 followers", và màn hướng dẫn phải nói thẳng như vậy thay vì dẫn người dùng vào ngõ cụt.

**Cần người kiểm bằng tài khoản thật — không xác minh được bằng tra cứu.**

---

## Nguồn

- [How to Add OBS Virtual Camera to TikTok Live Studio — Hollyland](https://store.hollyland.com/blogs/creator-hub/add-obs-virtual-camera-to-tiktok-live-studio)
- [OBS Virtual Cam not available on TikTok Live Studio — OBS Forums](https://obsproject.com/forum/threads/obs-virtual-cam-not-available-on-tiktok-live-studio.193605/)
- [Logitech announces Streamlabs TikTok Live integration](https://www.tipranks.com/news/the-fly/logitech-announces-streamlabs-tiktok-live-integration)
- [How Many Followers on TikTok to Go Live 2026 — DemandSage](https://www.demandsage.com/followers-needed-for-tiktok-live/)
- [TikTok LIVE Requirements 2026 — SocialzAI](https://socialz.ai/blog/tiktok-live-requirements)
- [How to Go Live On TikTok in 2026 (With or Without 1k followers) — Agorapulse](https://www.agorapulse.com/blog/tiktok/how-to-go-live-on-tiktok-and-also-what-to-avoid-doing/)
- [How to Get Your TikTok Stream Key — Hollyland](https://www.hollyland.com/blog/topics/get-your-tiktok-stream-key)
