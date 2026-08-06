# LiveNova — Chia việc theo FEATURE cho 2 Dev

**Ngày:** 2026-08-06 · **Commit gốc:** `09dbc39`
**Mô hình:** Mỗi dev sở hữu **trọn vẹn một feature theo lát cắt dọc** (DB → API → WS → UI → Test)
**Bổ sung cho:** `FEATURES_AND_2DEV_PLAN.md` (bản chia theo thư mục). Hai file khác mô hình — **chọn một, đừng dùng cả hai.**

---

## 0. Đọc phần này trước — nếu không, plan sẽ hỏng

### Vấn đề của việc chia theo feature

Chia theo feature nghĩa là Dev A làm trọn "Quà → Video" từ database lên tới giao diện, Dev B làm trọn "Chatbox Overlay" cũng từ database lên tới giao diện.

Nghe thì tách bạch. Nhưng thực tế **cả hai đều phải sửa cùng những file này**:

| File | Vì sao cả hai đều đụng |
|---|---|
| `packages/shared/src/types/index.ts` | Cả hai đều thêm type mới |
| `apps/server/prisma/schema.prisma` | Cả hai đều thêm model/enum |
| `apps/server/src/app.module.ts` | Cả hai đều đăng ký module |
| `apps/server/src/modules/rule/rule-engine.service.ts` | Cả hai đều cần luật kích hoạt hành động của mình |
| `apps/server/src/modules/websocket/overlay.gateway.ts` | Cả hai đều cần đẩy dữ liệu ra overlay |
| `apps/web/components/common/Navbar.tsx` | Cả hai đều thêm link menu |

→ **Xung đột git mỗi ngày, ở đúng những file nhạy cảm nhất.**

### Cách chữa: 3 thay đổi cấu trúc + 1 sprint nền móng

Chia theo feature **chỉ chạy được** sau khi làm 3 việc dưới đây. Nếu bỏ qua, đừng dùng mô hình này — hãy dùng bản chia theo thư mục.

| # | Thay đổi | Biến file tranh chấp thành |
|---|---|---|
| 1 | **Tách `shared/types` thành file theo feature** | Mỗi dev một file riêng, `index.ts` chỉ còn dòng re-export |
| 2 | **Action Plugin Registry** | Engine và Gateway viết **một lần**, sau đó không ai sửa nữa. Feature mới = thêm file handler mới |
| 3 | **Route/Nav registry** | Menu sinh từ mảng, mỗi feature thêm 1 file |

Ba việc này = **Sprint 0**, khoảng **1 tuần**. Sau đó hai dev thật sự không đụng nhau nữa.

---

## 1. Sprint 0 — Nền móng (bắt buộc, làm trước)

> Sau sprint này, các file nền **đóng băng**. Muốn sửa phải có lý do và cả hai đồng ý.

### 1.1 Tách shared types

**Trước:**
```
packages/shared/src/types/index.ts        ← 270 dòng, cả hai cùng sửa
```

**Sau:**
```
packages/shared/src/types/
├── index.ts          ← CHỈ chứa export *, append-only, 1 dòng/feature
├── core.ts           ← LiveEvent, User, Rule, Channel (đóng băng sau Sprint 0)
├── overlay-action.ts ← OverlayAction, RuleActionType (đóng băng)
├── media.ts          ← MediaPopupPayload        [Dev A sở hữu]
├── tts.ts            ← TtsRequest, TtsSettings  [Dev A sở hữu]
├── chatbox.ts        ← ChatboxPayload           [Dev B sở hữu]
├── goal.ts           ← GoalPayload              [Dev B sở hữu]
└── ...               ← mỗi feature một file
```

`index.ts` chỉ có dạng này, mỗi người thêm đúng 1 dòng vào cuối:
```ts
export * from './core';
export * from './overlay-action';
export * from './media';      // A
export * from './tts';        // A
export * from './chatbox';    // B
export * from './goal';       // B
```

Git merge 2 dòng thêm ở cuối file khác nhau → **không xung đột**.

### 1.2 Action Plugin Registry — thay đổi quan trọng nhất

