# Bằng chứng kiểm thử — Sàn Nhảy LiveNova

Ngày: 2026-08-15 · Nhánh `master` · Môi trường: Next.js dev @ `localhost:3000`, Chromium (Playwright)

Cách tạo lại toàn bộ số liệu và ảnh trong tài liệu này:

```bash
node scripts/disco-evidence.mjs
```

---

## 1. Sức khoẻ toàn dự án

| Kiểm tra | Lệnh | Kết quả |
|---|---|---|
| Kiểu (web) | `npx tsc -p apps/web/tsconfig.json --noEmit` | Sạch |
| Kiểu (server) | `npx tsc -p apps/server/tsconfig.json --noEmit` | Sạch |
| Lint toàn repo | `npm run lint` | Sạch |
| Test `packages/shared` | `pnpm -r run test` | **162 / 162 pass** |
| Test `apps/web` | | **210 / 210 pass** |
| Test `apps/server` | | **293 / 293 pass** |
| **Tổng** | | **665 test pass, 0 fail** |

Trước khi sửa: 616 test. Sau: 665 — **49 test mới**, toàn bộ cho bộ luật sự kiện sàn nhảy
(`packages/shared/src/disco/event-rules.spec.ts`).

---

## 2. Khung hình cho TikTok Live Studio (vấn đề gốc)

### 2.1 Điều đã sai

Overlay render đúng bằng kích thước khung Browser Source, và
`renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))` — mà trong OBS và TikTok
Live Studio `devicePixelRatio` **luôn bằng 1**. Kết quả: canvas render bằng đúng kích
thước CSS rồi bị phần mềm phát sóng phóng to khi streamer kéo giãn cho vừa khung dọc.

### 2.2 Đo đạc sau khi sửa — [E1]

Đặt Browser Source **sai** thành 16:9 (1280×720), `deviceScaleFactor = 1` — tái hiện
đúng điều kiện OBS:

```json
{
  "viewport":            { "w": 1280, "h": 720 },
  "devicePixelRatio":    1,
  "frameCssSize":        { "w": "1080px", "h": "1920px" },
  "frameTransform":      "translate(-50%, -50%) scale(0.375)",
  "canvasBackingStore":  { "w": 1080, "h": 1920 }
}
```

| Khẳng định | Kết quả |
|---|---|
| Khung vẫn là 1080×1920 dù viewport là 16:9 | **PASS** |
| Canvas render đủ 1080×1920 dù `devicePixelRatio = 1` | **PASS** |

Điểm mấu chốt: **`canvasBackingStore` là 1080×1920, không phải 1280×720**. Sàn nhảy vẽ ở
độ phân giải gốc bất kể khung nguồn được đặt thế nào, nên không còn ảnh bị phóng to.

Ảnh: `E1-khung-tren-viewport-16x9.png`

### 2.3 Khung dọc đúng chuẩn — [E2]

Ảnh chính, ở 540×960 với `deviceScaleFactor = 2` (ảnh xuất ra 1080×1920):

Ảnh: `E2-overlay-doc-9x16.png`

### 2.4 Vẫn dùng được cho OBS ngang — [E3]

Thêm `?ratio=16:9` vào link:

| Khẳng định | Kết quả |
|---|---|
| Khung đổi thành 1920×1080 | **PASS** |

Ảnh: `E3-khung-ngang-16x9.png`

Tham số hỗ trợ: `?ratio=9:16\|16:9\|1:1`, `?w=`, `?h=`, `?quality=` (nhân độ phân giải
render cho máy khoẻ), `?leddim=` (độ mờ màn LED).

---

## 3. Nghiệp vụ — [E4]

Kịch bản chạy qua **đúng bộ luật và đúng engine** mà buổi live dùng
(`/lab/disco-rules`): ba khán giả vào sàn bằng lệnh, hai người tặng quà nhỏ, một người
tặng Pháo Hoa Giấy 500 xu.

```json
{
  "djAfterBigGift":     "bot_dj_livenova",
  "bigGifterIsDj":      false,
  "podiumAfterBigGift": ["dai_gia", "khach_b", "khach_a"],
  "podiumPoints":       [150, 10, 2],
  "podiumSize":         3,
  "djOnPodium":         false,
  "totalDancers":       7,
  "rosaExpensive":      "ROSA_SPOTLIGHT",
  "sodaOneCoin":        "GENERIC",
  "heyCommand":         "join",
  "chatterCommand":     null
}
```

| Khẳng định | Kết quả |
|---|---|
| Ghế DJ vẫn là DJ LiveNova sau khi khách tặng quà lớn | **PASS** |
| Người tặng quà lớn **không** chiếm được ghế DJ | **PASS** |
| Người tặng quà lớn đứng hạng 1 trên bục | **PASS** |
| Bục chứa tối đa 3 người | **PASS** |
| DJ không có mặt trong bảng quà | **PASS** |
| Quà đắt có tên riêng không bị biến thành pháo hoa | **PASS** |
| Quà 1 xu tên lạ không bị biến thành hoa hồng | **PASS** |
| Comment "hey" là lệnh vào sàn | **PASS** |
| Comment tán gẫu không tạo nhân vật | **PASS** |

