# Đưa Kingdom War lên production cho nhiều streamer dùng

Tài liệu này không phải checklist chung chung. Mọi mục đều chỉ tới mã cụ thể
trong repo và nêu điều gì sẽ hỏng nếu bỏ qua.

Bối cảnh: hôm nay hệ thống chạy tốt cho **một tiến trình, một streamer tại một
thời điểm**. Ba thứ chặn nó phục vụ nhiều người, và cả ba đều nằm ở tầng trạng
thái chứ không phải ở tầng giao diện.

---

## Trạng thái

| # | Hạng mục | Trạng thái |
|---|---|---|
| 1 | Trạng thái trận trong RAM tiến trình | ✅ Đã chặn phân kỳ bằng quyền sở hữu (xem bên dưới) |
| 2 | Socket.IO không có Redis adapter | ✅ Đã làm |
| 3 | Không có migration có phiên bản | ✅ Đã làm |
| 4 | Hạn mức theo từng streamer | ✅ Đã làm |
| 5 | Quan sát được trận đấu | ✅ Đã làm |
| 6 | Ngưỡng tài nguyên overlay | ✅ Đã làm |
| 7 | Sinh lại 3 sprite sheet | ✅ Đã làm (nắn lại từ chính ảnh AI) |
| 8 | Đo 3D | ✅ Đã đo (chi phí, không phải FPS — lý do bên dưới) |

---

## P0 — Chặn cứng, phải xong trước khi mở cho người ngoài

### 1. Trạng thái trận nằm trong RAM của tiến trình

`apps/server/src/modules/battle/battle.service.ts:126`

```ts
private readonly battles = new Map<string, ActiveBattle>();
```

Kèm hai bộ đếm chạy trong chính tiến trình đó:

- `:177` `setInterval(() => this.tickEnergyRefill(), 1000)`
- `:182` `setInterval(() => void this.flush(), 2000)`

**Hỏng thế nào khi chạy 2 instance:** mỗi instance giữ một bản `battles` riêng.
Quà rơi vào instance A không tồn tại với instance B. Cả hai cùng hồi năng lượng
mỗi giây cho cùng một trận → tốc độ hồi gấp đôi. Cả hai cùng `flush()` ghi đè
điểm của nhau mỗi 2 giây, và cả hai đều có thể gọi `finishBattle()` → hai bản ghi
FINISHED, hai lần công bố nhà vô địch, có thể khác nhau.

**Hướng xử lý:**

- Trạng thái trận chuyển sang Redis (hash theo `battleId`), coi Postgres là nơi
  lưu bền chứ không phải nơi đọc nóng.
- Bộ đếm giờ tách khỏi API process: một worker duy nhất giữ khoá phân tán
  (`SET battle:tick:lock NX PX`) mới được tick. API process chỉ nhận sự kiện.
- `finishBattle` phải idempotent — bọc bằng update có điều kiện
  `WHERE status = 'RUNNING'` để lần gọi thứ hai không ghi gì.

**Đã làm — theo hướng khác với dự kiến ban đầu, và đây là lý do:**

Kế hoạch cũ là chuyển toàn bộ trạng thái sang Redis. Làm vậy đồng nghĩa viết lại
mọi đường ghi trong một service 900 dòng đang chạy đúng — rủi ro cao mà không
giải quyết được vấn đề gốc, vì hai tiến trình cùng đọc-sửa-ghi một key Redis vẫn
giẫm lên nhau nếu không có khoá.

Thay vào đó: **mỗi trận có đúng một chủ sở hữu tại một thời điểm**, giữ bằng lease
Redis (`battle:owner:<userId>`, TTL 15s, gia hạn mỗi 5s).

- `BattleCoordinatorService` cấp và gia hạn lease.
- `tickEnergyRefill` và `flush` bỏ qua trận không thuộc sở hữu — hết hồi năng
  lượng gấp đôi, hết ghi đè điểm.
- Instance không sở hữu **không tự xử lý**: nó chuyển lệnh cho chủ sở hữu qua
  Redis pub/sub và trả về kết quả của chủ sở hữu.
- Khi chuyển lệnh thất bại, API trả 503 chứ **không** tự chạy cục bộ. Chạy cục bộ
  chính là con bug cần tránh: từ giây đó hai bản sao phân kỳ trong im lặng. Lease
  hết hạn trong ≤15s nên lần thử sau sẽ thành công.
