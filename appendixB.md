
---
---

# PHỤ LỤC B — ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)
## Dùng để xây dựng lại một sản phẩm có chức năng tương đương

**Ngày:** 2026-08-05 · **Phiên bản SRS:** 0.9 (Draft — chưa sẵn sàng ký duyệt, xem §B.0)

---

## B.0 TRẢ LỜI THẲNG: Requirement đã đủ chưa?

### **CHƯA ĐỦ.** Đây là đánh giá trung thực.

Báo cáo §1–§24 + Phụ lục A là **tài liệu kiến trúc và khảo sát**, không phải đặc tả yêu cầu. Khác biệt rất quan trọng:

| Cái đã có | Cái CHƯA có |
|---|---|
| Danh sách 53 tính năng (§5) | Yêu cầu **có thể kiểm thử** với tiêu chí nghiệm thu |
| 28 màn hình (§14) | **Business rule** chi tiết (công thức tính credit, logic reset quota…) |
| API đề xuất (§17) | **Non-functional requirement** có số đo (độ trễ, tải, uptime) |
| Schema DB (§18) | **Data dictionary** cấp trường |
| Roadmap + task Jira (§20–21) | **Ma trận truy vết** requirement → màn hình → API → test |
| — | **Danh sách câu hỏi phải chốt trước khi code** |

### Vì sao chưa đủ — 3 lý do gốc

**1. Tôi chưa từng đăng nhập vào sản phẩm gốc.**
Đây là giới hạn đã nêu ở §0 và nó ảnh hưởng nghiêm trọng tới chất lượng requirement. Toàn bộ phần *bên trong* sản phẩm (F28–F53 ở §5.2) được suy ra từ **văn bản quảng cáo trên landing page** và **tên biến JavaScript**, không phải từ việc quan sát sản phẩm chạy thật. Nghĩa là:
- Tôi biết "có tính năng thanh PK" nhưng **không biết** nó hoạt động thế nào: bao nhiêu đội, tính điểm ra sao, ai reset, hiển thị thế nào.
- Tôi biết "100 lượt đọc miễn phí/ngày" nhưng **không biết** 1 "lượt" là gì: 1 bình luận? 1 câu? 1 ký tự? 100 ký tự? Đây là **business rule quan trọng nhất của cả mô hình kinh doanh** và nó đang trống.

**2. Nhiều yêu cầu là quyết định sản phẩm của BẠN, không phải thứ audit tìm ra được.**
Giá bao nhiêu, gói nào, hoàn tiền ra sao, hỗ trợ mấy nền tảng — không có audit nào trả lời thay được.

**3. Rủi ro pháp lý/nền tảng chưa được giải quyết.**
§14.6 đã nêu: cách truy cập dữ liệu TikTok LIVE vẫn là `[U]`. Phụ lục A còn phát hiện thêm dấu hiệu nó nằm ở tầng Node.js nạp lúc chạy. **Đây không phải chi tiết kỹ thuật — đây là điều kiện tiên quyết để dự án tồn tại.** Không chốt được cái này thì mọi requirement khác đều vô nghĩa.

### Điểm hoàn chỉnh requirement

| Nhóm | Độ đầy đủ | Ghi chú |
|---|---|---|
| Yêu cầu chức năng — phần công khai | **85%** | Quan sát trực tiếp, đáng tin |
| Yêu cầu chức năng — phần sau đăng nhập | **35%** | Suy luận từ quảng cáo, **cần kiểm chứng** |
| Yêu cầu phi chức năng | **70%** | Bổ sung ở §B.6 dưới đây |
| Business rules | **25%** | Lỗ hổng lớn nhất |
| Data dictionary | **60%** | Schema có, định nghĩa trường chưa |
| Yêu cầu tích hợp | **50%** | TikTok là ẩn số lớn |
| Bảo mật & tuân thủ | **80%** | Bổ sung §B.11 |
| Yêu cầu desktop client | **75%** | Nhờ Phụ lục A |
| **TỔNG** | **≈ 60%** | **Đủ để lập kế hoạch, CHƯA đủ để code** |

### Kết luận §B.0

> Phụ lục B dưới đây nâng mức đầy đủ từ ~60% lên **~85%**. Phần 15% còn lại **không thể lấp bằng audit** — nó gồm: (a) quyết định sản phẩm/giá của bạn, (b) kiểm chứng thực tế sản phẩm gốc bằng tài khoản trả phí, (c) chốt phương án truy cập dữ liệu TikTok. Danh sách chính xác nằm ở **§B.15 — 24 câu hỏi chặn**.

---

## B.1 Phạm vi & bối cảnh

**Mục tiêu sản phẩm:** Nền tảng tự động hóa tương tác livestream cho creator TikTok LIVE — chuyển sự kiện live (bình luận, quà, tim, follow, share, vào phòng) thành hành động tự động: đọc bằng giọng nói, hiệu ứng overlay, điều khiển OBS, kích hoạt hành động trong game.

**Ngoài phạm vi bản 1.0:** xem §B.14.

**Nguyên tắc bắt buộc:** Không sao chép mã nguồn, nội dung, hình ảnh, thương hiệu hay tài sản của jqsvn.com. Đây là sản phẩm độc lập có chức năng tương đương.

### B.1.1 Ký hiệu độ ưu tiên

`M` = MUST (bắt buộc cho 1.0) · `S` = SHOULD · `C` = COULD · `W` = WON'T (bản này)

---

## B.2 Stakeholder & Persona

| ID | Persona | Mục tiêu chính | Nỗi đau |
|---|---|---|---|
| P1 | Streamer solo | Không bỏ sót người tặng quà | Vừa diễn vừa đọc chat không xuể |
| P2 | Gaming streamer | Quà kích hoạt sự kiện trong game | Setup kỹ thuật phức tạp |
| P3 | NPC/interaction streamer | Quà → hành động theo kịch bản | Cần cấu hình linh hoạt |
| P4 | Streamer PK/đối kháng | Thanh PK, mục tiêu, bảng xếp hạng | Không có công cụ trực quan |
| P5 | Agency / MCN | Quản lý nhiều kênh, phân quyền | Không có gói nhiều chỗ ngồi |
| P6 | Admin vận hành | Kiểm soát chi phí TTS, chặn lạm dụng | — |
| P7 | Support | Giải quyết sự cố lúc user đang live | Không có công cụ chẩn đoán |

**Ràng buộc bối cảnh quan trọng:** P1–P4 dùng sản phẩm **trong lúc đang livestream**. Mọi lỗi đều xảy ra trước khán giả trực tiếp. Đây là ràng buộc thiết kế chi phối toàn bộ NFR ở §B.6.

