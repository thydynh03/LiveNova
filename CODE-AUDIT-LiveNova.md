# CODE AUDIT — LiveNova
## Rà soát mã nguồn thực tế · commit `166d762`

**Ngày:** 2026-08-06
**Phạm vi:** Toàn bộ mã nguồn được git theo dõi trong `E:\Tiktok`
**Loại trừ:** `node_modules/`, `dist/`, `.next/`, `target/` (build artifacts)
**Phương pháp:** Đọc mã tĩnh. **Không chạy ứng dụng, không thực thi khai thác, không kết nối database.**

---

## 0. Tóm tắt điều hành

### Bức tranh tổng thể

Bạn đã dựng được **bộ khung monorepo đúng hướng** trong 20 commit: pnpm workspace, Next.js 14 (App Router), NestJS 10, Rust Tauri v2, Prisma, Docker Compose, 3 GitHub Actions workflow, ESLint + Prettier, shared package có type dùng chung. Cấu trúc thư mục khớp với §19.3 của bản blueprint.

**Nhưng:** phần lớn logic nghiệp vụ vẫn là **mock/stub**, và trong số đó có **8 lỗi mức Nghiêm trọng** — không phải "chưa làm xong", mà là **code đang chạy được và sai**.

### Điểm số

| Hạng mục | Điểm | Nhận xét |
|---|---|---|
| Cấu trúc dự án | **8.0** | Monorepo sạch, phân tách rõ, khớp blueprint |
| Tooling & CI | **7.5** | Có CI/CodeQL/release, lint sạch, TS strict |
| Mô hình dữ liệu | **6.0** | Schema hợp lý nhưng thiếu 5 bảng và ràng buộc DB |
| **Bảo mật** | **2.0** | **8 lỗi Nghiêm trọng, nhiều lỗi cơ chế bảo vệ "có mà không bật"** |
| **Logic nghiệp vụ** | **3.0** | Credit/TTS/Rule có lỗi tiền bạc và IDOR |
| Realtime | **2.5** | Gateway không xác thực thật, cho phép giả mạo sự kiện |
| Desktop (Rust) | **4.5** | Bind localhost đúng ✅ nhưng không xác thực; key injection không giới hạn |
| Frontend | **5.5** | Overlay chạy được nhưng toàn dữ liệu mô phỏng, chưa nối WS |
| **Kiểm thử** | **0.0** | **0 file test** |
| Độ hoàn thành so với SRS | **~22%** | 19/87 FR có mã, phần lớn ở mức stub |
| **TỔNG** | **4.0 / 10** | **Khung tốt, ruột chưa an toàn** |

### Điều quan trọng nhất cần hiểu

> Vấn đề lớn nhất **không phải** là còn nhiều mock — ở giai đoạn này mock là bình thường và hợp lý.
>
> Vấn đề là có những đoạn **trông như đã bảo vệ nhưng thực chất không bảo vệ gì**: `ValidationPipe` bật mà không có DTO nào, `ThrottlerModule` khai báo mà guard không gắn, `handleAuthenticate` đặt cờ `authenticated = true` mà không kiểm gì, `session_token` sinh ra rồi không bao giờ đối chiếu, `userId` truyền vào service rồi bị bỏ qua.
>
> Loại lỗi này nguy hiểm hơn "chưa làm", vì khi review nhanh sẽ tưởng đã xong.

---

## 1. 🔴 LỖI NGHIÊM TRỌNG (8)

### C-01 — `POST /credits/purchase` phát credit miễn phí không giới hạn

**File:** `apps/server/src/modules/credit/credit.controller.ts:26-30`

```ts
@Post('purchase')
async purchase(@Req() req: AuthenticatedRequest, @Body() body: { amount: number }) {
  // Mock purchase
  return this.creditService.addCredits(req.user.userId, body.amount, LedgerReason.PURCHASE, 'Mock purchase');
}
```

Bất kỳ người dùng đã đăng nhập nào cũng có thể gọi endpoint này với `amount` tùy ý và **được cộng credit ngay lập tức, không qua bất kỳ khâu thanh toán nào**. Không xác minh giao dịch, không idempotency key, không giới hạn trên, không kiểm kiểu dữ liệu.

Bảng `Transaction` đã có sẵn trong schema với `idempotencyKey @unique` — nhưng **hoàn toàn không được dùng**.

**Vi phạm:** FR-060, FR-061, FR-063, FR-064
**Sửa:** Xóa hoặc chặn endpoint này ngay. Chỉ cộng credit từ webhook đã xác minh chữ ký nhà cung cấp thanh toán, và luôn qua bảng `Transaction`.

---

### C-02 — WebSocket: xác thực là giả

**File:** `apps/server/src/modules/websocket/events.gateway.ts:53-61`

```ts
@SubscribeMessage('authenticate')
handleAuthenticate(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() _payload: unknown) {
  // Validate token
  client.authenticated = true;      // ← không kiểm gì cả
  ...
}
```

Comment ghi "Validate token" nhưng **không có dòng kiểm tra nào**. Payload bị bỏ qua (`_payload`). Chỉ cần gửi sự kiện `authenticate` rỗng là được coi là đã xác thực.

Toàn bộ các guard `if (!client.authenticated) return;` ở dưới trở nên vô nghĩa.

**Vi phạm:** SEC-12
**Sửa:** Verify JWT trong payload, gắn `userId` vào socket, và chỉ khi đó mới set cờ.

---

### C-03 — WebSocket: bất kỳ ai cũng bơm được sự kiện live giả vào kênh người khác