Hai dòng cuối của JSON là hai lỗi cụ thể mà bản audit nêu:

- `rosaExpensive: "ROSA_SPOTLIGHT"` — trước đây `giftCoins >= 100` nằm trong nhánh
  "Pháo Hoa Giấy", nên **mọi** quà từ 100 xu trở lên đều đăng quang TOP 1 kể cả khi tên
  quà chẳng liên quan. Giờ tên khớp trước, xu chỉ là lưới hứng khi không tên nào khớp.
- `sodaOneCoin: "GENERIC"` — trước đây `giftCoins === 1` nằm trong nhánh "Hoa hồng", nên
  mọi quà 1 xu đều thành hoa hồng.

Ảnh: `E4-nghiep-vu.png` (bảng số liệu + sân khấu), `E5-buc-top3.png` (cận cảnh bục)

Trong `E5-buc-top3.png` thấy rõ: **Đại Gia (150đ)** đứng ô giữa trong vòng vàng, Khách B
ô trái (vòng bạc), Khách A ô phải (vòng đồng); thanh HUD trên cùng ghi
`🥇 Đại Gia (150đ) | 🥈 Khách B` — **không có DJ trong bảng**.

---

## 4. Ba lỗi do chính ảnh chụp phát hiện

Đây là phần đáng giá nhất của việc chụp ảnh: cả ba lỗi này đều qua được typecheck, lint
và unit test.

### 4.1 Khung không căn giữa

Ảnh chụp đầu tiên cho thấy sân khấu dồn xuống góc dưới bên phải, chiếm đúng một phần tư
khung. Nguyên nhân: `display: grid` + `placeItems: center` căn một phần tử **lớn hơn** khung
cha thì mỗi trình duyệt xử lý một kiểu.

Sửa: định vị tuyệt đối `left/top: 50%` + `translate(-50%, -50%)` — cho kết quả như nhau ở
mọi nơi kể cả khi khung con tràn. ([FixedFrame.tsx](apps/web/components/overlays/FixedFrame.tsx))

### 4.2 Bục Top 3 bị chôn bên trong sân khấu DJ

Toạ độ `z = -8.6` trông hợp lý trên giấy. Thực tế: sân khấu DJ ở `z = -11.5` bán kính 6.4
nên trải từ `z = -17.9` tới `z = -5.1` và cao 1.3 — cả cái bục cao 0.55 nằm gọn bên trong,
không nhìn thấy được.

Sửa: `z = -3.6`, cao 0.75 — hẳn ra sàn trống phía trước, vẫn thấp hơn chỗ DJ đứng.

### 4.3 DJ vẫn chiếm hạng nhất bảng quà

Thanh HUD góc phải hiện `👑 DJ LiveNova (10đ)` dù DJ không hề nhận quà, vì nó gọi
`getTopDancers()` — hàm tính cả DJ. Khán giả tặng quà thật bị đẩy xuống hạng dưới.

Sửa: đổi sang `getPodiumDancers()`, hàm này loại DJ ra.

Ngoài ra, hai điều chỉnh thẩm mỹ cũng do ảnh chụp chỉ ra: camera khung dọc bỏ trống gần
40% đáy khung (đã hạ xuống và tiến gần lại), và viền neon phủ kín mặt bục thành một tấm
hồng phẳng (đã đổi thành dải mỏng ở cạnh trước).

---

## 5. Các thay đổi khác đã kiểm chứng bằng test

| Hạng mục | Bằng chứng |
|---|---|
| Bộ luật sự kiện tách ra `@livenova/shared`, dùng chung cho dashboard và overlay | 49 test trong `event-rules.spec.ts` |
| Overlay không còn xử lý trùng sự kiện (dashboard đã ngừng phát `liveAction`) | `apps/web/app/overlays/disco/page.tsx` — chỉ còn một đường vào |
| Đồng bộ nhạc/video/camera qua socket thay cho `BroadcastChannel` | `POST /overlays/:id/disco-sync` → `OVERLAY_STATE_EVENT` → `overlay.state` |
| Lớp phủ mờ màn LED (bản 3D và bản iframe YouTube) | `ledDim`, mặc định 0.28, có slider trong trang Disco |
| Hai bục VIP giữa sàn đã xoá cùng logic đặt nhân vật | `podiumRankById` thay cho `isTop2`/`isTop3` |

---

## 6. Giai đoạn 3, 4, 5 — bổ sung

### 6.1 Tách trang Disco (Giai đoạn 4)

| Tệp | Dòng |
|---|---|
| `app/(dashboard)/disco/page.tsx` — chỉ còn bố cục và state tab | **89** (trước: 1932) |
| `components/disco/use-disco-controller.ts` — toàn bộ logic, không JSX | 528 |
| `components/disco/scenarios.ts` — bốn kịch bản mô tả bằng dữ liệu | 222 |
| `components/disco/panels/*.tsx` — sáu khu giao diện | 771 |