- Lúc tắt, instance trả lease ngay thay vì để trận đứng yên hết TTL — một lần
  deploy cuốn chiếu nếu không sẽ đóng băng mọi trận đang chạy 15 giây.
- `finishBattle` dùng `updateMany ... WHERE status = 'RUNNING'`. Cờ `active`
  trong bộ nhớ không đảm bảo được tính idempotent vì nó là trạng thái của riêng
  từng tiến trình.

Còn lại chưa làm: trạng thái vẫn nằm trong RAM của **chủ sở hữu**. Chủ sở hữu
chết thì mất tối đa 2 giây điểm (khoảng cách giữa hai lần flush) và instance kế
tiếp khôi phục từ Postgres. Đó là đánh đổi có chủ ý, không phải thiếu sót.

### 2. Socket.IO không có Redis adapter

`apps/server/src/modules/websocket/overlay.gateway.ts`,
`events.gateway.ts` — không có `createAdapter`, không có `ioredis` ở bất kỳ đâu
trong `apps/server/src` (Redis đã khai báo trong `docker-compose.yml` nhưng mã
chưa hề dùng).

**Hỏng thế nào:** overlay OBS của streamer nối vào instance B, còn webhook quà
TikTok rơi vào instance A. `broadcastState` chỉ phát trong bộ nhớ instance A →
overlay **đứng hình vĩnh viễn** dù dữ liệu vẫn chạy. Đây là lỗi khó chẩn đoán
nhất trong nhóm này vì không có lỗi nào được ném ra.

**Hướng xử lý:** `@socket.io/redis-adapter` + `ioredis`, gắn trong `main.ts`.
Kèm sticky session ở tầng load balancer cho giai đoạn HTTP long-polling.

**Đã làm.** `RedisIoAdapter` trong `main.ts`, gắn trước khi gateway khởi tạo.
Không có Redis thì lùi về adapter bộ nhớ và **ghi log đúng trạng thái thật** —
log ban đầu tôi viết báo "đã cấu hình" dựa trên biến môi trường, tức là sẽ nói
dối đúng lúc đang có sự cố: `REDIS_URL` có đặt nhưng không kết nối được vẫn hiện
"đã cấu hình" trong khi overlay đứng hình.

### 3. Không có migration có phiên bản

`apps/server/prisma/` chỉ có `schema.prisma`, `seed.ts`, `sql/` — **không có thư
mục `migrations/`**. `package.json:15` cho thấy quy trình đang dùng:

```
"prisma:push": "prisma db push --accept-data-loss"
```

**Hỏng thế nào:** `--accept-data-loss` trên production sẽ lặng lẽ drop cột khi
schema đổi. Không có lịch sử migration thì cũng không có đường rollback, và hai
môi trường không thể chứng minh là giống nhau.

**Hướng xử lý:** sinh baseline migration từ schema hiện tại
(`prisma migrate diff --from-empty`), commit vào repo, chuyển deploy sang
`prisma migrate deploy`. Cấm `db push` ngoài máy dev.

**Đã làm.** Baseline `00000000000000_init` sinh từ schema hiện tại, thêm
`prisma:deploy` và `prisma:baseline`, gỡ `--accept-data-loss` khỏi `prisma:push`.
Hướng dẫn baseline cho database đang chạy nằm ở `prisma/migrations/README.md`.

---

## P1 — Cần trước khi tăng lưu lượng

### 4. Giới hạn tài nguyên theo từng streamer

`ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])`
(`app.module.ts:22`) là giới hạn **toàn cục theo IP**. Một phòng live viral sẽ
tự đẩy mình vào giới hạn đó và làm hỏng trận của chính họ, trong khi một tài
khoản lạm dụng vẫn có thể mở nhiều kênh mà không bị chặn.

**Đã làm.** `UserThrottlerGuard` khoá theo `userId` khi có phiên đăng nhập, lùi
về IP cho lưu lượng ẩn danh (đăng nhập, đăng ký — đúng chỗ cần chặn người chưa
có tài khoản). Đằng sau proxy thì đọc `x-forwarded-for`, nếu không mọi request
ẩn danh sẽ bị gộp chung vào địa chỉ của load balancer.

Hai tầng thay vì một: `short` 20 lần/giây chặn cơn bùng phát, `long` 300
lần/phút là trần bền vững. Một ngưỡng không làm được cả hai — đặt thấp đủ để bắt
bùng phát thì dùng dashboard bình thường cũng dính, đặt cao đủ để dùng bình
thường thì một vòng lặp hỏng chạy tự do cả phút.