**Ý tưởng:** Rule Engine và Overlay Gateway viết **một lần duy nhất** ở Sprint 0, xử lý mọi loại action một cách tổng quát. Thêm feature mới **không sửa** hai file đó.

```
apps/server/src/modules/actions/
├── action-handler.interface.ts   ← đóng băng sau Sprint 0
├── action-registry.service.ts    ← đóng băng
├── actions.module.ts             ← APPEND-ONLY (1 dòng/feature)
├── media/media.handler.ts        [Dev A]
├── tts/tts.handler.ts            [Dev A]
├── game/game.handler.ts          [Dev A]
├── chatbox/chatbox.handler.ts    [Dev B]
├── goal/goal.handler.ts          [Dev B]
└── pk/pk.handler.ts              [Dev B]
```

Interface (viết ở Sprint 0, sau đó không đổi):

```ts
export interface ActionHandler {
  /** Loại action handler này phụ trách. */
  readonly type: RuleActionType;

  /** Kiểm tra payload người dùng cấu hình. Ném BadRequest nếu sai. */
  validate(payload: unknown): Record<string, unknown>;

  /**
   * Chạy khi luật khớp. Trả về OverlayAction để đẩy ra overlay,
   * hoặc null nếu action này không hiển thị gì (vd: game input).
   */
  execute(ctx: ActionContext): Promise<OverlayAction | null>;
}
```

Rule Engine chỉ làm: `registry.get(action.type).execute(ctx)`.
Overlay Gateway chỉ làm: nhận `OverlayAction` bất kỳ → đẩy vào room của user.

**Thêm feature mới = thêm 1 file handler + 1 dòng vào `actions.module.ts`.** Không đụng engine, không đụng gateway.

### 1.3 Prisma schema — tách theo feature

Prisma 5.22 hỗ trợ `prismaSchemaFolder` (preview):

```
apps/server/prisma/schema/
├── schema.prisma      ← datasource + generator (đóng băng)
├── core.prisma        ← User, Session, Channel, Rule, Overlay (đóng băng)
├── credit.prisma      [Dev A]
├── media.prisma       [Dev A]
├── tts.prisma         [Dev A]
├── game.prisma        [Dev A]
└── analytics.prisma   [Dev B]
```

**Nếu không muốn dùng preview feature:** giữ 1 file, và áp quy tắc — **chỉ Dev A được sửa schema**, Dev B mô tả model cần thiết trong PR description, A thêm giúp trong ngày. Chậm hơn nhưng an toàn.

### 1.4 Nav registry

```
apps/web/config/nav/
├── index.ts           ← append-only barrel
├── media.nav.ts       [Dev A]
├── chatbox.nav.ts     [Dev B]
└── ...
```

`Navbar.tsx` map qua mảng, **không ai sửa `Navbar.tsx` nữa**.

### 1.5 Task Sprint 0

| ID | Task | Dev | SP |
|---|---|---|---|
| S0-1 | Tách `shared/types` thành file-per-feature + barrel | A | 3 |
| S0-2 | `ActionHandler` interface + `ActionRegistry` + `actions.module.ts` | A | 5 |
| S0-3 | `RuleEngineService` tổng quát (nghe `live.any` → registry) + test | A | 5 |
| S0-4 | `OverlayGateway` tổng quát (`/overlay`, auth bằng publicToken) + test | B | 5 |
| S0-5 | `useOverlaySocket` hook (reconnect, khử trùng lặp) | B | 3 |
| S0-6 | Nav registry + `Navbar` đọc từ mảng | B | 2 |
| S0-7 | Tách Prisma schema (hoặc chốt quy tắc "chỉ A sửa") | A | 3 |
| S0-8 | Viết `CODEOWNERS` + bảng sở hữu vào README | A+B | 1 |

**Sprint 0: 27 SP ≈ 1 tuần.** Sau đó đóng băng và không quay lại.

---

## 2. Danh mục Feature — mỗi feature một chủ

Sau Sprint 0. Mỗi feature là **lát cắt dọc trọn vẹn**: model → handler → API → overlay → UI cấu hình → test.

