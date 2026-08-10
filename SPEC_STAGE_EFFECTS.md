# SPEC — Stage Effects (Hiệu ứng sân khấu)

**Trạng thái:** Draft
**Ngày:** 2026-08-10
**Nguồn cảm hứng:** audit `ArsiIksait/DJ_Club` + `mh3400425/XiuGouDisco-master`
**Surface:** Web (Next.js). Desktop app **không** thay đổi.

---

## 1. Mục tiêu

Cho phép viewer kích hoạt hiệu ứng thị giác trên OBS bằng comment hoặc quà tặng —
khói, pháo hoa, đèn nhấp nháy, rung màn hình, hype burst.

DJ_Club chứng minh 5–6 lệnh đơn giản đủ giữ chân viewer trong live nhạc/dance.
LiveNova đã có sẵn 90% hạ tầng cần thiết; spec này lấp phần còn thiếu.

**Không thuộc phạm vi:** avatar-per-viewer, gift leaderboard (spec riêng),
điều khiển đèn/scene OBS thật (`OBS_COMMAND`, đã có đường đi riêng).

---

## 2. Hiện trạng — cái gì đã có, cái gì thiếu

| Thành phần | Trạng thái |
|---|---|
| `RuleActionType.EFFECT` | ✅ Đã có — [`packages/shared/src/types/index.ts:23`](packages/shared/src/types/index.ts) |
| Rule engine nhận diện `EFFECT` | ✅ Đã có trong `OVERLAY_ACTIONS` — [`rule-engine.service.ts:64`](apps/server/src/modules/rule/rule-engine.service.ts) |
| Điều kiện `keywords` / `minCoinValue` / `cooldownMs` | ✅ Đã có — [`rule.dto.ts`](apps/server/src/modules/rule/dto/rule.dto.ts) |
| Dispatch tới browser source | ✅ Đã có — [`overlay.gateway.ts:140`](apps/server/src/modules/websocket/overlay.gateway.ts) |
| **Kiểu payload `EffectPayload`** | ❌ **Thiếu** |
| **Validate/clamp payload server-side** | ❌ **Thiếu** — `normalisePayload` chỉ xử lý `MEDIA_POPUP` |
| **Định tuyến tới overlay phù hợp** | ❌ **Sai** — `resolveAlertOverlay()` ép mọi action về overlay `MEDIA` |
| **Renderer** | ❌ **Thiếu** — [`media/page.tsx`](apps/web/app/overlays/media/page.tsx) `return` sớm với action lạ |
| **UI chọn effect khi tạo rule** | ❌ **Thiếu** |

> **Hệ quả hiện tại:** tạo rule `EFFECT` qua API thì server dispatch thành công,
> gateway gửi xuống socket, browser source nhận được — rồi im lặng bỏ qua.
> Không có lỗi, không có log. Đây là lỗi "câm" cần sửa (xem §7 R-3).

---

## 3. Kiến trúc

```
TikTok event
   │
   ▼
modules/tiktok ──► live.any ──► rule-engine.service
                                    │  match conditions (keywords / minCoinValue / cooldown)
                                    ▼
                              normalisePayload()   ← THÊM: validate + clamp EffectPayload
                                    │
                                    ▼
                              resolveEffectOverlay()  ← THÊM: ưu tiên STAGE, fallback MEDIA
                                    │
                                    ▼
                        OVERLAY_DISPATCH_EVENT ──► overlay.gateway ──► socket room
                                                                          │
                                                                          ▼
                                              apps/web/app/overlays/stage/page.tsx  ← THÊM
                                                          │
                                                          ▼
                                              <EffectLayer />  (canvas + CSS)
```

**Desktop app: không đổi.** Không có renderer trong `internal/`; hiệu ứng là đồ hoạ
trên OBS browser source. Local bridge (`ws://127.0.0.1:4000`) có thể dùng làm
transport độ trễ thấp ở phase sau (§9), không phải điều kiện tiên quyết.