Lưu lượng overlay được miễn: nguồn OBS tự kết nối lại theo nhịp riêng và xác
thực bằng token chứ không phải phiên, chặn nó là cắt sóng.

### 5. Chưa có quan sát được trận đấu

Hiện chỉ có log của Nest. Không có metric nào cho: số trận đang chạy, độ trễ từ
lúc nhận quà tới lúc overlay đổi, tỉ lệ `flush()` lỗi, số socket đang mở.

Khi một streamer báo "overlay đứng", hôm nay không có cách nào trả lời ngoài đọc
log thủ công.

**Đã làm.** `GET /metrics` ở định dạng Prometheus, đúng bốn chỉ số đó:

- `livenova_battles_active` — trận instance này **đang sở hữu** (không đếm trận
  đã chuyển lease đi, nếu không cả cụm sẽ đếm trùng)
- `livenova_gift_to_broadcast_ms` — histogram từ lúc nhận quà tới lúc đẩy state
- `livenova_battle_flush_total` / `_failures_total`
- `livenova_overlay_sockets`

Chúng tách được ba kiểu hỏng khác nhau: overlay đứng mà số socket bằng 0 là một
lỗi khác hẳn overlay đứng khi có socket nhưng không có mẫu độ trễ.

Không dùng `prom-client`: bốn chuỗi số không đáng thêm một phụ thuộc, và định
dạng phơi bày chỉ là chục dòng ghép chuỗi. Endpoint không cần xác thực và
**phải giữ nguyên như vậy** — trong đó không có tên người dùng, tên kênh hay nội
dung quà. Thêm bất cứ thứ gì định danh vào đây là biến nó thành chỗ rò rỉ.

### 6. Chi phí tài nguyên của overlay chưa có ngưỡng

`maxTroops = 220` là con số chọn tay, chưa từng đo.

**Đo rồi thì phát hiện nó chưa bao giờ là giới hạn hiệu năng.** Trên đúng bề mặt
phát sóng 1080×1920:

| Số lính | ms/khung |
|---|---|
| 50 | 0,04 |
| 220 | 0,20 |
| 440 | 0,41 |
| 800 | 0,63 |

Ngân sách 60fps là 16,7ms. Vẽ lính chưa bao giờ là thứ đáng lo.

**Nhưng tôi không thay 220 bằng một con số mới lấy từ máy này.** Máy này là RTX
3050; máy cần quan tâm là laptop của streamer đang encode 1080p60 song song.
Chọn hằng số mới từ một máy mạnh chỉ là lặp lại đúng sai lầm cũ với số liệu
tươi hơn.

**Đã làm:** `lib/frame-budget.ts` — overlay tự đo nhịp khung hình của chính nó và
tự hạ tải. Ba mức `full` / `reduced` / `minimal`, trần quân số nhân theo mức, 3D
hạ độ phân giải render. Cách này đúng trên phần cứng không ai ở đây thử được.

Ba quyết định trong đó đáng ghi lại:

- **Hạ nhanh, phục hồi chậm** (α 0,25 so với 0,03). Hạ trễ thì khán giả nhìn thấy
  giật; phục hồi vội thì mật độ lính nhấp nháy mỗi lần có quà lớn, mà nhấp nháy
  trông như phần mềm hỏng — tệ hơn là cứ giữ mức thấp.
- **Có vùng trễ**: ngưỡng để quay lại chặt hơn ngưỡng để rớt xuống, nếu không một
  nhịp khung hình nằm đúng biên sẽ lật qua lật lại liên tục.
- **Bỏ qua mẫu khi trang bị ẩn.** Trình duyệt hãm `requestAnimationFrame` xuống
  còn khoảng một lần mỗi giây khi trang không hiển thị. Nạp con số đó vào sẽ
  đọc ra như máy sập, và khi streamer mở lại cửa sổ thì overlay đang chạy ở một
  phần tư quân số mà không vì lý do gì. Đã kiểm chứng: trang ẩn, `rAF` dừng hẳn,
  mức vẫn là `full`.

Ngoài ra `frameBudget` phân biệt **thời gian chờ khung hình** với **thời gian
overlay thực sự làm việc**. Khung 40ms mà chỉ 2ms là của mình nghĩa là máy đang
bận vì thứ khác — thường là encoder — và hạ tải của mình cũng không giúp bao
nhiêu. Cùng 40ms đó với 30ms là của mình thì mình chính là thủ phạm. Truy được
qua `window.livenovaFrameBudget` trong console, để hỏi được câu đó trên máy của
streamer qua một buổi hỗ trợ.