### 2.1 Bảng phân công

| ID | Feature | Dev | Ưu tiên | SP | Chặn bởi |
|---|---|---|---|---|---|
| **F01** | **🔥 Quà → Video/Ảnh Popup (MVP)** | **A** | **P0** | **21** | — |
| **F02** | **Kết nối kênh + Feed sự kiện live** | **B** | **P0** | **18** | — |
| F03 | TTS đọc bình luận & tên người tặng | A | P1 | 34 | Q-21 |
| F04 | Overlay Chatbox | B | P1 | 13 | — |
| F05 | Credit, Quota & Cảnh báo hết | A | P1 | 16 | — |
| F06 | Overlay Thanh mục tiêu (Goal) | B | P1 | 13 | — |
| F07 | Quà → Bấm phím Game (Go) | A | P2 | 21 | — |
| F08 | Overlay Thanh PK nhiều đội | B | P2 | 21 | — |
| F09 | Điều khiển OBS (Go) | A | P2 | 18 | — |
| F10 | Overlay Bảng xếp hạng | B | P2 | 13 | — |
| F11 | Thanh toán VNPay/MoMo | A | P2 | 34 | Q-02 |
| F12 | Admin Console | B | P2 | 24 | — |
| F13 | Ingest TikTok thật | A | P0* | 21 | **Q-01** |
| F14 | Landing/SEO/i18n/Dark mode/A11y | B | P1 | 31 | — |
| F15 | Thư viện hiệu ứng + Upload media | A | P3 | 21 | — |
| F16 | Onboarding + Trung tâm trợ giúp | B | P3 | 16 | — |
| F17 | Analytics & Thống kê phiên live | A | P3 | 21 | — |
| F18 | Overlay Hiệu ứng vào phòng | B | P3 | 13 | — |
| | **TỔNG** | | | **369** | |

`P0*` = F13 ưu tiên cao nhưng bị chặn hoàn toàn bởi Q-01.

**Cân bằng:** Dev A 207 SP · Dev B 162 SP. Chuyển F15 (21 SP) sang B → 186/183. Cân.

### 2.2 Nguyên tắc xếp lịch

Luôn chạy **1 feature Dev A ∥ 1 feature Dev B** cùng lúc, chọn cặp có file không giao nhau:

```
Sprint 1  : A=F01 Quà→Media    ║  B=F02 Kết nối kênh + Feed
Sprint 2  : A=F05 Credit       ║  B=F04 Chatbox
Sprint 3  : A=F03 TTS          ║  B=F06 Goal Bar
Sprint 4  : A=F03 TTS (tiếp)   ║  B=F14 Landing/SEO/Dark
Sprint 5  : A=F07 Game Input   ║  B=F08 PK Bar
Sprint 6  : A=F09 OBS Control  ║  B=F10 Leaderboard
Sprint 7  : A=F11 Thanh toán   ║  B=F12 Admin
Sprint 8  : A=F17 Analytics    ║  B=F16 Onboarding
```

---

## 3. Đặc tả từng feature — file độc quyền

> Mỗi bảng dưới đây liệt kê **chính xác** những file thuộc về feature đó. Dev khác không mở những file này.

### 🔥 F01 — Quà → Video/Ảnh Popup (MVP) · **Dev A** · 21 SP

**Mục tiêu:** Có người tặng quà trên TikTok → video hoặc ảnh hiện lên trong OBS trong ≤300ms.

| Loại | File độc quyền |
|---|---|
| Types | `packages/shared/src/types/media.ts` |
| Handler | `apps/server/src/modules/actions/media/media.handler.ts` |
| Handler | `apps/server/src/modules/actions/media/media.handler.spec.ts` |
| Validator | `apps/server/src/modules/actions/media/media-payload.validator.ts` |
| Overlay | `apps/web/app/overlays/media/page.tsx` |
| Overlay | `apps/web/app/overlays/media/media-queue.ts` |
| UI cấu hình | `apps/web/app/(dashboard)/rules/media/**` |
| Nav | `apps/web/config/nav/media.nav.ts` |
| E2E | `apps/web/e2e/gift-to-media.spec.ts` |