Bố cục mới: sân khấu 9:16 dính bên trái, panel điều khiển theo tab bên phải.
Tab **Kiểm thử** đứng cuối, tách khỏi luồng vận hành để không bấm nhầm khi đang live.

Hai chỗ trùng lặp lớn được gộp lại:

- **Mười hai hàm mô phỏng** gần như giống hệt nhau (chỉ khác nội dung comment hoặc
  tên quà) → một hàm `simulate(payload, log)` nhận tham số.
- **Bốn kịch bản** là bốn nhánh `if` với `setTimeout` lồng nhau, mỗi bước tự tay đẩy
  timer vào một mảng ref → bảng dữ liệu `{ at, log, run }` cộng một bộ chạy duy nhất.
  Bộ chạy mới dọn timer khi rời trang, việc bản cũ hay quên.

### 6.2 Bộ component và bố cục đáp ứng (Giai đoạn 3)

`components/ui/primitives.tsx`: `Button`, `Input`, `Textarea`, `Field`, `Card`,
`Badge`, `Tabs`, `TabPanel`, `Switch`. Toàn bộ trang Disco đã chuyển sang dùng bộ này.

Kiểm tra tràn ngang (`node scripts/ui-evidence.mjs`):

| Kích thước | Kết quả |
|---|---|
| Desktop 1440×900 | **PASS** — scrollW 1440 / clientW 1440 |
| Tablet 820×1180 | **PASS** — scrollW 820 / clientW 820 |
| Mobile 390×844 | **PASS** — scrollW 390 / clientW 390 |

Dưới 1024px sidebar thu thành ngăn kéo có nền mờ, đóng bằng Escape hoặc bấm ra ngoài.
Khi đóng nó nhận `visibility: hidden` chứ không chỉ trượt ra ngoài màn hình — nếu không,
người dùng Tab sẽ lạc vào một danh sách liên kết vô hình.

### 6.3 Onboarding và cấu hình trên server (Giai đoạn 5)

- **Checklist ba bước** trên dashboard (liên kết kênh → tạo overlay → đặt kịch bản),
  đứng trên các ô số và tự biến mất khi xong cả ba.
- **Cấu hình sàn nhảy** chuyển sang `PATCH /overlays/:id/config`, ghi gộp nhịp 600ms
  vì thanh trượt độ mờ bắn hàng chục sự kiện mỗi giây. `localStorage` chỉ còn là bộ nhớ
  đệm khởi động nhanh. Giá trị đọc từ server được kiểm từng trường một, không ép kiểu
  cả cục — `config` là JSON tuỳ ý và một giá trị sai kiểu sẽ làm hỏng sân khấu giữa live.
- **Cài đặt giọng đọc**: phát hiện bảng `TtsSettings` đã tồn tại và
  `rule-engine.service.ts:296` đọc nó mỗi khi đọc bình luận trên sóng, nhưng chưa từng
  có route nào để giao diện đọc hay ghi — nên trang Giọng đọc lưu vào `localStorage`, và
  **giọng người dùng chọn không phải giọng thực sự phát trên sóng**. Đã thêm
  `GET /tts/settings` và `PATCH /tts/settings`, trang Giọng đọc nối vào đó.

---

## 7. An toàn bản quyền âm thanh

Overlay từng mặc định **bật tiếng**, cố ý để âm thanh YouTube phát thẳng ra sóng.
Nhưng như vậy là phát nhạc có bản quyền lên TikTok — hệ thống quét vân tay âm thanh
của họ bắt được, thường tắt tiếng buổi live trước rồi kết thúc live nếu lặp lại.

Ba thay đổi:

- Overlay **mặc định tắt tiếng**. Ai chủ động muốn phát tiếng vẫn bật được bằng
  `?audio=1`, nhưng phải tự gõ vào.
- Công tắc "Phát tiếng của video lên sóng" hiện cảnh báo **khi và chỉ khi đang bật** —
  hiện thường trực thì nó thành dòng chữ vàng người dùng học cách phớt lờ.
- Bỏ mẫu video YouTube khỏi danh sách gợi ý. Dán link vào ô nhập vẫn được nếu ai đó
  thật sự muốn; chỉ là không đề xuất nữa. Mẫu nhạc còn lại đều là Pixabay, miễn phí
  bản quyền.

| Khẳng định | Kết quả |
|---|---|
| Mặc định overlay tắt tiếng | **PASS** |
| Chỉ `?audio=1` mới bật tiếng | **PASS** |

Đây là thiết lập an toàn nên nó được canh bằng test (`E3b`), không chỉ bằng trí nhớ.

---

## 7. Phần chưa làm

- **Migrate phần còn lại sang bộ component** — trang Disco đã chuyển xong; `admin`,
  `battle/simulator`, `TeamBattleConfigEditor`, `RuleModal` vẫn dùng inline style.
