# LiveNova — Kế hoạch MVP: Nhận quà ➔ Chạy Media

> **Mục tiêu MVP duy nhất:** Người xem tặng quà trên TikTok LIVE → trong vòng **dưới 1 giây**, OBS hiện video/ảnh và Desktop phát âm thanh.
>
> Mọi thứ khác (TTS, thanh toán, RCON, PK bar, Goal bar) **hoãn lại** cho tới khi luồng trên chạy được đầu-cuối trên máy thật.
>
> Tài liệu này thay thế `ROADMAP_AND_TASK_DIVISION.md` — file đó đã lỗi thời (còn ghi Desktop là Rust/`local_bridge.rs`, trong khi từ commit `fc45055` Desktop đã là **Go + Wails**).

---

## 1. Nguyên tắc chống xung đột

Ba quy tắc, theo thứ tự quan trọng:

**R1 — Mỗi file có đúng một chủ.** Không có file nào "hai người cùng sửa". Xem bảng §2.

**R2 — `packages/shared` là hợp đồng, sửa phải có review chéo.** Đây là file duy nhất cả hai đụng tới. Quy tắc: **chỉ được thêm field optional, không được đổi/xoá field đang có** trong `packages/shared/src/types/index.ts`. Muốn đổi → nhắn nhau trước, đổi trong 1 commit riêng, không kèm logic.

**R3 — Chốt hợp đồng trước, code sau.** Ngày 1 của mỗi bước: hai người ngồi thống nhất kiểu dữ liệu đi qua ranh giới (§3), commit vào `shared`, rồi mới tách ra làm.

---

## 2. Bảng sở hữu file (BẮT BUỘC)

| Đường dẫn | Chủ sở hữu | Ghi chú |
|---|---|---|
| `apps/desktop-app/**` (Go + frontend Wails) | **Dev A** | Toàn quyền |
| `apps/server/src/modules/tiktok/**` | **Dev A** | Ingest |
| `apps/server/src/modules/rule/**` | **Dev A** | Rule engine, media queue |
| `apps/server/src/modules/websocket/**` | **Dev A** | ⚠️ Xem §5 — trước đây không ai sở hữu |
| `apps/server/src/modules/channel/**` | **Dev A** | Gateway phụ thuộc |
| `apps/web/app/overlays/**` | **Dev B** | OBS Browser Source |
| `apps/web/app/(dashboard)/**` | **Dev B** | Dashboard |
| `apps/server/src/modules/overlay/**` | **Dev B** | API overlay + token |
| `apps/server/src/modules/media/**` (tạo mới) | **Dev B** | Upload MP4/GIF/MP3 |
| `packages/shared/src/types/index.ts` | **Chung** | Áp dụng R2 |
| `packages/shared/src/rules/**` | **Dev A** | |
| `apps/server/prisma/schema.prisma` | **Chung** | Áp dụng R2 — mỗi migration 1 commit riêng |
| `.github/workflows/**` | **Dev A** | |

**Mẹo thực thi R1:** thêm `CODEOWNERS` để GitHub tự gán reviewer, không phải nhớ bằng đầu.

---

## 3. Hợp đồng dữ liệu — chốt TRƯỚC khi code

Ba kiểu này là toàn bộ mặt tiếp xúc giữa hai người. Chốt xong, hai bên làm song song không cần chờ nhau.

### 3.1 `LiveEvent` — đã có, giữ nguyên
`packages/shared/src/types/index.ts:54`. Dev A phát ra, Dev B tiêu thụ. **Không đổi.**

### 3.2 `MediaAction` — cần thêm mới (Dev A viết, Dev B review)

Đây là thứ Dev A bắn xuống overlay của Dev B khi luật khớp:

```ts
export type MediaActionKind = 'PLAY_VIDEO' | 'SHOW_IMAGE' | 'PLAY_SOUND' | 'GAME_KEY';

export interface MediaAction {
  actionId: string;          // idempotency — overlay bỏ qua nếu trùng
  kind: MediaActionKind;
  channelId: string;
  mediaUrl?: string;         // PLAY_VIDEO | SHOW_IMAGE | PLAY_SOUND
  durationMs: number;        // overlay tự ẩn sau khoảng này
  keyCode?: number;          // GAME_KEY — virtual-key, xem allowlist keysim
  holdMs?: number;           // GAME_KEY
  // Dữ liệu vinh danh hiển thị kèm
  senderDisplayName: string;
  senderAvatar?: string;
  giftName: string;
  giftCoinValue: number;
}
```

**Vì sao có `actionId`:** WebSocket có thể gửi lại khi reconnect. Không có nó thì một món quà chạy video hai lần trước mặt người xem.