**File:** `apps/server/src/modules/websocket/events.gateway.ts:70-74`

```ts
@SubscribeMessage('live_event')
handleLiveEvent(@ConnectedSocket() client, @MessageBody() eventData: { channelId: string }) {
  if (!client.authenticated) return;
  this.server.to(`channel_${eventData.channelId}`).emit('live_event', eventData);
}
```

Kết hợp với C-02: **bất kỳ ai** cũng có thể phát sự kiện tùy ý (ví dụ "vừa có người tặng quà 34.999 coin") vào **bất kỳ kênh nào** chỉ bằng cách đoán `channelId`.

Hậu quả trong sản phẩm thật: kích hoạt TTS đọc bậy, chạy hiệu ứng, cộng điểm PK sai, và — khi FR-055 hoàn thiện — **bơm phím vào game của streamer**.

Client **không bao giờ** được phép là nguồn phát sự kiện live. Chỉ ingest phía server mới được.

**Sửa:** Xóa handler này. Sự kiện chỉ đi một chiều server → client.

---

### C-04 — WebSocket: không phân quyền theo kênh

**File:** `apps/server/src/modules/websocket/events.gateway.ts:63-68`

```ts
handleSubscribe(@ConnectedSocket() client, @MessageBody() channelId: string) {
  if (!client.authenticated) return;
  client.join(`channel_${channelId}`);     // ← không kiểm quyền sở hữu
}
```

Bất kỳ ai cũng join được room của bất kỳ kênh nào → **nghe lén toàn bộ bình luận, quà, người tặng** của streamer khác. Tương tự với `handleOverlayData` (dòng 76-80) qua `publicToken`.

**Vi phạm:** SEC-12
**Sửa:** Đối chiếu `channelId` với các kênh mà `client.userId` thực sự sở hữu.

---

### C-05 — JWT secret có giá trị mặc định hard-code

**File:** `apps/server/src/modules/auth/strategies/jwt.strategy.ts:11`

```ts
secretOrKey: process.env.JWT_SECRET || 'super-secret',
```

Nếu biến môi trường thiếu (deploy sai, container không nạp env, CI), server **vẫn khởi động bình thường** và ký/verify token bằng chuỗi `'super-secret'` mà ai cũng đoán được → giả mạo token cho bất kỳ `userId` nào.

**Sửa:** Không có fallback. Thiếu `JWT_SECRET` thì phải **crash khi khởi động**.

---

### C-06 — Refresh token và access token là một

**File:** `apps/server/src/modules/auth/auth.service.ts:27-42`

```ts
generateTokens(userId: string) {
  const payload = { sub: userId };
  return {
    accessToken: this.jwtService.sign(payload),
    refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),   // cùng secret, cùng payload
  };
}

validateRefreshToken(token: string) {
  const decoded = this.jwtService.verify(token);   // không phân biệt loại token
  return this.generateTokens(decoded.sub);
}
```

Bốn vấn đề chồng lên nhau:

1. **Không phân biệt loại token** — access token dùng làm refresh token được và ngược lại. Access token bị lộ (log, referrer, XSS) trở thành refresh token sống 7 ngày.
2. **Không lưu refresh token** → không thu hồi được. `.env.example` có `JWT_REFRESH_SECRET` nhưng code không dùng.
3. **Không xoay vòng, không phát hiện tái sử dụng** — vi phạm FR-006 mà chính SRS của bạn yêu cầu.
4. **`logout()` không làm gì** (`auth.controller.ts:44-47`, chỉ `return { success: true }`) → đăng xuất là giả.

**Sửa:** Thêm model `Session` lưu hash refresh token; secret riêng; claim `type: 'refresh'`; xoay vòng + phát hiện reuse; `logout` thu hồi thật.

---

### C-07 — IDOR: sửa/xóa được luật của người khác

**File:** `apps/server/src/modules/rule/rule.service.ts:30-53`

```ts
async updateRule(id: string, _userId: string, data: Record<string, unknown>) {
  return this.prisma.rule.update({
    where: { id },                          // ← _userId bị bỏ qua hoàn toàn
    data: data as Prisma.RuleUpdateInput,
  });
}

async deleteRule(id: string, _userId: string) {
  return this.prisma.rule.delete({ where: { id } });   // ← tương tự
}
```

Controller **có** truyền `req.user.userId` xuống (`rule.controller.ts:27,32,37`), nhưng service đặt tên tham số là `_userId` và **không dùng**. Bất kỳ người dùng đã đăng nhập nào biết/đoán được `id` luật đều sửa hoặc xóa được luật của người khác. `testRuleDryRun` cũng vậy.

Đáng chú ý: `overlay.service.ts:32-37` **làm đúng** (`where: { id, userId }`) — Prisma 5.20 hỗ trợ cú pháp này. Vậy đây là lỗi sót, không phải giới hạn kỹ thuật.

**Kèm theo — Mass assignment:** `data as Prisma.RuleUpdateInput` nhận nguyên body chưa lọc. Gửi `PATCH /rules/:id` với `{"userId":"<id-nạn-nhân>"}` là **chuyển luật sang tài khoản khác**.

**Sửa:** `where: { id, userId }` + DTO có allowlist trường.

---

### C-08 — Local Bridge chấp nhận mọi kết nối, không kiểm token

**File:** `apps/desktop-app/src-tauri/src/local_bridge.rs:30, 56-63`