---

## 4. Kiểu dữ liệu (`packages/shared/src/types/index.ts`)

```ts
export enum StageEffectKind {
  SMOKE      = 'smoke',       // khói bốc từ mép dưới
  FIREWORKS  = 'fireworks',   // pháo hoa nổ ngẫu nhiên
  CONFETTI   = 'confetti',    // giấy màu rơi
  STROBE     = 'strobe',      // đèn nhấp nháy
  SHAKE      = 'shake',       // rung toàn khung
  HYPE       = 'hype',        // burst tổng hợp: confetti + strobe ngắn
}

export interface EffectPayload {
  kind: StageEffectKind;
  /** Thời lượng hiển thị (ms). Clamp server-side về [500, 15_000]. */
  durationMs: number;
  /** Cường độ 0..1. Clamp về [0, 1]. Mặc định 0.6. */
  intensity?: number;
  /** Màu chủ đạo, chỉ chấp nhận `#RRGGBB`. Bỏ qua nếu sai định dạng. */
  color?: string;
  /** Caption ngắn hiện kèm hiệu ứng. Đi qua interpolate({sender}/{gift}). */
  caption?: string;
}

export const EFFECT_DURATION_MIN_MS = 500;
export const EFFECT_DURATION_MAX_MS = 15_000;
/** Số hiệu ứng chạy đồng thời tối đa trên một overlay. */
export const EFFECT_MAX_CONCURRENT = 4;
```

Thêm `STAGE` vào `enum OverlayType` trong [`apps/server/prisma/schema.prisma`](apps/server/prisma/schema.prisma)
(hiện có `ALERTS, CHAT, GOAL, PK_BAR, LEADERBOARD, ROOM_ENTRY, MEDIA, GAME_BATTLE`) + migration.

---

## 5. Thay đổi phía server

### 5.1 `rule-engine.service.ts` — `normalisePayload()`

Thêm nhánh song song với nhánh `MEDIA_POPUP` hiện có:

```ts
if (action.type === RuleActionType.EFFECT) {
  return normaliseEffectPayload(payload); // trong packages/shared
}
```

`normaliseEffectPayload` phải:
- Từ chối `kind` không nằm trong `StageEffectKind` → trả `null`, engine log warn và **bỏ qua action** (không dispatch).
- Clamp `durationMs` về `[500, 15_000]`; giá trị thiếu/không phải số → 3000.
- Clamp `intensity` về `[0, 1]`; mặc định 0.6.
- `color`: chỉ nhận `/^#[0-9a-fA-F]{6}$/`, sai thì **bỏ trường** (không throw).
- `caption`: cắt còn 80 ký tự sau khi interpolate.

> Lý do clamp ở server: payload đến từ `RuleActionDto.payload` là
> `Record<string, unknown>` — hiện **không được validate**. Một rule với
> `durationMs: 999999999` sẽ đóng băng overlay vĩnh viễn.

### 5.2 `rule-engine.service.ts` — định tuyến overlay

`resolveAlertOverlay()` hiện hardcode `type: 'MEDIA'`. Tách thành:

```ts
private async resolveOverlayFor(userId: string, actionType: RuleActionType): Promise<string | null>
```

- `EFFECT` → tìm overlay `STAGE`; nếu không có → fallback `MEDIA`.
- Các action khác → giữ nguyên hành vi hiện tại (`MEDIA`).
- Giữ nguyên cơ chế cache `alertOverlays` nhưng key theo `${userId}:${type}`,
  và vẫn phải bị invalidate bởi `OVERLAY_CHANGED_EVENT` như hiện nay.

### 5.3 `overlay.service.ts` — overlay mặc định

Thêm `OverlayType.STAGE` vào mảng `defaultTypes` trong `getOverlays()` để user
hiện hữu tự động được cấp overlay + `publicToken` khi mở trang Overlays.