**Vì sao có `durationMs` mà không để overlay tự quyết:** hàng chờ ở server cần biết video dài bao lâu để xếp lịch món tiếp theo. Xem §4 Task A2.

### 3.3 Sự kiện WebSocket

| Tên sự kiện | Hướng | Payload | Chủ |
|---|---|---|---|
| `live_event` | Server → Client | `LiveEvent` | A |
| `media_action` | Server → Overlay | `MediaAction` | A phát, B nhận |
| `authenticate` | Client → Server | `{ token: string }` (JWT) | A |
| `authenticate_overlay` | Overlay → Server | `{ token: string }` (publicToken) | ⚠️ **chưa tồn tại**, xem §5 |

---

## 4. Các bước làm — theo thứ tự

### 🔴 BƯỚC 0 — Gỡ chặn (làm trước mọi thứ, không code)

| Việc | Ai | Ghi chú |
|---|---|---|
| Trả lời **Q-01**: lấy sự kiện TikTok bằng cách nào? | Cả hai + chủ dự án | **Đây là việc quan trọng nhất của cả dự án.** Chưa trả lời thì Bước 1 không bắt đầu được. `tiktok.service.ts` đã ghi rõ 3 phương án — chọn một, viết ra giấy, kèm rủi ro pháp lý |
| Trả lời **Q-02**: pháp nhân Việt Nam để mở cổng thanh toán | Chủ dự án | Chặn toàn bộ Bước 4. Không chặn MVP |

> Q-01 chặn Bước 1. Nếu chưa có câu trả lời, **vẫn làm được Bước 2 song song** bằng nút "Bắn sự kiện giả" (Task A1.3) — đó là lý do task đó tồn tại.

---

### 🟠 BƯỚC 1 — Bắt được sự kiện quà (chặn bởi Q-01)

**Dev A**
- **A1.1** — `tiktok.service.ts`: kết nối luồng TikTok theo phương án đã chốt ở Q-01, chuẩn hoá về `LiveEvent`, phát lên event bus `live.any`.
- **A1.2** — Gateway đã có sẵn `broadcastLiveEvent` ([events.gateway.ts:152](apps/server/src/modules/websocket/events.gateway.ts:152)) → không phải làm gì thêm ở phần fan-out.
- **A1.3** — **Nút bắn sự kiện giả** (`POST /tiktok/debug/emit`, chỉ bật khi `NODE_ENV !== 'production'`): đẩy một `LiveEvent` GIFT tự chế vào bus. **Làm task này TRƯỚC A1.1** — nó gỡ chặn hoàn toàn cho Dev B và cho cả Bước 2.

**Dev B**
- **B1.1** — Dashboard: ô nhập username TikTok + nút Kết nối/Ngắt, ba đèn trạng thái (TikTok / Local Bridge / OBS).
- **B1.2** — Bảng "Live Event Feed" trên dashboard: hiện `live_event` chảy về theo thời gian thực. Đây là công cụ debug cho cả hai người.

**Xong khi:** bấm nút giả lập → sự kiện hiện trên Live Event Feed trong dashboard.

---

### 🟢 BƯỚC 2 — Quà chạy được Media (ĐÂY LÀ MVP)

**Dev A**
- **A2.1** — Rule engine khớp quà: `giftName` hoặc `minCoinValue` → sinh `MediaAction`. `RuleEvaluator` trong shared đã có sẵn logic priority/cooldown, tái sử dụng.
- **A2.2** — **Media Queue**: 10 quà về cùng lúc thì **không** được bắn 10 video chồng lên nhau. Hàng chờ FIFO, mỗi action chờ `durationMs` của action trước. Có trần hàng chờ (ví dụ 20) — vượt thì bỏ bớt quà giá trị thấp, đừng để hàng chờ dài 5 phút.
- **A2.3** — Dispatcher: `media_action` → overlay (qua WS); `PLAY_SOUND`/`GAME_KEY` → Desktop (qua Local Bridge `127.0.0.1:4000`).
- **A2.4** — Desktop Go: nhận `MediaAction` từ Local Bridge → phát MP3, và gọi `keysim.PressKey` cho `GAME_KEY`. **Lưu ý:** `keysim` đã có allowlist phím + cooldown 1s + trần 60 lần/phút — quà về dồn dập sẽ bị chặn, đó là **cố ý**. UI phải hiện lỗi bị chặn chứ không nuốt im lặng.
- **A2.5** — Nút **Emergency Stop** trên Desktop: xoá sạch hàng chờ, nhả mọi phím đang giữ.