```rust
session_token: Uuid::new_v4().to_string(),   // sinh ra...
...
tracing::info!("Session Token: {}", state.session_token);   // ...ghi log...

while let Ok((stream, _)) = listener.accept().await {
    ...
    if let Ok(mut ws_stream) = accept_async(stream).await {   // ...rồi không bao giờ đối chiếu
```

Bind vào `127.0.0.1` là **đúng** ✅ (đạt một nửa SEC-13). Nhưng:

- `session_token` sinh ra, in ra log, và **không hề được kiểm tra** ở bất kỳ đâu.
- **Không kiểm `Origin`.** WebSocket không bị chặn bởi same-origin policy — nghĩa là **bất kỳ trang web nào streamer mở trong trình duyệt cũng kết nối được tới `ws://127.0.0.1:4000`** và nói chuyện với Local Bridge.

Hiện tại tin nhắn mới chỉ được log nên tác hại còn hạn chế. Nhưng khi Bridge được nối vào `simulate_key_press` / `send_rcon_command` (đúng lộ trình đã định), đây thành đường **thực thi lệnh từ xa qua một trang web bất kỳ**.

**Sửa:** Bắt buộc token trong handshake (query param hoặc first message), kiểm `Origin` theo allowlist, ngắt kết nối nếu không xác thực trong 2 giây.

---

## 2. 🟠 LỖI MỨC CAO (10)

### H-01 — Các cơ chế bảo vệ được cài nhưng không bật

| Cơ chế | Tình trạng | Bằng chứng |
|---|---|---|
| **Rate limiting** | `ThrottlerModule.forRoot()` có, nhưng **`APP_GUARD` với `ThrottlerGuard` không được đăng ký** → hoàn toàn vô tác dụng | `app.module.ts:14-17`, `grep APP_GUARD` → 0 kết quả |
| **Validation** | `ValidationPipe({whitelist, forbidNonWhitelisted})` có, nhưng **không có class DTO nào** → không có metadata để validate, pipe không lọc gì | `main.ts:43-47`; `grep '@Is[A-Z]'` → 0 kết quả |

Mọi controller nhận `Record<string, unknown>` hoặc interface TypeScript. Interface bị xóa lúc compile → runtime không có gì để kiểm.

**Sửa:** Thêm `{ provide: APP_GUARD, useClass: ThrottlerGuard }`; viết DTO class với decorator `class-validator` cho mọi endpoint.

---

### H-02 — Liên kết tài khoản OAuth chỉ theo email → chiếm tài khoản chéo nhà cung cấp

**File:** `apps/server/src/modules/auth/auth.service.ts:14-25`

```ts
async validateOAuthUser(_provider: ProviderType, profile: {...}) {
  let user = await this.userService.findByEmail(profile.email);   // chỉ tra email
  if (!user) { user = await this.userService.create({...}); }
  // Link identity logic here if needed          ← không tạo Identity
  return user;
}
```

`_provider` không được dùng. Bảng `Identity` có `@@unique([provider, providerUserId])` nhưng **không bao giờ được ghi**.

Kịch bản tấn công: nạn nhân đăng ký bằng Google với `nan.nhan@gmail.com`. Kẻ tấn công tạo tài khoản ở nhà cung cấp khác khai email đó (một số nhà cung cấp không xác minh email) → đăng nhập vào **đúng tài khoản nạn nhân**.

**Sửa:** Tra cứu theo `(provider, providerUserId)`. Chỉ gộp theo email khi email đã được xác minh **và** có xác nhận rõ ràng từ người dùng.

---

### H-03 — `simulate_key_press` không có bất kỳ giới hạn an toàn nào

**File:** `apps/desktop-app/src-tauri/src/key_simulator.rs:22`, `main.rs:38-41`

```rust
#[tauri::command]
fn simulate_key_press(key_code: u16, hold_ms: u64) -> Result<(), String> {
    key_simulator::press_key(key_code, hold_ms).map_err(|e| e.to_string())
}
```

- **Không có allowlist phím** — gửi được mọi virtual-key code, kể cả phím hệ thống.
- **Không có cooldown, không giới hạn tần suất** — vi phạm trực tiếp BR-25 và FR-056 trong SRS.
- **`hold_ms` không chặn trên** — `hold_ms: u64::MAX` khiến `thread::sleep` khóa luôn worker thread của Tauri (hàm là `fn` đồng bộ, không phải `async`).

**Sửa:** Allowlist phím theo `GameProfile`; cooldown tối thiểu 3 giây/binding; `hold_ms` kẹp trong khoảng 10–2000 ms; chuyển sang `async` hoặc `spawn_blocking`.

---

### H-04 — Desktop app tắt CSP

**File:** `apps/desktop-app/src-tauri/tauri.conf.json`

```json
"security": { "csp": null }
```

Không có CSP trong WebView. Cộng với H-03: một lỗi XSS trong giao diện desktop → **bơm phím tùy ý vào hệ điều hành người dùng**.

**Sửa:** Đặt CSP chặt (`default-src 'self'`), chỉ mở đúng origin API cần thiết.

---

### H-05 — TTS tính phí cố định 1 credit bất kể độ dài

**File:** `apps/server/src/modules/tts/tts.service.ts:42`

```ts
await this.creditService.deductCredits(userId, 1, LedgerReason.TTS_SYNTHESIS, 'TTS Generation');
```

Không kiểm độ dài `req.text`, không cắt, không tính theo khối ký tự. BR-03 trong SRS quy định **1 credit / 200 ký tự**.

Nhà cung cấp TTS tính tiền **theo ký tự**. Gửi 100.000 ký tự vẫn chỉ mất 1 credit → **đường thổi bay chi phí COGS**, đúng vào rủi ro R-02 đã cảnh báo.