**Append-only (thêm 1 dòng):** `types/index.ts`, `actions.module.ts`, `config/nav/index.ts`

**Việc cần làm:**
1. `MediaPopupPayload` — mediaType, url, durationMs, position, volume, caption *(đã có sẵn trong shared types, chuyển sang `media.ts`)*
2. `MediaHandler.validate()` — URL phải https, chặn địa chỉ nội bộ, clamp duration 500–30000ms
3. `MediaHandler.execute()` — dựng `OverlayAction`, trả về cho engine
4. Trang overlay: **bỏ `setInterval` giả lập**, nhận action thật, hàng đợi FIFO (max 20), render video/ảnh, nền trong suốt
5. UI: chọn quà → ngưỡng coin → URL media → thời lượng → vị trí → **nút Test bắn thử**
6. Test: khớp quà, không khớp, cooldown, hàng đợi tràn, URL độc hại

**Xong khi:** dán URL overlay vào OBS, tặng quà thật (hoặc giả lập) → video chạy. Hết credit → **video vẫn chạy** (BR-10).

---

### F02 — Kết nối kênh + Feed sự kiện live · **Dev B** · 18 SP

| Loại | File độc quyền |
|---|---|
| Types | `packages/shared/src/types/channel-ui.ts` |
| API | `apps/server/src/modules/channel/channel.controller.ts` *(đã có, B tiếp quản)* |
| UI | `apps/web/app/(dashboard)/channels/**` |
| UI | `apps/web/components/live-feed/**` |
| Hook | `apps/web/lib/use-events-socket.ts` |
| Nav | `apps/web/config/nav/channels.nav.ts` |

**Việc cần làm:**
1. UI liên kết kênh: nhập handle → hiện mã xác minh → hướng dẫn dán vào bio
2. Trạng thái realtime: đang live / offline / mất kết nối (cập nhật ≤5s — FR-014)
3. Feed sự kiện live: bình luận, quà, tim, follow chảy realtime qua `/events`
4. Hủy liên kết kênh
5. Trạng thái rỗng/lỗi tử tế

**Lưu ý:** `ChannelService.verify()` đang bị chặn bởi **Q-12** — hiện từ chối thay vì cấp quyền bừa. B làm UI trước, khi Q-12 có lời giải thì chỉ cần bỏ chặn.

---

### F03 — TTS đọc bình luận & người tặng · **Dev A** · 34 SP · ⛔ Q-21

| Loại | File độc quyền |
|---|---|
| Types | `packages/shared/src/types/tts.ts` |
| Service | `apps/server/src/modules/tts/**` *(đã có phần cache/metering)* |
| Handler | `apps/server/src/modules/actions/tts/tts.handler.ts` |
| Queue | `apps/server/src/modules/tts/speech-queue.service.ts` |
| Desktop | `apps/desktop-app/internal/audio/**` |
| UI | `apps/web/app/(dashboard)/tts/**` |

Hàng đợi ưu tiên (BR-22), bỏ qua câu (≤200ms — FR-026), mẫu câu tùy biến, lọc từ cấm, phát ra thiết bị ảo.

---

### F04 — Overlay Chatbox · **Dev B** · 13 SP

| Loại | File độc quyền |
|---|---|
| Types | `packages/shared/src/types/chatbox.ts` |
| Handler | `apps/server/src/modules/actions/chatbox/chatbox.handler.ts` |
| Overlay | `apps/web/app/overlays/chat/page.tsx` |
| UI | `apps/web/app/(dashboard)/overlays/chatbox/**` |

Mượt ở 100 bình luận/phút không giật (NFR-05). Ảo hóa danh sách nếu cần.

---

### F05 — Credit, Quota & Cảnh báo · **Dev A** · 16 SP

| Loại | File độc quyền |
|---|---|
| Service | `apps/server/src/modules/credit/**` *(đã có phần lõi)* |
| Cron | `apps/server/src/modules/credit/quota.scheduler.ts` |
| UI | `apps/web/app/(dashboard)/billing/credits/**` |