### 5.4 Không đổi

`overlay.gateway.ts` không cần sửa — nó agnostic với `action.type`.

---

## 6. Thay đổi phía web

### 6.1 Trang overlay mới — `apps/web/app/overlays/stage/page.tsx`

Theo đúng khuôn mẫu của `overlays/media/page.tsx`:

- `'use client'`, đọc `token` từ `useSearchParams()`.
- `useEffect` set `backgroundColor = 'transparent'` cho cả `body` và
  `documentElement` (chromakey OBS).
- `useOverlaySocket(token, handleAction)`.
- `handleAction`: `if (action.type !== RuleActionType.EFFECT) return;`
- Đẩy vào state `activeEffects: EffectInstance[]`, gỡ khi hết `durationMs`.

### 6.2 Component `apps/web/components/overlays/EffectLayer.tsx`

| Effect | Kỹ thuật | Ghi chú |
|---|---|---|
| `CONFETTI` | Canvas 2D, particle pool cố định | Tái dùng ý tưởng `confetti.js` của XiuGou nhưng **viết lại**, không copy |
| `FIREWORKS` | Canvas 2D, cùng particle system | Chia sẻ chung một `requestAnimationFrame` loop với confetti |
| `SMOKE` | 3–4 `<div>` CSS `filter: blur()` + keyframe `translateY` | Không dùng canvas |
| `STROBE` | Một `<div>` full-screen, CSS `animation: strobe` | **Bắt buộc** xem §8 |
| `SHAKE` | CSS `transform: translate()` trên container gốc | Biên độ tỉ lệ `intensity`, tối đa 12px |
| `HYPE` | Compose: `CONFETTI` + `STROBE` 800ms | Không phải effect riêng ở tầng render |

**Ràng buộc bắt buộc:**
- **Một** `requestAnimationFrame` loop duy nhất cho toàn bộ canvas effect.
  Không `setInterval`. (XiuGou dùng `setInterval(..., 10)` chạy 100 lần/giây vĩnh viễn — không lặp lại.)
- Particle pool **cấp phát trước, kích thước cố định**; không `new` trong vòng lặp vẽ.
- Huỷ `rAF` trong cleanup của `useEffect`.
- `pointer-events: none` trên mọi lớp — không được chặn tương tác OBS.
- Nếu số effect đang chạy ≥ `EFFECT_MAX_CONCURRENT`, **loại bỏ effect cũ nhất**
  chứ không xếp hàng — hiệu ứng cũ 10 giây trước không còn ý nghĩa.
- `caption` render bằng `{text}` của React. **Tuyệt đối không** `dangerouslySetInnerHTML`
  và không nối chuỗi HTML. (XiuGou dùng `insertAdjacentHTML` với username → stored XSS.)

### 6.3 UI cấu hình — `apps/web/app/(dashboard)/rules`

Khi user chọn action type `EFFECT`, hiện form:
- Dropdown `kind` (6 lựa chọn, kèm nhãn tiếng Việt: Khói / Pháo hoa / Kim tuyến / Nhấp nháy / Rung / Hype).
- Slider `durationMs` 0.5s–15s.
- Slider `intensity` 0–1.
- Color picker `color`.
- Input `caption` (hiện gợi ý biến `{sender}`, `{gift}`, `{coins}`).

### 6.4 Preset

Bổ sung vào `modules/template` 6 rule mẫu, tắt sẵn (`enabled: false`),
`cooldownMs` mặc định 5000:

| Tên | Điều kiện | Action |
|---|---|---|
| Khói theo lệnh chat | `keywords: ['khói', 'smoke']` | `EFFECT smoke 4000` |
| Pháo hoa khi tặng quà lớn | `minCoinValue: 500` | `EFFECT fireworks 6000` |
| Kim tuyến chào quà | `eventType: [GIFT]` | `EFFECT confetti 3000` |
| Hype | `keywords: ['hype', 'quẩy']` | `EFFECT hype 2500` |
| Rung màn hình | `keywords: ['rung']` | `EFFECT shake 1500` |
| Nhấp nháy | `keywords: ['nhấp nháy']` | `EFFECT strobe 2000, intensity 0.3` |