**Sửa:** Chặn độ dài tối đa; tính `Math.ceil(len / 200)` credit; validate ở DTO.

---

### H-06 — Cache TTS dùng chung toàn hệ thống, không gắn người dùng

**File:** `apps/server/src/modules/tts/tts.service.ts:32`, `schema.prisma:168-174`

`TtsCache` chỉ có `cacheKey` (= hash của text+voice) và **không có `userId`**. Hai hệ quả:

1. **Rò rỉ giữa người dùng:** nội dung streamer A tổng hợp, streamer B gõ đúng chuỗi đó sẽ nhận lại **cùng URL audio**. Nếu nội dung riêng tư thì đây là lộ dữ liệu.
2. **Không có `expiresAt`** → không thực hiện được DR-03 (TTL 30 ngày). Cache phình vô hạn.

Ngoài ra hàm dùng **MD5** (`createHash('md5')`, dòng 25) trong khi SRS §B.8.1 quy định `sha256`. MD5 có thể tạo va chạm chủ đích → về lý thuyết cho phép đầu độc cache.

**Sửa:** Đổi sang `sha256`; thêm `expiresAt`; cân nhắc gắn scope theo user hoặc chỉ cache các chuỗi mẫu chung (tên quà, lời cảm ơn) chứ không cache nội dung bình luận tự do.

---

### H-07 — Không có bảng `Session`, `Channel`, `Plan`, `TtsSettings`, `GameProfile`

**File:** `apps/server/prisma/schema.prisma`

| Thiếu | Chặn requirement nào |
|---|---|
| `Session` / `RefreshToken` | FR-006, FR-007, FR-008 (thu hồi phiên) |
| **`Channel`** | **FR-011, FR-012 (liên kết + xác minh sở hữu kênh)** |
| `Plan` | BR-17, FR-059 (gói & giới hạn) |
| `TtsSettings` | FR-019, FR-020 |
| `GameProfile` / `GameBinding` | FR-054, FR-055, FR-056 |

Nghiêm trọng nhất là **`Channel`**: `LiveSession.channelId` là chuỗi tự do không ràng buộc, và `TiktokController` nhận `channelId` từ URL rồi kết nối thẳng (`tiktok.controller.ts:25-27`) — TODO ở dòng 21 đã tự thừa nhận: *"Tie to the authenticated user's linked channel"*. Đây chính là gốc của C-04.

---

### H-08 — Không có ràng buộc `CHECK (balance >= 0)` ở tầng database

**File:** `apps/server/prisma/schema.prisma:83-90`

Chỉ chặn ở tầng ứng dụng (`credit.service.ts:23`). SRS §18.2 và BR-08 yêu cầu ràng buộc DB — để **bug ứng dụng không thể tạo ra số dư âm**.

Prisma không khai báo `CHECK` trực tiếp; cần migration SQL thủ công:
```sql
ALTER TABLE "CreditBalance" ADD CONSTRAINT balance_non_negative CHECK (balance >= 0);
```

---

### H-09 — Không có một dòng test nào

`find` cho `*.spec.ts`, `*.test.ts`, `#[test]` → **0 kết quả**.

NFR-23 yêu cầu **100% độ phủ trên luồng credit/thanh toán**. Đây đúng là phần đang có nhiều lỗi nhất (C-01, H-05, M-01). Kịch bản Gherkin ở §B.17 của SRS — gồm cả bài test 1000 request đồng thời không được làm âm số dư — chưa được hiện thực.

CI chạy build + lint nhưng **không chạy test** vì không có test.

---

### H-10 — `TiktokModule` không được nạp vào ứng dụng

**File:** `apps/server/src/app.module.ts:12-25`

`imports` gồm: Throttler, Prisma, Auth, User, Credit, Tts, Rule, Overlay. **Thiếu `TiktokModule`.**

Toàn bộ `tiktok.service.ts` (178 dòng — file logic dài nhất của server) và `tiktok.controller.ts` là **code chết**, không route nào được đăng ký. Đây là lý do lỗi này lọt qua CI: build và lint vẫn xanh.

**Sửa:** Thêm `TiktokModule` vào `imports`. Cũng nên chuyển `EventEmitterModule` thành `EventEmitterModule.forRoot()` ở AppModule (hiện `tiktok.module.ts:7` import không có `.forRoot()` — sẽ lỗi khi inject `EventEmitter2`).

---

## 3. 🟡 LỖI MỨC TRUNG BÌNH (13)