---

## P2 — Chất lượng sản phẩm, không chặn phát hành

### 7. Ba trong bốn sprite sheet AI không dùng được

Chi tiết ở `packages/shared/src/types/index.ts` (`BATTLE_DEFAULT_ASSETS`). Chó có
khung lưới và chữ "Frame 1 (Contact)" in trong ảnh; gấu là lưới 2 hàng 7 tư thế;
capy là lưới 3×2. Chỉ mèo đúng dải ngang 6 khung.

**Đã làm — nắn lại chính ảnh AI, không sinh ảnh mới.** Tranh vẽ vốn tốt, chỉ bố
cục sai, nên vứt đi thì phí. Mỗi ảnh được đo rồi dựng lại: dò hàng và cột nhân
vật theo khoảng trống, tách hai nhân vật dính nhau bằng cách cắt ở cột mỏng
nhất, xoá nét lưới in trong ảnh (đường xám trung tính chạy suốt chiều cao ô — hạ
ngưỡng chung sẽ đục thủng mõm trắng của chó, nên phải nhắm riêng), bỏ mảnh vụn
bằng cách chỉ giữ khối liền mạch lớn nhất mỗi ô, rồi xếp vào 6 ô vuông cùng tỉ
lệ, canh chân theo một đường đất chung.

Kết quả là `walk_*.png` (900×150, nền trong). Ảnh gốc còn trong git history.

### 8. Chế độ 3D chưa được kiểm chứng trên máy yếu

**Đo mới phát hiện nó không hiển thị gì cả.** File viết bằng class Tailwind
(`absolute inset-0 w-full h-full`) trong khi dự án **không có Tailwind** — không
có config, mọi component khác dùng `style` inline. Không class nào có tác dụng,
div gắn canvas không có chiều cao, three.js dựng canvas 900×0. Chế độ 3D là một
màn hình đen: không lỗi, không cảnh báo. Đã thay bằng style inline; giờ nó vẽ ra.

**Chi phí cảnh (đo được):** 12 lệnh vẽ, ~1.314 tam giác mỗi khung khi chưa có
lính — nhẹ với bất kỳ GPU nào. GPU không phải là rủi ro của tính năng này.

**FPS vẫn không đo được ở môi trường này, và tôi không bịa số.** Cửa sổ tự động
hoá giữ trang ở `hidden`; trình duyệt hãm `requestAnimationFrame` tới mức dừng
hẳn. Bộ đo tự thân của overlay chỉ thu được **2 mẫu**, cả hai đều là lần vẽ đầu
(biên dịch shader, nạp texture) và cho ra 114ms — con số đó **không phải chi phí
thật** và không được dùng ở đâu cả.

Thay vào đó đo thứ quyết định chi phí của một cảnh 12 lệnh vẽ: **tốc độ lấp
pixel**, đo bằng WebGL2 đồng bộ, ép GPU chạy xong bằng `readPixels`:

| Số lượt phủ kín màn 1080×1920 | ms |
|---|---|
| 1 | 0,40 |
| 4 | 0,50 |
| 12 | 1,00 |
| 24 | 1,70 |

Cảnh 3D có 12 lệnh vẽ với vật thể nhỏ, tức tổng diện tích tô còn thấp hơn 12
lượt phủ kín màn — khoảng **1ms hoặc ít hơn** trên GPU này. Kể cả một GPU chậm
hơn 10 lần vẫn nằm trong ngân sách 16,7ms, nhưng đã sát; đó chính là lý do việc
tự hạ độ phân giải ở mục 6 có giá trị: giảm một nửa tỉ lệ pixel thì chi phí tô
còn một phần tư.

**Vẫn cần đo trên máy thật** với cửa sổ hiển thị và OBS đang encode, trước khi
quảng bá 3D như một tính năng. Cái đã loại trừ được là "3D quá nặng vì cảnh phức
tạp" — cảnh không phức tạp.

Một điểm phát hiện lúc đo lần trước: vòng lặp vẫn vẽ 616 khung trong lúc trang
**đang ẩn** ở phiên bản khi đó. Nó không tự dừng khi không hiển thị.

---

## Thứ tự đề xuất

~~1. Migration~~ ✅ · ~~2. Redis adapter~~ ✅ · ~~3. Quyền sở hữu trận~~ ✅

