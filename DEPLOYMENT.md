# Đưa LiveNova lên `livenova.website`

Hai tiến trình, hai nơi ở khác nhau. Đó không phải lựa chọn kiến trúc cho đẹp —
`apps/server` giữ kết nối Socket.IO tới từng overlay OBS và một kết nối chạy dài
tới TikTok cho mỗi kênh. Nền tảng serverless cắt kết nối theo yêu cầu, nên nó
không phải chỗ cho tiến trình này.

| Tên miền | Chạy cái gì | Ở đâu | Cloudflare |
|---|---|---|---|
| `livenova.website` | `apps/web` (Next.js) | Vercel | **DNS only** (mây xám) |
| `api.livenova.website` | `apps/server` (NestJS) | Railway / Render / Fly | Proxy được (mây cam) |

## Vì sao web để DNS only

Vercel đã có CDN riêng ở tầng edge. Bật proxy Cloudflare chồng lên là hai CDN
nối tiếp nhau: hai lớp cache có thể lệch nhau, và chứng chỉ do hai bên cùng quản
lý sinh ra lỗi khó lần. Cloudflare vẫn có ích ở đây với vai trò DNS và quản lý
các subdomain.

Chỗ proxy Cloudflare thật sự đáng bật là `api.livenova.website`: giấu IP gốc và
chắn DDoS trước khi nó chạm tới tiến trình đang giữ trạng thái trận đấu.

## Biến môi trường

### Web (Vercel)

```
NEXT_PUBLIC_SITE_URL=https://livenova.website
NEXT_PUBLIC_API_URL=https://api.livenova.website
NEXT_PUBLIC_WS_URL=wss://api.livenova.website
```

`NEXT_PUBLIC_SITE_URL` là **bắt buộc**: build production sẽ dừng nếu thiếu. Chốt
chặn đó có vì hậu quả của việc quên nó hoàn toàn im lặng — sitemap, canonical và
`og:url` sẽ mang `http://localhost:3000` trên trang thật, không báo lỗi gì, và
triệu chứng đầu tiên là thứ hạng không bao giờ tới, vài tháng sau.

`wss://` chứ không phải `ws://`. Trang HTTPS mà mở socket `ws://` thì trình duyệt
chặn thẳng vì nội dung hỗn hợp.

### API (Railway / Render / Fly)

```
DATABASE_URL=...            # Supabase, qua pooler
DIRECT_URL=...              # Supabase, cong truc tiep — cho migration
REDIS_URL=...
CORS_ORIGIN=https://livenova.website
PUBLIC_WEB_URL=https://livenova.website
JWT_SECRET=...              # >= 32 ky tu, khac JWT_REFRESH_SECRET
JWT_REFRESH_SECRET=...
NODE_ENV=production
```

`CORS_ORIGIN` phải đổi khỏi `http://localhost:3000`, nếu không mọi lời gọi từ
web thật sẽ bị trình duyệt chặn.

Nếu chạy đúng **một** tiến trình API mà không có Redis, phải khai rõ bằng
`ALLOW_SINGLE_INSTANCE=true`. Server từ chối khởi động khi thiếu cả hai, để
trạng thái một-instance là một quyết định được ghi ra chứ không phải hệ quả của
việc quên đặt biến — xem `PRODUCTION_READINESS.md` mục 1 và 2 về chuyện hai
tiến trình không có Redis sẽ hỏng thế nào.

### Migration

Chạy `prisma:deploy`, không bao giờ `db push`. Với một database đã tồn tại từ
trước, phải baseline một lần trước — quy trình và lần chạy thật đã ghi ở
`apps/server/prisma/migrations/README.md`.

## Thứ tự bật

1. Deploy API trước, kiểm `https://api.livenova.website/metrics` trả 200.
2. Deploy web với ba biến ở trên.
3. Trỏ DNS, chờ chứng chỉ cấp xong.
4. Chạy phép thử WebSocket dưới đây **trước khi** báo cho streamer nào.

## Phép thử bắt buộc: overlay qua domain thật

Overlay là sản phẩm. Nếu socket không đi qua được, mọi thứ khác chạy đúng cũng
vô nghĩa — và kiểu hỏng này im lặng: bảng điểm đứng yên, không lỗi nào được ném.

1. Mở `https://livenova.website/overlays/battle?token=...` trong OBS.
2. Gửi một sự kiện: `POST https://api.livenova.website/battle/simulate`.
3. Điểm trên overlay phải nhúc nhích.

Nếu không nhúc nhích, xem `/metrics` của API: `livenova_overlay_sockets` bằng 0
nghĩa là socket chưa hề nối được (nghi proxy hoặc `wss://`); lớn hơn 0 mà
`gift_to_broadcast_ms_count` không tăng nghĩa là sự kiện chưa tới được dịch vụ.

## Cấu hình Cloudflare cần chỉnh tay

- **SSL/TLS: Full (strict)**. *Flexible* tạo HTTPS giả ở lớp ngoài trong khi lớp
  trong vẫn là HTTP.
- **Tắt Rocket Loader** cho `/overlays/*`. Nó hoãn và sắp xếp lại script; nguồn
  trình duyệt trong OBS rất dễ vỡ vì thứ này.
- **Đừng cache HTML của `/overlays/*`**. Link mang token và trạng thái là thời
  gian thực; một bản HTML nằm trong cache biên là một overlay đóng băng.