| ID | Vấn đề | File |
|---|---|---|
| M-01 | `deductCredits` ném `ConflictException` khi optimistic lock trượt, **không retry**. Lúc live cao điểm nhiều request TTS đồng thời → người dùng nhận lỗi 409 dù còn credit | `credit.service.ts:35-37` |
| M-02 | Race cache TTS: hai request giống hệt cùng miss → cả hai trừ credit; một cái `create` lỗi unique rồi mới hoàn. Lãng phí và ghi 2 dòng ledger thừa | `tts.service.ts:28-59` |
| M-03 | `addCredits`: `findUnique() \|\| create()` rồi `update()` — nếu vừa `create` thì `balanceAfter` tính từ `current.balance = 0`, đúng; nhưng hai truy vấn tách rời trong transaction vẫn có thể đua với transaction khác. Nên dùng `upsert` | `credit.service.ts:56-79` |
| M-04 | `grantDailyQuota` hard-code **50** credit, trong khi BR-01/SRS ghi 100 và phải cấu hình được. Không có cron/scheduler gọi hàm này | `credit.service.ts:82-84` |
| M-05 | Kiểm tra Origin của socket dùng `origin?.includes('trusted-domain.com')` — **so khớp chuỗi con**, nên `trusted-domain.com.evil.net` vẫn lọt. Và tên miền là placeholder | `events.gateway.ts:35` |
| M-06 | CORS fallback `origin: '*'` kèm `credentials: true` — tổ hợp không hợp lệ, trình duyệt sẽ chặn; nếu quên set `FRONTEND_URL` thì production hỏng | `main.ts:36-40` |
| M-07 | Không có endpoint công khai đọc overlay theo token. `overlayService.getByToken()` được viết nhưng **không controller nào gọi** → OBS Browser Source không lấy được config. FR-046/FR-047 chưa nối | `overlay.controller.ts` |
| M-08 | `Overlay.publicToken` dùng `uuid()` = 122 bit; SRS §B.8.1 yêu cầu ≥256 bit ngẫu nhiên | `schema.prisma:134` |
| M-09 | `RuleEvaluator.lastTriggerMap` là `Map` trong bộ nhớ, **không bao giờ dọn** → rò rỉ bộ nhớ; và cooldown sai khi chạy nhiều instance server | `rule-evaluator.ts:10` |
| M-10 | `obs_controller::connect()` và `rcon_client::execute()` luôn trả về thành công giả → giao diện sẽ báo "đã kết nối OBS" khi thực tế chưa kết nối gì | `obs_controller.rs:21`, `rcon_client.rs:25` |
| M-11 | `send_rcon_command` cho phép frontend chỉ định `host`/`port` tùy ý → SSRF từ WebView tới mạng nội bộ | `main.rs:26-36` |
| M-12 | Tauri chưa cấu hình `updater` và chưa có ký số → FR-069, SEC-14, SEC-15 chưa có gì. Target `nsis` không ký | `tauri.conf.json` |
| M-13 | `User.locale` mặc định `"en"`, `timezone` mặc định `"UTC"` — SRS L10N-07 và B.8.1 quy định `vi` / `Asia/Ho_Chi_Minh` cho sản phẩm ưu tiên thị trường VN. Ảnh hưởng trực tiếp BR-06 (giờ reset quota) | `schema.prisma:55-56` |

---

## 4. 🟢 LỖI NHẸ / GHI CHÚ (9)

| ID | Ghi chú |
|---|---|
| L-01 | `X-Frame-Options` được đặt 2 lần (helmet + middleware thủ công) — thừa, không hại |
| L-02 | CSP trong `main.ts` cấu hình cho API server nên `styleSrc`/`imgSrc` gần như vô nghĩa; nhưng vô hại |
| L-03 | Overlay dùng ảnh ngoài hard-code (`unsplash.com`, `dicebear.com`) — cần bỏ trước khi lên production, và sẽ vi phạm CSP khi siết |
| L-04 | Các trang overlay còn `setInterval` giả lập dữ liệu, chưa nối WebSocket thật |
| L-05 | `next.config.mjs` chưa có `headers()` bảo mật, chưa cấu hình `images.remotePatterns` |
| L-06 | Tên sản phẩm không nhất quán: README "LiveNova" vs `tauri.conf.json` `"tiktok-live-desktop"` / `com.tiktoklive.desktop`. Ngoài ra **dùng "TikTok" trong tên/identifier sản phẩm có rủi ro nhãn hiệu** |
| L-07 | Package scope `@livenova/shared` — cùng vấn đề nhãn hiệu như L-06 |
| L-08 | `local_bridge.rs`: port 4000 hard-code, không có fallback khi cổng bận; lỗi chỉ ghi log, người dùng không thấy |
| L-09 | `local_bridge.rs`: `connected_clients` tăng **trước** khi handshake thành công; nếu task panic thì số đếm rò rỉ |

---

## 5. ✅ Những điểm làm ĐÚNG

Cần ghi nhận — đây không phải danh sách ngắn:

1. ✅ **`.env` được gitignore đúng** và **không nằm trong lịch sử git**. Đã kiểm `git ls-files` và `git log -- .env` → sạch. Đây là thứ nhiều dự án làm sai ngay từ commit đầu.
2. ✅ **Local Bridge bind `127.0.0.1`**, không phải `0.0.0.0` — đúng SEC-13, đúng khuyến nghị từ Phụ lục A.
3. ✅ **Kiến trúc Local Bridge được giữ lại** đúng như phân tích `Fleck` ở Phụ lục A — quyết định kiến trúc quan trọng nhất và bạn đã làm đúng.
4. ✅ **Argon2id cho mật khẩu** (`auth.service.ts:44-49`) — đúng SEC-09.
5. ✅ **Helmet + security headers** có ngay từ đầu, có comment tham chiếu `Audit §13.1`.
6. ✅ **`/auth/redirect` có validate** chặn URL tuyệt đối và `//` — đúng tinh thần FR-005, đóng lỗ hổng §13.3 của sản phẩm gốc. *(Xem R-01 dưới đây để siết thêm.)*
7. ✅ **Optimistic locking có `version`** trên `CreditBalance` — đúng hướng, chỉ thiếu retry.
8. ✅ **Ledger append-only** với `balanceAfter` — đúng thiết kế §18.2.
9. ✅ **`Transaction.idempotencyKey @unique`** đã có trong schema.
10. ✅ **Cache TTS có `hitCount`/`lastHitAt`** — đo được tỷ lệ hit, phục vụ NFR-26.
11. ✅ **`overlay.service.rotateToken` dùng `where: {id, userId}`** — phân quyền đúng.
12. ✅ **`tiktok.service.ts` viết rất tốt**: tách abstraction layer sạch, ghi rõ Q-01 chưa giải quyết, liệt kê 3 phương án, cảnh báo log khi chạy mock. **Đây là cách xử lý một câu hỏi chặn đúng chuẩn** — không giả vờ đã xong.
13. ✅ **CI có 3 workflow** gồm CodeQL, cancel-in-progress, `--frozen-lockfile`.
14. ✅ **ESLint sạch 100%**, TypeScript strict — có 2 commit dành riêng cho việc này.
15. ✅ **Shared package** cho type dùng chung giữa web/server/desktop — đúng §19.3.
16. ✅ **`RuleEvaluator` logic đúng**: sort theo priority, `continueMatching`, cooldown — khớp BR-18/BR-19.