4. Hạn mức theo user, metrics
5. Sinh lại sprite, đo 3D

## Cần làm trước lần deploy nhiều instance đầu tiên

Ba mục P0 đã xong về mã, nhưng **chưa mục nào được chạy thử với Redis thật** —
môi trường phát triển hiện không có Redis (Docker Desktop không khởi động được),
nên phần logic điều phối được kiểm chứng bằng một Redis giả trong
`battle-coordinator.service.spec.ts`: hai coordinator dùng chung một lease store,
tranh nhau một trận, chuyển lệnh cho nhau, mất lease, và tắt máy.

**Đã chạy với Redis thật, và phép thử đó tìm ra hai lỗi chặn:**

1. **Adapter chưa bao giờ gắn được.** `main.ts` dựng adapter bằng
   `app.get(RedisService)` *trước* `app.listen()`, mà Nest chạy `onModuleInit`
   trong `listen` chứ không phải trong `create`. Nên lúc adapter hỏi kết nối,
   `client` vẫn là null; nó ghi log "một instance" rồi lặng lẽ gắn adapter bộ
   nhớ — trong khi Redis kết nối thành công một giây sau đó. Tính năng cụm được
   nối dây và tắt cùng lúc, kèm một dòng log trông như lời giải thích. Đã chuyển
   phần mở kết nối vào constructor.

2. **Sập ngay khi khởi động.** Cặp pub/sub thừa kế `enableOfflineQueue: false`
   từ client chính. Adapter phát `SUBSCRIBE` ngay khi được tạo, trước lúc socket
   ghi được, nên ném "Stream isn't writeable" *bên trong* quá trình tạo gateway
   và kéo sập cả server. Cấu hình đó đúng cho client chính (thà lỗi nhanh còn
   hơn dồn lệnh khi Redis chết) nhưng sai cho adapter; nay `duplicate()` bật lại
   hàng đợi và dùng `lazyConnect` để chờ kết nối xong mới dựng factory.

Sau khi sửa, đã kiểm chứng bằng Redis thật:

- `PING`, `SET NX` (lần hai trả null = khoá đang giữ), `EVAL` — chạy đúng.
- Hai `BattleCoordinatorService` thật: chỉ một bên giành được lease, lệnh chuyển
  tiếp **chạy trên đúng instance sở hữu**, và lease được trả lại ngay khi tắt.
- Hai server Socket.IO ở hai tiến trình: broadcast phát từ B **tới được** client
  đang nối vào A. Kiểm chứng ngược — bỏ adapter đi thì timeout. Nếu không có
  bước ngược này thì phép thử chẳng chứng minh điều gì.
- Hai instance ứng dụng thật (cổng 4001/4002) đều khởi động và log
  `Realtime: Redis adapter dang hoat dong`.

**Mắt xích cuối đã đóng.** Lần chạy đầu trả 500 vì bảng `Battle` không tồn tại
trong database — không liên quan tới Redis. Đã đồng bộ schema bằng chính bộ
migration này (xem bên dưới) rồi chạy lại:

- overlay nối vào **instance A** (cổng 4001)
- `POST /battle/simulate` gửi vào **instance B** (cổng 4002) → 201
- overlay trên A nhận được `overlay.state` với **toàn bộ state thật**, điểm phe
  Mèo đúng bằng số vừa cộng

Điều làm phép thử này có giá trị là ai đã làm việc, đọc từ `/metrics` của hai
instance ngay sau đó:

| | instance A | instance B |
|---|---|---|
| `battles_active` | 0 | **1** |
| `gift_to_broadcast_ms_count` | 0 | **2** |

Và lease trong Redis: `battle:owner:<userId> -> inst-B`.

Nghĩa là A **không hề chạm vào trận đấu** — nó chỉ giữ socket. Toàn bộ phần chơi
diễn ra trên B, và state đi từ B sang socket của A qua Redis adapter. Nếu A cũng
tự xử lý thì `battles_active` của A đã không phải 0, và phép thử sẽ không chứng
minh được gì.

`ALLOW_SINGLE_INSTANCE=true` là đường thoát hợp lệ cho tới khi phép thử trên
chạy được: production sẽ **từ chối khởi động** nếu không có Redis mà cũng không
khai báo cờ này, nên trạng thái một-instance là một quyết định được ghi ra chứ
không phải hệ quả của việc quên đặt biến môi trường.