---

## B.3 Từ điển thuật ngữ (Glossary)

| Thuật ngữ | Định nghĩa |
|---|---|
| **Sự kiện live (Live Event)** | Một hành động của khán giả trên TikTok LIVE: bình luận, tặng quà, thả tim, follow, share, vào phòng |
| **Lượt đọc (Read/Credit)** | Đơn vị tính phí. **Định nghĩa chính xác = câu hỏi chặn Q-07** |
| **Luật (Rule)** | Cặp `điều kiện → hành động` do streamer cấu hình |
| **Hiệu ứng (Effect)** | Hoạt ảnh/âm thanh hiển thị trên overlay |
| **Overlay** | Trang web hiển thị trong OBS qua Browser Source |
| **Thanh PK** | Thanh so kè điểm giữa các đội/cá nhân trong buổi live |
| **Mục tiêu (Goal)** | Thanh tiến độ tới ngưỡng quà đặt trước |
| **Coin** | Đơn vị giá trị quà của TikTok |
| **Phiên live (Live Session)** | Một lần lên sóng, từ lúc bắt đầu đến lúc kết thúc |
| **Desktop Client** | Ứng dụng Windows chạy trên máy streamer |
| **Local Bridge** | WebSocket server cục bộ trong Desktop Client phục vụ overlay |
| **Giọng đọc (Voice)** | Cấu hình TTS: nhà cung cấp + giọng + tốc độ + cao độ |
| **Hàng đợi đọc (Speech Queue)** | Hàng đợi ưu tiên các câu chờ phát |

---

## B.4 Business Rules

> Ký hiệu nguồn: `[C]` quan sát được từ sản phẩm gốc · `[P]` **đề xuất của tôi**, cần bạn quyết định.

### B.4.1 Quota & Credit

| ID | Luật | Nguồn |
|---|---|---|
| BR-01 | Người dùng miễn phí nhận N lượt đọc mỗi ngày. Sản phẩm gốc dùng N=100. | `[C]` |
| BR-02 | Hạn mức miễn phí có thể thay đổi theo tải hệ thống, không cam kết cố định. | `[C]` |
| BR-03 | **1 lượt = 1 lần tổng hợp giọng nói thành công cho tối đa 200 ký tự.** Vượt 200 ký tự tính thêm 1 lượt mỗi 200 ký tự bắt đầu. | `[P]` — **Q-07** |
| BR-04 | Cache hit **không** trừ credit. Đây là đòn bẩy chi phí lớn nhất. | `[P]` |
| BR-05 | Nghe thử (preview) trong màn hình cấu hình **không** trừ credit, giới hạn 10 lần/phút. | `[P]` |
| BR-06 | Quota miễn phí reset lúc 00:00 theo múi giờ người dùng chọn (mặc định `Asia/Ho_Chi_Minh`). | `[P]` |
| BR-07 | Credit mua thêm **không hết hạn** và được tiêu **sau khi** quota miễn phí trong ngày cạn. | `[P]` — **Q-08** |
| BR-08 | Số dư không bao giờ được âm. Ràng buộc ở tầng database. | `[P]` |
| BR-09 | Khi còn ≤20% quota, hệ thống cảnh báo qua overlay + desktop + email. **Không** đợi tới 0. | `[P]` — sửa lỗi UX §9.4 |
| BR-10 | Khi hết credit, TTS dừng nhưng **overlay, hiệu ứng, PK, leaderboard vẫn chạy**. Không được làm hỏng cả buổi live. | `[P]` |
| BR-11 | Hoàn credit nếu tổng hợp giọng thất bại do lỗi hệ thống (không phải lỗi người dùng). | `[P]` |

### B.4.2 Điều kiện tài khoản