---

## 6. Đối chiếu với SRS (Phụ lục B)

| Epic | FR có mã | Tình trạng |
|---|---|---|
| E1 Tài khoản & Xác thực | 4/10 | ⚠️ Có nhưng **không an toàn** (C-05, C-06, H-02) |
| E2 Kết nối kênh | 0/5 | ❌ Không có model `Channel` (H-07) |
| E3 TTS | 3/13 | ⚠️ Mock provider, sai công thức tính phí (H-05) |
| E4 Luật & Hiệu ứng | 3/10 | ⚠️ CRUD có nhưng **IDOR** (C-07) |
| E5 Overlay | 4/11 | ⚠️ Giao diện có, chưa nối dữ liệu thật (M-07) |
| E6 OBS & Game | 2/8 | ⚠️ Toàn stub; thiếu giới hạn an toàn (H-03) |
| E7 Thanh toán | 2/9 | 🔴 **Endpoint phát credit miễn phí** (C-01) |
| E8 Desktop | 3/8 | ⚠️ Bridge chưa xác thực (C-08) |
| E9 Phân tích & Admin | 0/8 | ❌ Chưa bắt đầu |
| E10 Trang công khai | 1/5 | ⚠️ Landing tối giản, chưa có metadata SEO |
| **TỔNG** | **~19/87** | **≈ 22%** |

**Non-functional:** chưa có hạng mục NFR nào được đo. Không có test tải, không có đo độ trễ, không có OpenTelemetry, không có giới hạn tài nguyên desktop (NFR-08→13).

---

## 7. Thứ tự sửa đề xuất

### Đợt 1 — Chặn ngay (nửa ngày)

Những thứ này đang **chạy được và sai**. Ưu tiên tuyệt đối.

| # | Việc | File | Ước tính |
|---|---|---|---|
| 1 | Xóa/khóa `POST /credits/purchase` | `credit.controller.ts` | 5 phút |
| 2 | Xóa `@SubscribeMessage('live_event')` | `events.gateway.ts` | 5 phút |
| 3 | Bỏ fallback `'super-secret'`, crash nếu thiếu env | `jwt.strategy.ts` | 10 phút |
| 4 | `where: { id, userId }` trong `updateRule`/`deleteRule`/`testRuleDryRun` | `rule.service.ts` | 15 phút |
| 5 | Verify JWT thật trong `handleAuthenticate` | `events.gateway.ts` | 1 giờ |
| 6 | Kiểm `session_token` + `Origin` trong Local Bridge | `local_bridge.rs` | 2 giờ |
| 7 | Đăng ký `APP_GUARD` + `ThrottlerGuard` | `app.module.ts` | 10 phút |
| 8 | Thêm `TiktokModule` vào AppModule + `EventEmitterModule.forRoot()` | `app.module.ts` | 10 phút |

### Đợt 2 — Tuần này

9. Viết DTO class + `class-validator` cho **mọi** endpoint (kèm giới hạn độ dài text TTS)
10. Model `Session` + refresh token xoay vòng + `logout` thật
11. Model `Channel` + xác minh sở hữu + phân quyền socket theo kênh
12. Tính credit TTS theo độ dài (BR-03)
13. Giới hạn an toàn cho `simulate_key_press` (allowlist + cooldown + kẹp `hold_ms`)
14. Bật CSP trong `tauri.conf.json`
15. Migration `CHECK (balance >= 0)`
16. Sửa `validateOAuthUser` tra theo `(provider, providerUserId)`

### Đợt 3 — Trước khi có người dùng thật

17. Bộ test cho credit/TTS/auth — bắt đầu từ kịch bản Gherkin §B.17
18. Retry khi optimistic lock trượt
19. Endpoint công khai cho overlay theo token
20. Chuyển cache key sang sha256 + thêm `expiresAt`
21. Cấu hình updater + ký số cho Tauri
22. Thống nhất tên sản phẩm, rà soát rủi ro nhãn hiệu "TikTok"

---

## 8. Ghi chú siết thêm: `/auth/redirect` (R-01)

`auth.controller.ts:49-56` đã chặn `//` và bắt buộc bắt đầu bằng `/` — **tốt hơn hẳn sản phẩm gốc**. Hai điểm nên siết thêm:

```ts
if (!path || !path.startsWith('/') || path.startsWith('//')) { ... }
```

1. **`/\evil.com`** — một số trình duyệt chuẩn hóa `\` thành `/`, biến nó thành `//evil.com`. Nên chặn cả `\`.
2. Tốt nhất là **allowlist đường dẫn hợp lệ** thay vì lọc theo mẫu, đúng như FR-005 mô tả.