**Dev B**
- **B2.1** — `apps/web/app/overlays/media/page.tsx`: **bỏ `setInterval` giả lập** ([media/page.tsx:25](apps/web/app/overlays/media/page.tsx:25)), nối vào WS thật, nghe `media_action`. Chống trùng bằng `actionId`.
- **B2.2** — Trình phát video HTML5 MP4/WEBM nền trong suốt + ảnh + banner vinh danh (phần giao diện đã làm tốt rồi, giữ nguyên).
- **B2.3** — **Module upload media** (`apps/server/src/modules/media/`): nhận MP4/GIF/MP3, giới hạn dung lượng, kiểm tra MIME thật (không tin đuôi file), trả URL.
- **B2.4** — Gift Rule Builder UI: chọn quà → chọn media đã upload → đặt thời lượng → chọn phím game.

**Xong khi:** bấm nút giả lập trên dashboard → OBS hiện video + Desktop phát tiếng + phím được bấm trong game. **Đạt được điều này là MVP hoàn thành.**

---

### 🔵 BƯỚC 3 & 4 — Sau MVP

Giữ nguyên như `ROADMAP_AND_TASK_DIVISION.md` cũ: TTS (B), Chatbox/Goal overlay (B), RCON (A), thanh toán (B, chặn bởi Q-02).

---

## 5. ⚠️ Lỗ hổng thiết kế phát hiện được — phải quyết trước Bước 2

**Overlay không thể kết nối WebSocket hiện tại.** Đây không phải việc "chưa code", mà là thiếu một mảnh thiết kế:

- Gateway chỉ xác thực bằng **JWT** ([events.gateway.ts:71](apps/server/src/modules/websocket/events.gateway.ts:71)) và cho join phòng theo **kênh mà user sở hữu** ([events.gateway.ts:108](apps/server/src/modules/websocket/events.gateway.ts:108)).
- OBS Browser Source là một trang web **không có phiên đăng nhập** — nó chỉ cầm `publicToken` trong URL.
- Tệ hơn: model `Overlay` chỉ có `userId`, **không có `channelId`** ([schema.prisma:212](apps/server/prisma/schema.prisma:212)). Mà sự kiện lại phát vào phòng `channel_<channelId>`. Token overlay không tự suy ra được phòng cần join.

**Hai hướng, phải chọn một trước khi Dev B bắt đầu B2.1:**

| | Cách A — overlay tự tra kênh | Cách B — thêm `channelId` vào Overlay |
|---|---|---|
| Cách làm | Socket gửi `publicToken` → server tra `userId` → lấy mọi kênh của user → join hết | Thêm cột `channelId` vào model Overlay, token map thẳng 1-1 tới kênh |
| Ưu | Không cần migration | Rõ ràng, mỗi overlay gắn đúng 1 kênh |
| Nhược | User nhiều kênh thì overlay nhận sự kiện lẫn lộn | Cần migration + sửa UI tạo overlay |
| Khuyến nghị | | ✅ **Chọn cách B.** Streamer nhiều kênh là chuyện sẽ xảy ra, và lúc đó cách A hỏng theo kiểu khó phát hiện: video của kênh này nhảy sang overlay kênh kia |

**Dù chọn cách nào, bắt buộc:** handler `authenticate_overlay` phải cho socket đó ở chế độ **chỉ nhận** — không được join `user_*`, không được gọi `subscribe_channel`. `publicToken` nằm trong URL OBS, dễ lộ hơn JWT nhiều.

Việc này thuộc **Dev A** (chủ `modules/websocket/`), nhưng Dev B bị chặn cho tới khi xong → **ưu tiên cao nhất trong Bước 2**.

---

## 6. Những chỗ dễ vấp (đã thấy trước)

| Vấn đề | Xử lý |
|---|---|
| Quà về dồn dập → 10 video chồng nhau | Media Queue A2.2, không phải "để sau" |
| Cùng một quà chạy media 2 lần khi reconnect | `actionId` + Set đã-xử-lý ở overlay |
| Bấm phím bị `keysim` chặn, UI im lặng | Hiện lỗi lên System Logs của Desktop |
| Upload file: đổi đuôi `.mp4` cho file `.exe` | Kiểm tra magic bytes, không tin đuôi file |
| Overlay token lộ trong link OBS | Socket overlay chỉ-nhận (§5) + nút xoay token đã có |
| Hai người cùng sửa `schema.prisma` | R2 — migration 1 commit riêng, báo nhau trước |

---

## 7. Việc KHÔNG làm trong MVP

Ghi ra để khỏi bị cám dỗ: TTS, thanh toán/credit, RCON, PK bar, Goal bar, xác minh sở hữu kênh (chặn bởi Q-12), auto-update Desktop, ký số installer.

---

*Cập nhật lần cuối: 2026-08-06. Trạng thái code tham chiếu: commit `fc45055` (Desktop đã chuyển sang Go/Wails).*