| ID | Luật | Nguồn |
|---|---|---|
| BR-12 | Hệ thống có cơ chế whitelist chặn tài khoản không đủ điều kiện. | `[C]` (mã lỗi #1001) |
| BR-13 | Có ngưỡng tối thiểu về lượng follower để đăng ký. | `[C]` (mã lỗi #10) |
| BR-14 | Có yêu cầu về danh mục kênh. | `[C]` (mã lỗi #7) |
| BR-15 | Admin có thể tạm dừng nhận đăng ký mới (kill-switch). | `[C]` (mã lỗi #9) |
| BR-16 | Một kênh TikTok chỉ được liên kết với **một** tài khoản tại một thời điểm. | `[P]` |
| BR-17 | Một tài khoản được liên kết tối đa K kênh (K=1 gói Free, K=3 gói Pro, K=20 gói Agency). | `[P]` — **Q-11** |

### B.4.3 Xử lý sự kiện

| ID | Luật |
|---|---|
| BR-18 | Luật được đánh giá theo thứ tự `priority` tăng dần; luật đầu tiên khớp sẽ thực thi. `[P]` |
| BR-19 | Một sự kiện có thể kích hoạt nhiều hành động nếu luật bật cờ `continueMatching`. `[P]` |
| BR-20 | Bình luận vượt quá độ dài tối đa bị **cắt**, không bị bỏ. `[P]` |
| BR-21 | Bình luận khớp danh sách từ cấm **không được đọc**, nhưng vẫn ghi log. `[P]` |
| BR-22 | Hàng đợi đọc ưu tiên: quà giá trị cao > quà > follow/share > bình luận. `[P]` |
| BR-23 | Nếu hàng đợi vượt M mục (mặc định 20), bỏ các bình luận cũ nhất, **giữ nguyên** mọi sự kiện quà. `[P]` |
| BR-24 | Cùng một người gửi bình luận trùng lặp trong 30 giây chỉ đọc 1 lần (chống spam). `[P]` |
| BR-25 | Hành động kích hoạt game phải có cooldown tối thiểu (mặc định 3 giây/binding) để tránh phá game. `[P]` |

---

## B.5 Yêu cầu chức năng (Functional Requirements)

> Mỗi FR có tiêu chí nghiệm thu (AC). AC viết theo dạng kiểm thử được.

### EPIC 1 — Tài khoản & Xác thực

| ID | Yêu cầu | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|---|---|
| FR-001 | Đăng nhập bằng Facebook OAuth | M | Người dùng hoàn tất OAuth và vào được dashboard trong ≤3 bước; token lưu mã hóa |
| FR-002 | Đăng nhập bằng Google OAuth | M | Như trên |
| FR-003 | Đăng nhập bằng Zalo OAuth | S | Như trên — thị trường VN |
| FR-004 | Đăng nhập bằng email + mật khẩu | S | Có xác minh email; mật khẩu hash Argon2id |
| FR-005 | Tham số `redirect` chỉ chấp nhận **đường dẫn tương đối** | M | Test với `https://evil.com` → bị từ chối, ghi log. **Đóng lỗi §13.3** |
| FR-006 | Refresh token xoay vòng + phát hiện tái sử dụng | M | Dùng lại refresh token cũ → thu hồi toàn bộ phiên của user đó |
| FR-007 | Xem và thu hồi phiên đăng nhập đang hoạt động | S | Danh sách hiện IP, thiết bị, thời gian; thu hồi có hiệu lực ≤5 giây |
| FR-008 | Đăng xuất mọi thiết bị | S | — |
| FR-009 | Xóa tài khoản (soft delete, 30 ngày ân hạn) | M | Tuân thủ PDPD/GDPR |
| FR-010 | Xuất dữ liệu cá nhân | S | JSON trong ≤48 giờ |

### EPIC 2 — Kết nối kênh

| ID | Yêu cầu | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|---|---|
| FR-011 | Liên kết kênh TikTok | M | Xác minh quyền sở hữu; không thể liên kết kênh người khác |
| FR-012 | Xác minh quyền sở hữu kênh | M | **Q-12** quyết định phương thức |
| FR-013 | Hủy liên kết kênh | M | Dừng mọi luật đang chạy của kênh đó |
| FR-014 | Hiển thị trạng thái kết nối realtime | M | Đang live / offline / mất kết nối, cập nhật ≤5 giây |
| FR-015 | Tự kết nối lại khi mất luồng sự kiện | M | Backoff lũy thừa, tối đa 60 giây; hiển thị rõ cho người dùng |

### EPIC 3 — Text-to-Speech (lõi sản phẩm)

| ID | Yêu cầu | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|---|---|
| FR-016 | Đọc bình luận live thành giọng nói | M | Sự kiện → âm thanh phát ra, p95 ≤ 2 giây (NFR-01) |
| FR-017 | Đọc tên + loại quà khi có người tặng | M | Ưu tiên cao hơn bình luận (BR-22) |
| FR-018 | Thông báo follow / share / thả tim | M | Bật/tắt độc lập từng loại |
| FR-019 | Chọn giọng đọc | M | Tối thiểu 4 giọng tiếng Việt (2 nam, 2 nữ) |
| FR-020 | Điều chỉnh tốc độ (0.5–2.0) và cao độ | M | Nghe thử ngay, không trừ credit |
| FR-021 | Mẫu câu tùy biến | M | Ví dụ `"{ten} vừa tặng {qua}"`; hỗ trợ biến, có validate |
| FR-022 | Lọc từ cấm | M | Danh sách người dùng tự thêm + danh sách hệ thống |
| FR-023 | Bỏ qua bình luận quá ngắn / chỉ emoji | S | Ngưỡng cấu hình được |
| FR-024 | Đọc tên người dùng theo phiên âm tiếng Việt | S | Xử lý tên có ký tự đặc biệt, emoji |
| FR-025 | Hàng đợi đọc có ưu tiên + hiển thị trực quan | M | Người dùng thấy đang đọc gì, còn gì chờ |
| FR-026 | Nút "bỏ qua câu hiện tại" và "xóa hàng đợi" | M | Phản hồi ≤200 ms — dùng khi đang live |
| FR-027 | Cache âm thanh theo `hash(text+voice+params)` | M | Cache hit không trừ credit (BR-04); đo được tỷ lệ hit |
| FR-028 | Định tuyến âm thanh ra thiết bị chọn được | M | Hỗ trợ thiết bị ảo (VB-Cable/VoiceMeeter) — **xem FR-070** |

### EPIC 4 — Luật & Hiệu ứng

| ID | Yêu cầu | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|---|---|
| FR-029 | Tạo luật `sự kiện + điều kiện → hành động` | M | Không cần biết lập trình |
| FR-030 | Điều kiện theo loại quà, giá trị coin, từ khóa, người gửi | M | — |
| FR-031 | Hành động: đọc, hiệu ứng, âm thanh, lệnh OBS, input game, webhook | M | — |
| FR-032 | Sắp xếp thứ tự ưu tiên luật (kéo thả) | M | — |
| FR-033 | Bật/tắt từng luật | M | Có hiệu lực ngay, không cần khởi động lại |
| FR-034 | Chạy thử luật (dry-run) không trừ credit | M | Bắt buộc — người dùng phải test được trước khi live |
| FR-035 | Thư viện hiệu ứng có sẵn | M | Tối thiểu 20 hiệu ứng lúc ra mắt |
| FR-036 | Tải lên hiệu ứng tùy chỉnh (ảnh/video/âm thanh) | S | Giới hạn dung lượng, quét mã độc |
| FR-037 | Xem trước hiệu ứng | M | — |
| FR-038 | Công cụ thiết kế menu quà | C | Kéo thả |

### EPIC 5 — Overlay

| ID | Yêu cầu | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|---|---|
| FR-039 | Overlay Chatbox hiển thị bình luận | M | Mượt ở 100 bình luận/phút, không giật |
| FR-040 | Overlay thanh PK nhiều đội | M | Hỗ trợ 2–8 đội (sản phẩm gốc hiện 8) |
| FR-041 | Overlay thanh mục tiêu | M | — |
| FR-042 | Overlay bảng xếp hạng quà | M | Cập nhật realtime |
| FR-043 | Overlay bảng xếp hạng tim | S | — |
| FR-044 | Overlay hiệu ứng vào phòng | S | Phân cấp theo hạng người xem |
| FR-045 | Overlay TopViewer | S | — |
| FR-046 | URL overlay có token bí mật, xoay được | M | **Bắt buộc** — URL sẽ bị lộ khi stream |
| FR-047 | Overlay kết nối **Local Bridge** trước, cloud là dự phòng | M | Độ trễ ≤300 ms (NFR-02). **Phát hiện từ Phụ lục A** |
| FR-048 | Overlay tự kết nối lại, không cần refresh OBS | M | Streamer không thể đụng OBS khi đang live |
| FR-049 | Overlay hoạt động khi mất mạng internet (chế độ cục bộ) | S | Ưu thế kiến trúc lớn |

### EPIC 6 — Tích hợp OBS & Game

| ID | Yêu cầu | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|---|---|
| FR-050 | Kết nối OBS qua obs-websocket v5 | M | Hiện trạng thái kết nối rõ ràng |
| FR-051 | Liệt kê và chuyển scene OBS | M | — |
| FR-052 | Bật/tắt source, mute/unmute | S | — |
| FR-053 | Quà kích hoạt lệnh OBS | M | — |
| FR-054 | Quà kích hoạt lệnh game qua **RCON** | S | Cho game hỗ trợ (Minecraft, Source, Rust). **Phụ lục A** |
| FR-055 | Quà kích hoạt **giả lập phím** | S | Cho game không hỗ trợ RCON (GTA V, Only Up) |
| FR-056 | Giới hạn an toàn cho input game | M | Cooldown, tối đa lần/phút, danh sách phím cho phép (BR-25) |
| FR-057 | Nút dừng khẩn cấp mọi tự động hóa | M | **Bắt buộc.** Phím tắt toàn cục, tác dụng ≤200 ms |

### EPIC 7 — Thanh toán & Credit

| ID | Yêu cầu | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|---|---|
| FR-058 | Hiển thị số dư credit realtime | M | — |
| FR-059 | Trang bảng giá **công khai, không cần đăng nhập** | M | Sửa lỗi §3.4 |
| FR-060 | Mua credit qua VNPay | M | — |
| FR-061 | Mua credit qua MoMo | M | — |
| FR-062 | Thanh toán quốc tế (thẻ) | S | — |
| FR-063 | Webhook thanh toán idempotent, xác minh chữ ký | M | Webhook lặp lại → chỉ cộng credit 1 lần |
| FR-064 | Sổ cái credit append-only, xem được | M | Mọi biến động đều truy vết được |
| FR-065 | Lịch sử giao dịch + hóa đơn | S | — |
| FR-066 | Cảnh báo sắp hết quota ở mức 20% | M | BR-09 |

### EPIC 8 — Desktop Client

| ID | Yêu cầu | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|---|---|
| FR-067 | Ứng dụng Windows có installer | M | **Phải ký số** (SEC-15) |
| FR-068 | Chạy Local Bridge (WebSocket cục bộ) | M | Bind `127.0.0.1`, có token phiên |
| FR-069 | Tự cập nhật có xác minh chữ ký | M | Không cho phép cập nhật không ký |
| FR-070 | Phát âm thanh TTS ra thiết bị chọn được | M | Hướng dẫn cài thiết bị ảo trong app |
| FR-071 | Chạy nền, thu nhỏ xuống khay hệ thống | S | — |
| FR-072 | Khởi động cùng Windows (tùy chọn) | C | Mặc định TẮT |
| FR-073 | Nhật ký cục bộ + nút xuất log hỗ trợ | M | Support cần chẩn đoán khi user đang live |
| FR-074 | Hoạt động khi mạng chập chờn | M | Overlay cục bộ vẫn chạy |

### EPIC 9 — Phân tích & Quản trị

| ID | Yêu cầu | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|---|---|
| FR-075 | Thống kê phiên live (người xem, coin, bình luận) | S | — |
| FR-076 | Biểu đồ theo thời gian, xuất CSV | C | — |
| FR-077 | Admin: quản lý người dùng, whitelist, ban | M | Có ghi log kiểm toán |
| FR-078 | Admin: điều chỉnh quota toàn hệ thống | M | BR-02 |
| FR-079 | Admin: kill-switch đăng ký mới | M | BR-15 |
| FR-080 | Admin: bảng theo dõi chi phí TTS | M | **Kiểm soát COGS — sống còn** |
| FR-081 | Onboarding có hướng dẫn từng bước | S | Resume được, bỏ qua được |
| FR-082 | Trợ lý hỏi đáp / trung tâm trợ giúp | S | Giảm tải support |

### EPIC 10 — Trang công khai

| ID | Yêu cầu | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|---|---|
| FR-083 | Landing page có SSG, đầy đủ metadata | M | Lighthouse SEO = 100. Sửa §10 |
| FR-084 | Bảng xếp hạng kênh live công khai | S | Ảo hóa danh sách, không giật |
| FR-085 | Song ngữ VI/EN có hreflang | M | — |
| FR-086 | Trang chính sách riêng tư + điều khoản | M | Bắt buộc pháp lý |
| FR-087 | Trang tải desktop có công bố SHA-256 | M | Phụ lục A #121 |

**Tổng: 87 yêu cầu chức năng.**

---

## B.6 Yêu cầu phi chức năng (NFR)

> Đây là phần **thiếu hoàn toàn** trong báo cáo gốc và là phần quan trọng nhất với sản phẩm realtime.

### B.6.1 Hiệu năng & độ trễ

| ID | Yêu cầu | Chỉ tiêu | Vì sao |
|---|---|---|---|
| NFR-01 | Độ trễ **sự kiện TikTok → âm thanh phát ra** | p50 ≤1.0s · **p95 ≤2.0s** · p99 ≤3.0s | Quá 3 giây thì lời cảm ơn mất ý nghĩa với khán giả |
| NFR-02 | Độ trễ **sự kiện → hiệu ứng overlay** | p95 ≤300 ms | Qua Local Bridge, không vòng cloud |
| NFR-03 | Độ trễ thao tác UI (bỏ qua câu, dừng khẩn) | ≤200 ms | Dùng khi đang live |
| NFR-04 | Thông lượng xử lý sự kiện | ≥5.000 sự kiện/giây toàn hệ thống | — |
| NFR-05 | Sự kiện đồng thời trên 1 kênh | ≥200 bình luận/phút không rớt | Kênh lớn VN đạt mức này |
| NFR-06 | Web: LCP / CLS / INP | ≤2.5s / ≤0.1 / ≤200ms | Sửa §11 |
| NFR-07 | JS ban đầu của trang app | ≤250 KB gzip | Có gate trong CI |

### B.6.2 Ràng buộc tài nguyên Desktop Client

> **Đây là NFR dễ bị bỏ sót nhất và nó rất quan trọng.** Ứng dụng chạy **song song với OBS đang encode video livestream**. OBS đã ngốn phần lớn CPU/GPU. Nếu client tranh tài nguyên, khung hình stream sẽ rớt — và đó là lỗi người dùng nhìn thấy ngay.

| ID | Yêu cầu | Chỉ tiêu |
|---|---|---|
| NFR-08 | CPU trung bình khi idle | ≤1% trên máy 4 nhân |
| NFR-09 | CPU trung bình khi đang xử lý live | **≤5%** trên máy 4 nhân |
| NFR-10 | RAM thường trú | ≤400 MB (đã tính WebView2) |
| NFR-11 | Không dùng GPU cho việc không cần thiết | GPU của OBS phải được ưu tiên |
| NFR-12 | Thời gian khởi động app | ≤5 giây |
| NFR-13 | Không rò rỉ bộ nhớ qua phiên live 8 giờ | Tăng RAM ≤10% sau 8 giờ |

### B.6.3 Độ sẵn sàng

| ID | Yêu cầu | Chỉ tiêu |
|---|---|---|
| NFR-14 | Uptime API + realtime | ≥99.5%/tháng |
| NFR-15 | **Uptime giờ cao điểm VN (19:00–24:00 ICT)** | **≥99.9%** — đây là giờ streamer làm việc |
| NFR-16 | Suy giảm có kiểm soát khi TTS provider lỗi | Overlay/PK/leaderboard vẫn chạy (BR-10) |
| NFR-17 | RTO / RPO | ≤4 giờ / ≤15 phút |
| NFR-18 | Không có cửa sổ bảo trì trong giờ cao điểm | Deploy ngoài 19:00–24:00 ICT |

### B.6.4 Khả năng mở rộng

| ID | Yêu cầu | Chỉ tiêu |
|---|---|---|
| NFR-19 | Người dùng đăng ký | 100.000 (thiết kế cho 1 triệu) |
| NFR-20 | Phiên live đồng thời | 5.000 |
| NFR-21 | Kết nối WebSocket đồng thời | 50.000 |
| NFR-22 | Mở rộng ngang không downtime | Thêm pod → tăng năng lực tuyến tính |

### B.6.5 Chất lượng & vận hành

| ID | Yêu cầu |
|---|---|
| NFR-23 | Độ phủ test: ≥80% logic nghiệp vụ, **100% luồng credit/thanh toán** |
| NFR-24 | Mọi log có `traceId` truy vết xuyên dịch vụ |
| NFR-25 | Cảnh báo khi tỷ lệ lỗi >1% trong 5 phút |
| NFR-26 | **Theo dõi tỷ lệ cache hit TTS** — chỉ số biên lợi nhuận trực tiếp |
| NFR-27 | Cảnh báo khi chi phí TTS đạt 80% ngân sách tháng |
| NFR-28 | Thời gian build + deploy ≤15 phút |

### B.6.6 Khả năng dùng & tiếp cận

| ID | Yêu cầu |
|---|---|
| NFR-29 | Đạt **WCAG 2.1 AA** trên toàn bộ giao diện web. Sửa §12 |
| NFR-30 | Có **dark mode** — người dùng làm việc ban đêm cạnh OBS |
| NFR-31 | Điểm chạm ≥44×44 px, cỡ chữ ≥14 px |
| NFR-32 | Streamer mới hoàn tất từ đăng ký → phát TTS đầu tiên trong ≤15 phút |
| NFR-33 | Mọi trạng thái đều có giao diện: loading, rỗng, lỗi. Không màn hình trắng |

---

## B.7 Yêu cầu tích hợp

| ID | Hệ thống | Yêu cầu | Rủi ro |
|---|---|---|---|
| INT-01 | **Nguồn dữ liệu TikTok LIVE** | Nhận realtime: bình luận, quà, tim, follow, share, join | 🔴 **CHẶN — Q-01** |
| INT-02 | Google Cloud TTS | Tổng hợp giọng, có cache, có quota | Chi phí; cần phương án dự phòng |
| INT-03 | Nhà cung cấp TTS thứ 2 | Dự phòng khi INT-02 lỗi/tăng giá | Tránh khóa nhà cung cấp |
| INT-04 | Facebook OAuth | Đăng nhập | Chính sách app review |
| INT-05 | Google OAuth | Đăng nhập | — |
| INT-06 | Zalo OAuth | Đăng nhập (VN) | — |
| INT-07 | VNPay | Thanh toán nội địa | Cần pháp nhân VN |
| INT-08 | MoMo | Thanh toán nội địa | Cần pháp nhân VN |
| INT-09 | Stripe/Paddle | Thanh toán quốc tế | — |
| INT-10 | obs-websocket v5 | Điều khiển OBS | Phiên bản OBS người dùng |
| INT-11 | RCON | Điều khiển game server | — |
| INT-12 | Email (transactional) | Cảnh báo quota, hóa đơn | — |
| INT-13 | Zalo OA / Messenger | Thông báo, hỗ trợ | Kênh quen thuộc của user VN |

---

## B.8 Yêu cầu dữ liệu

### B.8.1 Data dictionary — các trường then chốt

| Thực thể | Trường | Kiểu | Ràng buộc | Ghi chú |
|---|---|---|---|---|
| User | `email` | citext | unique, not null | Không phân biệt hoa thường |
| User | `locale` | varchar(5) | ∈ {vi, en} | Mặc định `vi` |
| User | `timezone` | varchar(64) | IANA hợp lệ | Mặc định `Asia/Ho_Chi_Minh`; dùng cho BR-06 |
| CreditBalance | `balance` | int | **CHECK ≥ 0** | Không bao giờ âm |
| CreditBalance | `version` | bigint | optimistic lock | Chống double-spend (BR-08) |
| CreditLedger | `delta` | int | ≠ 0 | Append-only |
| CreditLedger | `reason` | enum | daily_grant, tts, purchase, refund, admin | — |
| Transaction | `idempotency_key` | varchar | **unique** | Chống cộng credit 2 lần (FR-063) |
| Transaction | `amount_minor` | bigint | ≥0 | Lưu đơn vị nhỏ nhất (đồng) |
| Rule | `priority` | int | ≥0 | Nhỏ hơn = ưu tiên cao (BR-18) |
| Rule | `conditions` | jsonb | schema-validated | — |
| LiveEvent | `occurred_at` | timestamptz | PARTITION KEY | Phân mảnh theo tháng |
| Overlay | `public_token` | varchar(64) | unique, ngẫu nhiên ≥256 bit | Xoay được (FR-046) |
| TTSCache | `cache_key` | char(64) | PK | `sha256(text+voice+params)` |
| Identity | `access_token_enc` | bytea | AES-GCM, khóa từ KMS | Không lưu plaintext |

### B.8.2 Yêu cầu lưu trữ & vòng đời

| ID | Yêu cầu |
|---|---|
| DR-01 | `live_events` giữ 90 ngày, sau đó `DROP PARTITION` |
| DR-02 | `credit_ledger` giữ **vĩnh viễn** — dữ liệu tài chính |
| DR-03 | Audio cache TTL 30 ngày, gia hạn khi có hit |
| DR-04 | Log ứng dụng giữ 30 ngày; log kiểm toán giữ 2 năm |
| DR-05 | Backup hàng ngày + PITR; **diễn tập khôi phục hàng tháng** |
| DR-06 | Xóa tài khoản → xóa cứng dữ liệu cá nhân sau 30 ngày, giữ sổ cái ẩn danh |

---

## B.9 Yêu cầu bảo mật & tuân thủ

| ID | Yêu cầu | Ưu tiên | Liên hệ |
|---|---|---|---|
| SEC-01 | Cookie phiên có `HttpOnly` + `Secure` + `SameSite` | M | Sửa §13.2 |
| SEC-02 | Có CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy | M | Sửa §13.1 |
| SEC-03 | HSTS có `includeSubDomains` + `preload` | M | Sửa §13.9 |
| SEC-04 | CSRF token trên mọi thao tác thay đổi trạng thái | M | Sửa §13.5 |
| SEC-05 | **Cấm `innerHTML` với dữ liệu người dùng** — có lint rule chặn | M | Sửa §13.4 |
| SEC-06 | Validate đầu vào bằng schema ở mọi endpoint | M | — |
| SEC-07 | Rate limit theo IP + theo user + theo socket | M | — |
| SEC-08 | Token OAuth mã hóa khi lưu (AES-GCM, khóa KMS) | M | — |
| SEC-09 | Mật khẩu hash Argon2id | M | Nếu làm FR-004 |
| SEC-10 | Geo-IP xử lý **phía server**, không gửi IP ra bên thứ ba | M | Sửa §13.6 |
| SEC-11 | Log kiểm toán bất biến cho thao tác admin + tiền | M | — |
| SEC-12 | Socket: xác thực trong 5 giây, kiểm `Origin`, phân quyền theo kênh | M | — |
| SEC-13 | Local Bridge bind `127.0.0.1` + token phiên | M | Phụ lục A D6 |
| SEC-14 | Cập nhật desktop phải xác minh chữ ký | M | Phụ lục A D7 |
| SEC-15 | **Ký số installer và toàn bộ binary** | M | Phụ lục A D1 |
| SEC-16 | Không ship file `.pdb` trong bản phát hành | M | Phụ lục A D4 |
| SEC-17 | Runtime .NET còn trong thời hạn hỗ trợ | M | Phụ lục A D5 |
| SEC-18 | Quét CVE phụ thuộc trong CI, chặn merge nếu có lỗ hổng cao | M | — |
| SEC-19 | SBOM cho cả web và desktop | S | — |
| SEC-20 | Pentest bên thứ ba trước khi ra mắt | M | — |
| CMP-01 | Tuân thủ **Nghị định 13/2023/NĐ-CP (PDPD Việt Nam)** về bảo vệ dữ liệu cá nhân | M | Bắt buộc pháp lý VN |
| CMP-02 | Tuân thủ GDPR nếu phục vụ người dùng EU | S | — |
| CMP-03 | Có cơ chế đồng ý cookie/tracking | M | — |
| CMP-04 | Điều khoản sử dụng + chính sách hoàn tiền công khai | M | — |
| CMP-05 | **Tuân thủ điều khoản nền tảng TikTok** | M | 🔴 **Q-01** |
| CMP-06 | Hóa đơn điện tử theo quy định VN nếu bán cho khách VN | S | Cần tư vấn kế toán |

---

## B.10 Yêu cầu bản địa hóa

| ID | Yêu cầu |
|---|---|
| L10N-01 | Hỗ trợ đầy đủ tiếng Việt (dấu, sắp xếp, hiển thị) — ngôn ngữ mặc định |
| L10N-02 | Hỗ trợ tiếng Anh |
| L10N-03 | `<html lang>` phải khớp ngôn ngữ đang hiển thị — sửa §10.2 |
| L10N-04 | Định dạng số/tiền/ngày theo locale (VND không có phần thập phân) |
| L10N-05 | TTS phải xử lý đúng tên tiếng Việt có dấu và emoji |
| L10N-06 | Giao diện chịu được giãn nở văn bản 30% khi dịch |
| L10N-07 | Múi giờ mặc định `Asia/Ho_Chi_Minh`, đổi được |

---

## B.11 Ràng buộc & giả định

### Ràng buộc
- C-01 Desktop client chỉ chạy Windows 10/11 x64 ở bản 1.0
- C-02 Phụ thuộc OBS Studio ≥28 (obs-websocket v5 tích hợp sẵn)
- C-03 Chi phí TTS là COGS chính → mọi thiết kế phải tối ưu cache
- C-04 Người dùng chủ yếu ở VN → hạ tầng đặt gần VN
- C-05 Thanh toán nội địa cần pháp nhân Việt Nam
- C-06 Không sao chép mã nguồn/tài sản của sản phẩm gốc

### Giả định (cần xác nhận)
- A-01 Có được nguồn dữ liệu TikTok LIVE hợp pháp và ổn định — **Q-01**
- A-02 Người dùng chấp nhận cài desktop client
- A-03 Người dùng có máy đủ mạnh chạy OBS + game + client
- A-04 Đội ngũ có 6 người như giả định §20

---

## B.12 Ngoài phạm vi bản 1.0

- Bản macOS/Linux của desktop client
- Ứng dụng di động (đưa vào giai đoạn 2)
- Biến thể Facebook Live / YouTube Live
- Chợ hiệu ứng của cộng đồng
- Mini-game độc quyền
- Phân tích nâng cao / ClickHouse
- Ngôn ngữ ngoài VI/EN
- Gói agency nhiều chỗ ngồi

---

## B.13 ⛔ 24 CÂU HỎI CHẶN — phải chốt trước khi viết dòng code đầu tiên

> Đây là phần quan trọng nhất của Phụ lục B. Mỗi câu hỏi dưới đây, nếu trả lời khác nhau, sẽ dẫn tới sản phẩm khác nhau. **Không audit nào trả lời thay được.**

### Nhóm 1 — Sống còn (phải chốt trước mọi thứ)

| ID | Câu hỏi | Vì sao chặn |
|---|---|---|
| **Q-01** | 🔴 **Nguồn dữ liệu TikTok LIVE lấy từ đâu, có hợp pháp không?** Có tham gia chương trình đối tác chính thức không? Nếu dùng phương thức không chính thức, chấp nhận rủi ro bị chặn/kiện ở mức nào? | **Không có câu trả lời = không có sản phẩm.** Đây là rủi ro lớn hơn mọi vấn đề kỹ thuật |
| **Q-02** | Có pháp nhân Việt Nam để tích hợp VNPay/MoMo và xuất hóa đơn không? | Quyết định toàn bộ EPIC 7 |
| **Q-03** | Ngân sách TTS tối đa mỗi tháng là bao nhiêu? | Quyết định BR-01, BR-03 và cả mô hình giá |

### Nhóm 2 — Mô hình kinh doanh

| ID | Câu hỏi |
|---|---|
| **Q-04** | Bảng giá cụ thể: các gói, mức giá, credit mỗi gói? |
| **Q-05** | Có gói thuê bao định kỳ hay chỉ bán credit lẻ? |
| **Q-06** | Gói "Pro" khác gói thường ở điểm nào? |
| **Q-07** | 🔴 **Định nghĩa chính xác "1 lượt đọc" là gì?** 1 bình luận / 1 câu / 1 ký tự / 100 ký tự? |
| **Q-08** | Credit mua có hết hạn không? Thứ tự tiêu: miễn phí trước hay trả phí trước? |
| **Q-09** | Chính sách hoàn tiền? |
| **Q-10** | Hạn mức miễn phí hàng ngày là bao nhiêu? |
| **Q-11** | Mỗi gói cho liên kết bao nhiêu kênh? |

### Nhóm 3 — Sản phẩm & vận hành

| ID | Câu hỏi |
|---|---|
| **Q-12** | Xác minh quyền sở hữu kênh TikTok bằng cách nào? |
| **Q-13** | Có giữ cơ chế whitelist + ngưỡng follower như sản phẩm gốc không, hay mở cho tất cả? |
| **Q-14** | Thanh PK hỗ trợ tối đa bao nhiêu đội? Công thức tính điểm? Ai reset? |
| **Q-15** | Thư viện hiệu ứng ra mắt với bao nhiêu hiệu ứng? Ai thiết kế? |
| **Q-16** | Cho phép người dùng tải hiệu ứng tùy chỉnh lên không? Kiểm duyệt thế nào? |
| **Q-17** | Danh sách game hỗ trợ ở bản 1.0? |
| **Q-18** | Giả lập phím vào game có vi phạm điều khoản của game đó không? Đã rà chưa? |
| **Q-19** | Hỗ trợ khách hàng theo SLA nào, giờ nào? (User live buổi tối) |

### Nhóm 4 — Kỹ thuật cần kiểm chứng thực tế

| ID | Câu hỏi |
|---|---|
| **Q-20** | Có giữ desktop client + Local Bridge như sản phẩm gốc, hay làm thuần cloud? (Khuyến nghị: **giữ** — xem Phụ lục A.3.1) |
| **Q-21** | Dùng nhà cung cấp TTS nào? Có dự phòng không? Đã đo chi phí thực tế cho tiếng Việt chưa? |
| **Q-22** | Tỷ lệ cache hit TTS thực tế đạt bao nhiêu? (Giả định 40–60% chưa được kiểm chứng) |
| **Q-23** | Có cần thiết bị âm thanh ảo không? Tự đóng gói hay hướng dẫn user cài? |
| **Q-24** | Định dạng overlay: Browser Source của OBS hay window capture? |

---

## B.14 Sổ rủi ro (Risk Register)

| ID | Rủi ro | Khả năng | Tác động | Giảm thiểu |
|---|---|---|---|---|
| R-01 | **TikTok chặn/thay đổi cách truy cập dữ liệu live** | Cao | **Nghiêm trọng** | Trừu tượng hóa tầng ingest; đa nền tảng (FB/YT) từ sớm; theo dõi chính sách hàng quý |
| R-02 | Chi phí TTS vượt doanh thu | Trung bình | Cao | Cache mạnh (BR-04); cảnh báo ngân sách (NFR-27); nhiều nhà cung cấp |
| R-03 | Facebook/Google siết chính sách OAuth | Trung bình | Cao | Có phương án email/Zalo (FR-003, FR-004) |
| R-04 | Sự cố trong giờ cao điểm phá buổi live của user | Trung bình | Cao | NFR-15; không deploy giờ cao điểm; suy giảm có kiểm soát (BR-10) |
| R-05 | Desktop client tranh tài nguyên với OBS gây rớt khung hình | Trung bình | Cao | NFR-08→NFR-13 có chỉ tiêu cứng |
| R-06 | Giả lập phím bị game/anti-cheat coi là gian lận | Trung bình | Trung bình | **Q-18**; ưu tiên RCON; giới hạn an toàn (BR-25) |
| R-07 | Cạnh tranh sao chép nhanh | Cao | Trung bình | Moat nằm ở cộng đồng + cấu hình người dùng, không ở công nghệ |
| R-08 | Vi phạm PDPD do xử lý dữ liệu cá nhân | Thấp | Cao | CMP-01; tư vấn pháp lý |
| R-09 | Tấn công chiếm tài khoản do lỗi bảo mật | Trung bình | **Nghiêm trọng** | SEC-01→SEC-20; pentest trước ra mắt |
| R-10 | Không đủ nhân sự .NET + Node + React cùng lúc | Trung bình | Trung bình | Cân nhắc Tauri để đồng nhất ngôn ngữ |

---

## B.15 Ma trận truy vết (mẫu)

| Requirement | Màn hình | API | Bảng DB | Test case |
|---|---|---|---|---|
| FR-016 Đọc bình luận | S03, S04 | `POST /tts/synthesize` | `tts_jobs`, `tts_cache`, `credit_ledger` | TC-016-01→08 |
| FR-027 Cache TTS | — | `POST /tts/synthesize` | `tts_cache` | TC-027-01→05 |
| FR-046 Token overlay | S08 | `POST /overlays/{id}/rotate-token` | `overlays` | TC-046-01→04 |
| FR-057 Dừng khẩn cấp | Desktop | WS `control.emergency_stop` | — | TC-057-01→03 |
| FR-063 Webhook idempotent | — | `POST /billing/webhook/{p}` | `transactions` | TC-063-01→06 |
| BR-08 Số dư không âm | — | mọi API trừ credit | `credit_balances` CHECK | TC-BR08-01→03 |

*(Ma trận đầy đủ 87 FR lập ở giai đoạn Sprint 0.)*

---

## B.16 Definition of Ready / Definition of Done

**Definition of Ready** — một user story được phép vào sprint khi:
- [ ] Có ID requirement truy vết được (FR/NFR/BR)
- [ ] Tiêu chí nghiệm thu viết dạng kiểm thử được
- [ ] Thiết kế UI đã có (nếu có giao diện)
- [ ] Hợp đồng API đã chốt
- [ ] Phụ thuộc đã xác định và không bị chặn
- [ ] Đã ước lượng story point
- [ ] **Không phụ thuộc vào câu hỏi chặn chưa có lời giải ở §B.13**

**Definition of Done** — một story hoàn thành khi:
- [ ] Code review đã pass
- [ ] Unit + integration test đạt ngưỡng phủ
- [ ] E2E test cho luồng chính
- [ ] Kiểm tra a11y (nếu có giao diện)
- [ ] Không có lỗ hổng CVE mức cao
- [ ] Đã đo và đạt NFR liên quan
- [ ] Tài liệu/OpenAPI đã cập nhật
- [ ] Đã deploy staging và smoke test pass
- [ ] Đã cập nhật ma trận truy vết

---

## B.17 Kịch bản nghiệm thu mẫu (Gherkin)

```gherkin
Tính năng: Đọc quà tặng có tính credit

  Bối cảnh:
    Cho streamer "A" đã liên kết kênh TikTok và đang live
    Và số dư credit của "A" là 50

  Kịch bản: Đọc quà thành công, trừ credit
    Khi khán giả "B" tặng quà "Hoa hồng" trị giá 1 coin
    Thì hệ thống phát âm thanh chứa tên "B" trong vòng 2 giây
    Và số dư credit của "A" giảm còn 49
    Và sổ cái ghi 1 dòng lý do "tts" với delta -1

  Kịch bản: Cache hit không trừ credit
    Cho câu "B vừa tặng Hoa hồng" đã có trong cache
    Khi khán giả "B" tặng quà "Hoa hồng" lần nữa
    Thì hệ thống phát âm thanh trong vòng 500 ms
    Và số dư credit của "A" KHÔNG thay đổi
    Và sổ cái KHÔNG ghi thêm dòng nào

  Kịch bản: Hết credit không phá buổi live
    Cho số dư credit của "A" là 0
    Khi khán giả "B" tặng quà "Hoa hồng"
    Thì hệ thống KHÔNG phát âm thanh
    Và overlay VẪN hiển thị hiệu ứng quà
    Và thanh PK VẪN cập nhật điểm
    Và "A" nhận thông báo "hết credit" trên desktop client

  Kịch bản: Cảnh báo sớm ở ngưỡng 20%
    Cho hạn mức ngày của "A" là 100 và đã dùng 80
    Khi sự kiện đọc tiếp theo được xử lý
    Thì "A" nhận cảnh báo "sắp hết quota"
    Và cảnh báo chỉ gửi 1 lần cho mỗi chu kỳ quota

  Kịch bản: Không trừ credit khi lỗi hệ thống
    Cho nhà cung cấp TTS trả về lỗi 500
    Khi hệ thống xử lý sự kiện đọc
    Thì credit đã trừ được hoàn lại
    Và sổ cái ghi dòng lý do "refund"
```

```gherkin
Tính năng: Chống double-spend credit

  Kịch bản: 1000 yêu cầu đồng thời không làm số dư âm
    Cho số dư credit của "A" là 10
    Khi gửi đồng thời 1000 yêu cầu tổng hợp giọng nói
    Thì đúng 10 yêu cầu thành công
    Và 990 yêu cầu trả về mã 402
    Và số dư cuối cùng bằng 0
    Và số dư KHÔNG BAO GIỜ âm tại bất kỳ thời điểm nào
```

---

## B.18 Kết luận Phụ lục B

### Trả lời câu hỏi ban đầu

**Trước Phụ lục B:** requirement đạt ~60% — đủ để lập kế hoạch và ước lượng, **không đủ để code**.

**Sau Phụ lục B:** đạt ~85% — có 87 FR có tiêu chí nghiệm thu, 33 NFR có chỉ tiêu đo được, 25 business rule, 26 yêu cầu bảo mật/tuân thủ, data dictionary, sổ rủi ro, DoR/DoD, kịch bản nghiệm thu.

### 15% còn lại nằm ở đâu

Không phải do thiếu sót phân tích. Nó nằm ở ba chỗ **chỉ bạn mới lấp được**:

1. **§B.13 — 24 câu hỏi chặn.** Đặc biệt **Q-01** (nguồn dữ liệu TikTok), **Q-07** (định nghĩa "1 lượt đọc"), **Q-04** (bảng giá). Ba câu này quyết định sản phẩm ra hình gì.

2. **Kiểm chứng sản phẩm gốc bằng tài khoản thật.** Tôi chưa đăng nhập, nên EPIC 3–6 (TTS, luật, overlay, tích hợp game) dựa trên suy luận. Nếu bạn dùng thử sản phẩm gốc như một khách hàng và ghi lại cách nó thực sự hoạt động, độ chính xác của những epic đó sẽ tăng vọt.

3. **Thiết kế UI/UX chi tiết.** SRS mô tả *cái gì*, không mô tả *trông thế nào*. Cần wireframe và design system trước Sprint 2.

### Khuyến nghị bước tiếp theo

| Thứ tự | Việc | Thời gian |
|---|---|---|
| 1 | Trả lời **Q-01, Q-02, Q-03** — nhóm sống còn | 1–2 tuần (cần cả tư vấn pháp lý) |
| 2 | Trả lời Q-04 → Q-11 — mô hình kinh doanh | 1 tuần |
| 3 | Dùng thử sản phẩm gốc, ghi lại hành vi thực tế | 1 tuần |
| 4 | Chốt SRS 1.0, ký duyệt | 3 ngày |
| 5 | Wireframe + design system | 2 tuần |
| 6 | Sprint 0: dựng ma trận truy vết đầy đủ | 1 tuần |
| | **Tổng trước khi code** | **~6 tuần** |

> **Lời khuyên thẳng:** đừng bắt đầu code trước khi **Q-01** có câu trả lời rõ ràng bằng văn bản. Mọi thứ khác trong tài liệu này đều có thể sửa được sau; riêng câu đó nếu sai thì toàn bộ 4.080 giờ ở §20 thành lãng phí.

---

*Phụ lục B kết thúc. Tài liệu này là đặc tả yêu cầu cho một sản phẩm mới, độc lập. Các yêu cầu đánh dấu `[C]` bắt nguồn từ quan sát công khai sản phẩm gốc; các yêu cầu `[P]` là đề xuất thiết kế của tôi và cần bạn phê duyệt. Không sao chép mã nguồn, nội dung hay tài sản có bản quyền.*