```ts
const ALLOWED = new Set(['/dashboard', '/rules', '/tts', '/billing', '/overlays']);
if (!path || !ALLOWED.has(path)) throw new BadRequestException('Invalid redirect path');
```

---

## 9. Kết luận

**Điều bạn làm tốt:** khung dự án, tooling, CI, phân tách module, giữ đúng quyết định kiến trúc Local Bridge, và cách xử lý câu hỏi chặn Q-01 trong `tiktok.service.ts` — ghi rõ chưa giải quyết thay vì giả vờ đã xong. Đó là kỹ thuật tốt.

**Điều cần sửa gấp:** 8 lỗi Nghiêm trọng ở §1. Chúng không phải "chưa làm xong" — chúng là code đang hoạt động với hành vi sai. Đặc biệt nguy hiểm là nhóm **"bảo vệ giả"**: ValidationPipe không có DTO, Throttler không gắn guard, `authenticated = true` không kiểm gì, `session_token` không đối chiếu, `userId` bị bỏ qua. Nhìn qua tưởng đã an toàn.

**Đợt 1 mất khoảng nửa ngày** và loại bỏ được toàn bộ nhóm lỗi nguy hiểm nhất.

**Nhắc lại điều quan trọng nhất từ SRS §B.13:** trước khi đầu tư thêm nhiều giờ vào ingest, hãy trả lời **Q-01** bằng văn bản. `tiktok.service.ts` hiện đang chờ đúng câu trả lời đó — và bạn đã đánh dấu nó rất rõ trong code, điều này là đúng.

---

*Báo cáo dựa trên đọc mã tĩnh tại commit `166d762`. Không chạy ứng dụng, không kết nối database, không thực thi khai thác. Mọi tham chiếu đều kèm file và số dòng để kiểm chứng lại.*

---
---

# PHỤ LỤC — TRẠNG THÁI KHẮC PHỤC (2026-08-06)

Toàn bộ Đợt 1, 2, 3 ở §7 đã được thực hiện. Xác minh bằng `pnpm lint`, `tsc --noEmit`,
`jest`, `next build` — tất cả xanh. **Chưa biên dịch được Rust** (xem phần cuối).

## Đợt 1 — Chặn ngay

| # | Lỗi | Trạng thái | Cách sửa |
|---|---|---|---|
| C-01 | `POST /credits/purchase` phát credit miễn phí | ✅ | Xóa endpoint. Credit chỉ có thể sinh qua `creditFromSettledTransaction()` — bắt buộc có `Transaction` đã settle + `refId` chống ghi trùng |
| C-02 | WebSocket auth giả | ✅ | `handleAuthenticate` verify JWT thật, kiểm `type === 'access'`, sai thì ngắt kết nối |
| C-03 | Bơm sự kiện live giả | ✅ | Xóa hẳn `live_event` và `overlay_data` khỏi client. Sự kiện chỉ đi server → client qua `@OnEvent('live.any')` |
| C-04 | Không phân quyền kênh | ✅ | `subscribe_channel` gọi `ChannelService.isOwnedBy()` trước khi join room |
| C-05 | JWT secret mặc định | ✅ | `loadEnv()` — không fallback, bắt buộc ≥32 ký tự, hai secret phải khác nhau, thiếu thì crash lúc boot |
| C-06 | Refresh = access token | ✅ | `SessionService`: refresh là chuỗi ngẫu nhiên 256-bit (không phải JWT), lưu HMAC-SHA256, xoay vòng theo `familyId`, phát hiện tái sử dụng thì thu hồi cả họ. `logout` thu hồi thật |
| C-07 | IDOR + mass assignment trên rule | ✅ | `where: { id, userId }` trong update/delete/test; DTO làm allowlist trường |
| C-08 | Local Bridge không xác thực | ✅ | `accept_hdr_async` kiểm token (so sánh constant-time) + allowlist `Origin` + chỉ nhận peer loopback |
| H-01a | Throttler không gắn guard | ✅ | Đăng ký `APP_GUARD` + `ThrottlerGuard` |
| H-10 | `TiktokModule` không nạp | ✅ | Thêm vào `AppModule`; `EventEmitterModule.forRoot()` đăng ký ở cấp app |

## Đợt 2

| # | Lỗi | Trạng thái | Cách sửa |
|---|---|---|---|
| H-01b | ValidationPipe không có DTO | ✅ | DTO class có decorator cho **mọi** endpoint: auth, user, channel, credit, tts, rule, overlay |
| H-02 | OAuth gộp theo email | ✅ | Tra theo `(provider, providerUserId)`; chỉ gộp theo email khi provider xác nhận đã verify; ghi bảng `Identity` |
| H-03 | `simulate_key_press` không giới hạn | ✅ | Allowlist phím (chữ/số/F1-F12/mũi tên/space/enter), cooldown ≥1s/phím, trần 60 lần/phút, `hold_ms` kẹp 10–2000ms, chuyển `async` + `spawn_blocking` |
| H-04 | Tauri `csp: null` | ✅ | CSP đầy đủ, chỉ mở `ws://127.0.0.1:4000` và API origin |
| H-05 | TTS tính phí cố định | ✅ | `ceil(len / TTS_CHARS_PER_CREDIT)`, chặn `TTS_MAX_CHARS`, đếm theo code point (emoji không bị tính gấp đôi) |
| H-06 | Cache TTS md5 + không TTL | ✅ | sha256 + `expiresAt` + hit gia hạn TTL + `pruneExpiredCache()` |
| H-07 | Thiếu 5 bảng | ✅ | Thêm `Session`, `Channel`, `TtsSettings`, `GameProfile`, `GameBinding` |
| H-08 | Không có CHECK ở DB | ✅ | `prisma/sql/001_constraints.sql` — 8 ràng buộc gồm `balance >= 0`. Chạy: `pnpm --filter @livenova/server prisma:constraints` |

