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
| 4 | Hạn mức theo từng streamer | ⬜ Chưa |
| 5 | Quan sát được trận đấu | ⬜ Chưa |
| 6 | Ngưỡng tài nguyên overlay | ⬜ Chưa |
| 7 | Sinh lại 3 sprite sheet | ⬜ Chưa (cần ảnh mới) |
| 8 | Đo 3D trên máy yếu | ⬜ Chưa |

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

Cần: hạn mức theo `userId` và theo kênh, tách riêng cho đường ingest quà.

### 5. Chưa có quan sát được trận đấu

Hiện chỉ có log của Nest. Không có metric nào cho: số trận đang chạy, độ trễ từ
lúc nhận quà tới lúc overlay đổi, tỉ lệ `flush()` lỗi, số socket đang mở.

Khi một streamer báo "overlay đứng", hôm nay không có cách nào trả lời ngoài đọc
log thủ công. Cần Prometheus metrics + một dashboard tối thiểu bốn chỉ số trên.

### 6. Chi phí tài nguyên của overlay chưa có ngưỡng

`maxTroops = 220` là con số chọn tay, chưa từng đo trên máy streamer thật (máy
đang encode 1080p60 song song). Cần đo bằng `PerformanceObserver` trên máy cấu
hình thấp rồi đặt ngưỡng theo dữ liệu, kèm chế độ tự giảm chất lượng khi khung
hình rớt.

---

## P2 — Chất lượng sản phẩm, không chặn phát hành

### 7. Ba trong bốn sprite sheet AI không dùng được

Chi tiết ở `packages/shared/src/types/index.ts` (`BATTLE_DEFAULT_ASSETS`). Chó có
khung lưới và chữ "Frame 1 (Contact)" in trong ảnh; gấu là lưới 2 hàng 7 tư thế;
capy là lưới 3×2. Chỉ mèo đúng dải ngang 6 khung.

Bộ nạp (`components/battle/sprite-sheet-prep.ts`) đã từ chối sheet sai thay vì
render ra rác, nên hiện cả bốn phe dùng bộ SVG vẽ tay cho đồng bộ. Chỉ cần sinh
lại 3 file đúng chuẩn **một hàng ngang, không chữ, không viền khung** là đổi
đường dẫn về `/sprites` — sửa một dòng.

### 8. Chế độ 3D chưa được kiểm chứng trên máy yếu

`BattleArena3D.tsx` (503 dòng) đã được chuyển sang `next/dynamic` nên three.js
không còn nằm trong bundle của người dùng 2D. Nhưng chưa ai đo FPS của nó khi
OBS đang encode. Trước khi quảng bá như một tính năng, cần đo trên máy tầm trung
và ghi rõ yêu cầu cấu hình.

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

Cái *chưa* được kiểm chứng là tầng dây nối: ioredis nói chuyện với Redis thật, và
`@socket.io/redis-adapter` thật sự đẩy broadcast qua hai tiến trình. Trước khi
mở cho nhiều instance, phải chạy đúng phép thử này:

1. Bật Redis, chạy hai instance ở hai cổng khác nhau.
2. Mở overlay trỏ vào instance A.
3. Gọi `POST /battle/simulate` vào instance B.
4. Overlay ở A phải nhúc nhích. Nếu không, adapter chưa hoạt động — và đó chính
   là lỗi âm thầm mà toàn bộ mục 2 sinh ra để chặn.

`ALLOW_SINGLE_INSTANCE=true` là đường thoát hợp lệ cho tới khi phép thử trên
chạy được: production sẽ **từ chối khởi động** nếu không có Redis mà cũng không
khai báo cờ này, nên trạng thái một-instance là một quyết định được ghi ra chứ
không phải hệ quả của việc quên đặt biến môi trường.