Cron cấp quota ngày theo timezone user (BR-06), cảnh báo ở mức 20% (BR-09), lịch sử ledger.

---

### F06 — Overlay Goal Bar · **Dev B** · 13 SP

`types/goal.ts` · `actions/goal/goal.handler.ts` · `app/overlays/goal/page.tsx` · `app/(dashboard)/overlays/goal/**`

---

### F07 — Quà → Bấm phím Game · **Dev A** · 21 SP

| Loại | File độc quyền |
|---|---|
| Types | `packages/shared/src/types/game.ts` |
| Handler | `apps/server/src/modules/actions/game/game.handler.ts` |
| Desktop | `apps/desktop-app/internal/keysim/**` *(đã có giới hạn an toàn)* |
| Desktop | `apps/desktop-app/internal/bridge/**` *(nối keysim vào bridge)* |
| UI | `apps/web/app/(dashboard)/games/**` |

⚠️ **F07 không được merge trước khi có nút dừng khẩn cấp toàn cục (FR-057).**

---

### F08 — Overlay PK Bar · **Dev B** · 21 SP
### F09 — Điều khiển OBS · **Dev A** · 18 SP
### F10 — Overlay Bảng xếp hạng · **Dev B** · 13 SP
### F11 — Thanh toán · **Dev A** · 34 SP · ⛔ Q-02
### F12 — Admin Console · **Dev B** · 24 SP
### F13 — Ingest TikTok thật · **Dev A** · 21 SP · ⛔ Q-01
### F14 — Landing/SEO/i18n/Dark/A11y · **Dev B** · 31 SP
### F15–F18 — xem bảng §2.1

*(Chi tiết file cho F08–F18 sinh theo đúng khuôn mẫu ở trên: `types/<feature>.ts` + `actions/<feature>/` + `app/overlays/<feature>/` hoặc `app/(dashboard)/<feature>/` + `config/nav/<feature>.nav.ts`.)*

---

## 4. Các file APPEND-ONLY và giao thức

Bốn file cả hai đều phải thêm dòng. Quy tắc để không xung đột:

| File | Thêm gì | Quy tắc |
|---|---|---|
| `shared/src/types/index.ts` | `export * from './<feature>';` | Thêm **cuối file**. A thêm ở nhóm A, B ở nhóm B |
| `actions/actions.module.ts` | 1 dòng vào mảng `providers` | Giữ thứ tự alphabet |
| `web/config/nav/index.ts` | 1 dòng vào mảng | Giữ thứ tự alphabet |
| `app.module.ts` | 1 dòng vào `imports` | Chỉ khi tạo module mới (hiếm) |

**Nếu vẫn xung đột:** cả hai chỉ thêm dòng khác nhau ở cuối → `git rebase` giải quyết trong 10 giây, giữ cả hai dòng. Không bao giờ có xung đột logic.

**Cấm tuyệt đối:** sắp xếp lại, format lại, hoặc refactor 4 file này. Chỉ thêm dòng.

---

## 5. CODEOWNERS

Tạo `.github/CODEOWNERS` để GitHub tự gán reviewer và chặn merge nhầm:

```
# Nền móng — đóng băng sau Sprint 0, cần CẢ HAI duyệt
/packages/shared/src/types/core.ts            @dev-a @dev-b
/packages/shared/src/types/overlay-action.ts  @dev-a @dev-b
/apps/server/src/modules/actions/action-*.ts  @dev-a @dev-b
/apps/server/src/modules/rule/rule-engine.*   @dev-a @dev-b
/apps/server/src/modules/websocket/           @dev-a @dev-b
/apps/server/prisma/                          @dev-a

# Dev A
/packages/shared/src/types/media.ts           @dev-a
/packages/shared/src/types/tts.ts             @dev-a
/packages/shared/src/types/game.ts            @dev-a
/apps/server/src/modules/actions/media/       @dev-a
/apps/server/src/modules/actions/tts/         @dev-a
/apps/server/src/modules/actions/game/        @dev-a
/apps/server/src/modules/credit/              @dev-a
/apps/server/src/modules/tts/                 @dev-a
/apps/server/src/modules/billing/             @dev-a
/apps/server/src/modules/tiktok/              @dev-a
/apps/desktop-app/                            @dev-a
/apps/web/app/overlays/media/                 @dev-a
/apps/web/app/(dashboard)/billing/             @dev-a

# Dev B
/packages/shared/src/types/chatbox.ts         @dev-b
/packages/shared/src/types/goal.ts            @dev-b
/apps/server/src/modules/actions/chatbox/     @dev-b
/apps/server/src/modules/actions/goal/        @dev-b
/apps/server/src/modules/admin/               @dev-b
/apps/server/src/modules/overlay/             @dev-b
/apps/web/                                    @dev-b
/apps/web/app/overlays/media/                 @dev-a
```

*(Dòng cuối đặt sau `/apps/web/` để giành lại thư mục media cho A — CODEOWNERS lấy quy tắc khớp cuối cùng.)*

---

## 6. So sánh hai mô hình — chọn cái nào?

| | Chia theo **thư mục** (`FEATURES_AND_2DEV_PLAN.md`) | Chia theo **feature** (file này) |
|---|---|---|
| Cần refactor trước | Không | **Có — Sprint 0, 1 tuần** |
| Nguy cơ xung đột git | Rất thấp ngay lập tức | Thấp **sau** Sprint 0 |
| Mỗi dev học được gì | A giỏi backend, B giỏi frontend | Cả hai làm full-stack |
| Ai giao được MVP | Cần **cả hai** phối hợp | **Một mình Dev A** giao được F01 |
| Rủi ro xe buýt (bus factor) | Cao — chỉ A biết backend | Thấp — cả hai biết mọi tầng |
| Review code | Khó (mỗi người một vùng) | Dễ (cùng hiểu cấu trúc) |
| Phù hợp khi | Hai dev khác chuyên môn rõ rệt | Hai dev đều full-stack |

**Khuyến nghị của tôi:** nếu hai bạn đều làm được full-stack → dùng file này, bỏ 1 tuần cho Sprint 0. Lợi ích lớn nhất không phải là tránh xung đột, mà là **MVP không còn phụ thuộc vào việc hai người phải ăn khớp nhau** — Dev A giao được F01 một mình từ đầu đến cuối.

Nếu một bạn chỉ mạnh frontend → dùng bản chia theo thư mục, đừng ép.

---

## 7. Bắt đầu ngay

**Tuần này — Sprint 0 (cả hai):**

- Dev A: S0-1 tách types → S0-2 Action Registry → S0-3 Rule Engine → S0-7 Prisma
- Dev B: S0-4 Overlay Gateway → S0-5 hook socket → S0-6 nav registry

Cuối tuần: merge, đóng băng nền móng, viết `CODEOWNERS`.

**Tuần sau — Sprint 1:**

- Dev A: **F01 Quà → Video/Ảnh** — MVP bạn muốn, làm trọn một mình
- Dev B: **F02 Kết nối kênh + Feed sự kiện**

Từ lúc này trở đi, hai người không mở file của nhau nữa.

---

## 8. Ba điều tuyệt đối không lặp lại

Rút từ audit — cả ba đều thuộc mẫu "trông như đã bảo vệ nhưng thực chất không":

1. **Không viết cơ chế bảo vệ mà không bật.** `ValidationPipe` không có DTO, `ThrottlerModule` không gắn guard. Viết xong phải có test chứng minh nó **chặn** được, không chỉ test đường thành công.
2. **Không trả thành công giả.** Chưa làm thì trả lỗi tường minh (`ErrNotImplemented` như `internal/obs`), đừng `return true`.
3. **Không bỏ qua `userId` trong service.** Mọi truy vấn theo id phải kèm `where: { id, userId }`.

Áp dụng trực tiếp cho mô hình này: **mỗi `ActionHandler.validate()` phải có test với payload độc hại**, không chỉ payload hợp lệ.