### 6.5 Trang Overlays

`apps/web/app/(dashboard)/overlays/page.tsx` cần thêm thẻ cho overlay `STAGE`
với URL copy-được: `{WEB_URL}/overlays/stage?token={publicToken}`.

---

## 7. Rủi ro đã biết từ audit

| ID | Rủi ro | Cách xử lý |
|---|---|---|
| R-1 | **XSS qua caption/username** — lỗi thực tế của XiuGou | React text node, không innerHTML. Thêm test khẳng định `<img onerror>` trong `senderDisplayName` render ra literal. |
| R-2 | **Spam effect làm treo OBS** | `cooldownMs` (đã có) + `EFFECT_MAX_CONCURRENT=4` + drop-oldest + particle pool cố định. |
| R-3 | **Lỗi câm** — rule khớp nhưng không có gì hiện | `resolveOverlayFor` trả `null` → log warn với tên rule (mẫu đã có sẵn ở dòng 181). Ngoài ra dashboard nên cảnh báo khi user có rule `EFFECT` mà chưa bật overlay `STAGE`. |
| R-4 | **Payload không giới hạn** | Clamp toàn bộ ở server (§5.1), client clamp lần nữa khi render. Không tin payload từ DB. |
| R-5 | **Rò rỉ rAF khi OBS đổi scene** | Cleanup trong `useEffect`; thêm `visibilitychange` → tạm dừng loop khi tab ẩn. |

---

## 8. An toàn người dùng — hiệu ứng nhấp nháy ⚠️

`STROBE` và `HYPE` có thể gây động kinh nhạy sáng (photosensitive epilepsy).
Đây là ràng buộc **bắt buộc**, không phải tuỳ chọn:

- Tần số nhấp nháy **giới hạn cứng ≤ 3 Hz** ở tầng CSS/JS, bất kể `intensity`.
- Độ tương phản tối đa giữa hai pha ≤ 60% opacity, không bao giờ trắng-đen toàn khung.
- Tôn trọng `@media (prefers-reduced-motion: reduce)`: thay strobe bằng
  một lớp phủ tĩnh mờ dần.
- Form cấu hình hiển thị cảnh báo khi user chọn `strobe` hoặc `hype`.

---

## 9. Phase sau (không thuộc MVP này)

- Định tuyến effect qua local bridge (`ws://127.0.0.1:4000`) để giảm độ trễ;
  `use-local-bridge.ts` đã tồn tại nhưng chưa overlay nào dùng.
- Effect từ asset do user upload (nối với `modules/upload`).
- `LEADERBOARD` overlay (đã có trong enum, chưa có trang) — spec riêng.

---

## 10. Tiêu chí hoàn thành

- [ ] `EffectPayload` + `StageEffectKind` trong `@livenova/shared`, có unit test cho `normaliseEffectPayload` (clamp, `kind` sai, `color` sai định dạng).
- [ ] Migration Prisma thêm `OverlayType.STAGE`.
- [ ] `resolveOverlayFor` có test: user có `STAGE` → dùng `STAGE`; chỉ có `MEDIA` → fallback; không có gì → log warn, không dispatch.
- [ ] `/overlays/stage?token=...` render được cả 6 effect trong OBS, nền trong suốt.
- [ ] Test XSS cho caption và `senderDisplayName`.
- [ ] Strobe đo được ≤ 3 Hz; `prefers-reduced-motion` có nhánh riêng.
- [ ] 6 preset xuất hiện trong Templates, tắt sẵn.
- [ ] Dry-run rule hiện preview effect trong dashboard.
- [ ] **Không có** thay đổi nào trong `apps/desktop-app/`.