## Đợt 3

| # | Lỗi | Trạng thái | Cách sửa |
|---|---|---|---|
| H-09 | 0 test | ✅ | **64 test** (48 server + 16 shared). Jest + ts-jest, CI chạy và chặn merge |
| M-01 | Không retry optimistic lock | ✅ | Retry tối đa 5 lần có jitter; hết credit trả 402 (`PaymentRequiredException`) chứ không phải 400 |
| M-02 | Race cache TTS | ✅ | Kiểm cache lần hai sau khi trừ; nếu bị race thì hoàn credit |
| M-03 | Race trong `addCredits` | ✅ | `upsert` thay cho `findUnique() \|\| create()` |
| M-04 | Quota hard-code 50 | ✅ | `DAILY_FREE_CREDITS` (mặc định 100 theo BR-01), idempotent theo `resetsAt` |
| M-05 | Origin check bằng `includes()` | ✅ | So khớp chính xác với danh sách từ `CORS_ORIGIN` |
| M-06 | CORS `'*'` + credentials | ✅ | Chỉ origin tường minh; production không có danh sách thì từ chối khởi động |
| M-07 | Không có endpoint overlay công khai | ✅ | `GET /public/overlays/:token` — không qua JwtAuthGuard, chỉ trả config render |
| M-08 | Token overlay 122-bit | ✅ | `randomBytes(32)` = 256-bit |
| M-10 | OBS/RCON trả thành công giả | ✅ | Trả lỗi tường minh thay vì `Ok(true)` |
| M-11 | SSRF qua RCON host | ✅ | Chỉ cho loopback và dải IP private; từ chối hostname |
| M-13 | Mặc định `en`/`UTC` | ✅ | `vi` / `Asia/Ho_Chi_Minh` |

## Sửa thêm ngoài danh sách

- **Web build đang hỏng sẵn từ trước:** `justify:` không phải thuộc tính CSS hợp lệ (4 chỗ trong `billing`, `tts`, `overlays`). `next build` fail. Đã đổi thành `justifyContent:`. Layout flex giờ mới thật sự hoạt động.
- `softDelete` ghi `deletedAt` = **hiện tại** thay vì +30 ngày. Giá trị cũ khiến mọi kiểm tra `deletedAt != null` coi tài khoản đã xóa ngay lập tức, đồng thời làm mốc thời gian vô dụng cho việc lên lịch purge. Thêm `findPurgeable()`.
- `GET /users/me` trả nguyên bản ghi gồm `passwordHash`. Đã loại bỏ.
- `testRuleDryRun` luôn trả `{ match: true }`. Giờ chạy `RuleEvaluator` thật với evaluator mới mỗi lần để cooldown không rò giữa các lần test.
- OAuth callback trả `{ message: 'Facebook callback' }` dạng thành công. Giờ trả 404 tường minh.
- `getSessions` của TikTok trả session của **mọi** người dùng. Giờ lọc theo kênh sở hữu.
- Phân trang ledger bị kẹp (`take` ≤ 200) — trước đó `?take=999999` đọc được cả bảng.
- Thêm `*.tsbuildinfo`, `next-env.d.ts`, `coverage/` vào `.gitignore`.

## Kết quả xác minh

```
lint (workspace)      OK
shared build          OK
shared test           16 passed
prisma generate       OK
server typecheck      OK
server test           48 passed
server build          OK
web typecheck         OK
web build             OK (13 routes)
```

## ⚠️ CHƯA XÁC MINH ĐƯỢC

**Mã Rust chưa được biên dịch.** Máy này không có `cargo`. Bốn file Rust
(`local_bridge.rs`, `key_simulator.rs`, `main.rs`, `obs_controller.rs`,
`rcon_client.rs`) đã được viết lại và rà bằng mắt, nhưng **chưa qua
`cargo check`, `cargo clippy` hay `cargo test`**. CI có sẵn 3 job Rust sẽ chạy
khi push. Cần chạy trước khi tin tưởng:

```bash
cd apps/desktop-app/src-tauri && cargo fmt && cargo clippy -- -D warnings && cargo test
```

Có 9 unit test Rust mới đã viết (allowlist phím, kẹp thời gian giữ, cooldown,
rate limit, so khớp token, tách query param, chặn host RCON) nhưng **chưa từng
chạy**.

## Còn lại (cần bạn quyết định)

| Việc | Vì sao chưa làm |
|---|---|
| Ký số installer + cấu hình updater Tauri | Cần chứng chỉ ký số và cặp khóa updater của bạn |
| Đổi scope `@livenova/*` → `@livenova/*` | Chạm mọi import + lockfile; và là quyết định thương hiệu (rủi ro nhãn hiệu "TikTok" đã nêu ở L-06/L-07) |
| Nối overlay frontend vào WebSocket thật | Các trang overlay vẫn dùng `setInterval` giả lập; backend đã sẵn sàng |
| BillingModule + webhook VNPay/MoMo | Chặn bởi **Q-02** (pháp nhân Việt Nam) |
| Ingest TikTok thật | Chặn bởi **Q-01** — vẫn là câu hỏi quan trọng nhất |
| Xác minh sở hữu kênh | Chặn bởi **Q-12**; hiện `verify()` từ chối thay vì cấp quyền khi chưa xác minh |
