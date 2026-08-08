# Kế hoạch: Game tương tác (Kingdom War) + Hệ thống Template & Admin

Trạng thái: đề xuất, chưa code. Dựa trên code thật trên `master`.
Bản 2 — đã cập nhật theo 6 quyết định của chủ dự án (mục 7).

---

## 0. Kết luận trước, lý do sau

Hai thứ anh mô tả **không phải hai tính năng rời** — chúng là một.

Kingdom War không nên là một overlay viết cứng cho mèo/chó/gấu/capybara. Nó nên là
**một engine "trận đấu N phe"**, còn "mèo/chó/gấu/capybara" chỉ là **dữ liệu trong
một template** do admin tạo. Làm đúng cách này thì:

- Admin ra được "Chiến tranh trái cây", "Đại chiến anime", "Bắc vs Nam" **không cần
  lập trình viên** — chỉ tạo template mới.
- Template cũng chính là chỗ chứa "video media đã set sẵn" như anh nói.
- Streamer chọn template → một cú bấm là có luật + overlay + media, không phải tự
  cấu hình 20 thứ.

---

## 1. Điểm tựa đã có sẵn trong code

Đây không phải làm từ số 0. Những mảnh sau đã chạy thật và đã kiểm chứng end-to-end:

| Đã có | Ở đâu | Dùng lại thế nào |
|---|---|---|
| Sự kiện live thật (quà, tim, share, follow) | `TiktokService` → bus `live.*` | Nguồn đầu vào của game |
| Kênh "trạng thái liên tục" | `OVERLAY_SOCKET.STATE`, `OverlayState` | Điểm N phe, đồng hồ đếm ngược |
| Kênh "hành động một lần" | `OVERLAY_SOCKET.ACTION` | Rồng bay ra, đại bác bắn, nổ bom |
| Mẫu service quà → state | `GoalService`, `PkService` | `BattleService` copy đúng khuôn này |
| Overlay xác thực bằng public token | `OverlayGateway` | Trang game dùng y nguyên |
| `Role { USER, ADMIN }` | `schema.prisma:11` | **Có enum nhưng chưa guard nào dùng** |
| `LedgerReason.ADMIN_ADJUST` | `schema.prisma:51` | Admin cộng/trừ credit qua ledger |
| Preset luật viết cứng | `RuleService.applyPreset` | **Chính là mầm của template — cần đưa vào DB** |
| Upload media | `modules/upload` + Cloudinary | Kho asset cho template |

Hai dòng in đậm là mấu chốt: `Role.ADMIN` hiện **chỉ là trang trí**, không guard
nào đọc nó. Và `applyPreset` đã là "template" sơ khai, chỉ khác là preset nằm
trong file `.ts` thay vì DB.

Một điểm nữa đáng nói: **`OverlayGateway` không phải sửa dòng nào.** Nó đã có sẵn
cả hai kênh ACTION và STATE mà game cần.

---

## 2. Cơ chế chơi (đã chốt)

### 2.1 Chọn phe = tặng quà nào thì vào phe đó

Admin gán mỗi phe một hoặc nhiều món quà. Tặng Hoa hồng → cộng cho phe Mèo.

**Đây là quyết định làm nhẹ hệ thống đi rất nhiều.** Bản kế hoạch trước lo chuyện
"gán phe cho từng người xem" và vướng ở chỗ webcast đôi khi không gửi
`displayId` (`identity()` trong `TiktokService` có nhánh fallback `'unknown'`).
Với cách này, **điểm số không cần biết người tặng là ai** — món quà tự mang theo
phe của nó. Vấn đề danh tính biến mất khỏi đường tính điểm.

Danh tính chỉ còn cần cho **bảng TOP DONATE**, và ở đó người `unknown` đơn giản
là không lên bảng. Không ai sai điểm.

Hai chỗ phải kiểm khi admin lưu template:

- **Một món quà không được thuộc hai phe.** Nếu trùng thì không biết cộng cho ai.
  Chặn ngay lúc lưu, đừng để phát hiện giữa buổi live.
- **Quà không thuộc phe nào** thì bỏ qua, và nói rõ trong UI admin. Người xem tặng
  quà mà không thấy gì xảy ra sẽ nghĩ hệ thống hỏng.

### 2.2 Hoả lực theo bậc

Đã chốt thứ tự: **tim < share < follow < quà (theo xu)**. Càng nhiều xu, hoả lực
càng mạnh.

Cách làm gọn nhất: quy tất cả về **một con số "power" tính bằng xu-tương-đương**,
rồi một bảng ngưỡng duy nhất quyết định bắn ra hành động gì.

```
tim     → power 1     (có bình năng lượng — xem 2.4)
share   → power 3     (cùng bình với tim)
follow  → power 10    (chỉ tính MỘT LẦN mỗi người mỗi trận)
quà     → power = số xu thật của món quà (không giới hạn)
```

Rồi bảng ngưỡng (chính là giá trong ảnh chụp):

```
power ≥ 1    → triệu hồi lính
power ≥ 10   → xây thành
power ≥ 50   → ném bom
power ≥ 99   → gọi rồng
power ≥ 199  → bắn đại bác
power ≥ 999  → thiên thạch
```

Cả hai bảng nằm trong `Template.config`, admin sửa được, **không nằm trong code**.

**Luật cứng: sự kiện miễn phí không bao giờ gọi được đòn lớn.** Tim / share /
follow chỉ được phép kích hoạt hai bậc rẻ nhất (lính, xây thành). Bom, rồng, đại
bác, thiên thạch **chỉ quà thật mới gọi ra được**.

Đây là ranh giới quan trọng hơn cả việc chỉnh số. Nếu chỉ hạ power của tim xuống
thấp thì spam đủ lâu vẫn cộng dồn tới ngưỡng rồng. Tách hẳn hai nhóm thì **không
lượng spam nào tạo ra được con rồng**, khỏi phải cân số cho mệt.

### 2.4 Bình năng lượng: chống spam tim và share

Tim là loại sự kiện dày nhất trong mọi buổi live TikTok — một người bấm liên tục
có thể tạo hàng chục cái mỗi giây. Share cũng bấm lại được nhiều lần.

Mỗi người xem có một **bình năng lượng dùng chung cho tim và share**:

```
Sức chứa      : 30 power
Hồi lại       : +1 power mỗi 2 giây  (tối đa ~30 power/phút/người)
Tim tốn       : 1
Share tốn     : 3
```

Hết bình thì tim/share của người đó **vẫn hiện hiệu ứng nhỏ trên màn hình nhưng
không cộng điểm nữa**. Có hiệu ứng để họ không tưởng hệ thống hỏng; không cộng
điểm để spam vô nghĩa. Bình tự đầy lại nên người chơi bình thường gần như không
bao giờ chạm trần.

Ba điều đáng nói:

- **`likeCount` đã là số gộp sẵn.** Một frame webcast có thể nói "người X thả 15
  tim". Trừ đủ 15 vào bình một lần, đừng lặp 15 vòng.
- **Bình chỉ có ý nghĩa với người đã từng tặng quà.** Theo cách A ở mục 2.3, ai
  chưa tặng thì tim/share vốn đã không tính điểm. Nên diện spam thực tế nhỏ hơn
  nhiều so với lo ban đầu — bình là để chặn *người đã tặng* ngồi bấm suốt 20 phút.
- **Follow không cần bình**, chỉ cần đếm một lần mỗi người mỗi trận. Về lý thuyết
  có thể unfollow rồi follow lại, nên vẫn phải chặn bằng danh sách đã đếm.

Cả bốn con số trên nằm trong `Template.config`, admin chỉnh được cho từng chủ đề.

### 2.3 Tim / share / follow thuộc phe nào — đã chốt: theo món quà gần nhất

Quà tự mang theo phe. **Tim, share, follow thì không.** Đã chốt cách giải:

> Tim / share / follow của một người được cộng cho **phe của món quà gần nhất
> người đó đã tặng trong trận này**. Ai chưa tặng bao giờ thì tim/share/follow
> của họ không tính điểm.

Không bịa ra phe cho ai, và tự nhiên khuyến khích tặng quà trước khi spam tim.

**Đổi phe giữa trận là hợp lệ.** Tặng cho Mèo rồi sau đó tặng cho Chó thì từ đó
tim của họ về phe Chó. Đây là hành vi đúng — họ đã đổi phe thật.

#### Một bản ghi cho mỗi người xem

Cách A cần nhớ phe của từng người. Bình năng lượng (mục 2.4) và "follow chỉ tính
một lần" cũng cần nhớ theo từng người. **Gộp cả ba vào một bản ghi**, đừng làm ba
bảng riêng:

```ts
// username → trạng thái người xem trong trận này
{
  teamKey: string;        // phe theo món quà gần nhất
  energy: number;         // bình năng lượng còn lại
  energyAt: number;       // lần cuối tính hồi năng lượng
  followCounted: boolean; // follow đã tính chưa
}
```

#### Bảng này mất khi restart — và không sao

Đối lập trực tiếp với điểm số ở mục 3.1: **bảng này nằm trong RAM và không cần ghi
DB**. Restart xong nó rỗng, nhưng tự dựng lại ngay từ món quà tiếp theo của mỗi
người. Cái mất là: vài giây đầu sau restart, tim của người đã tặng trước đó tạm
thời không tính điểm — nhỏ, và không ai nhận ra.

Ghi nó xuống DB thì phải ghi mỗi lần ai đó thả tim, tức là đấm database liên tục
để bảo vệ thứ tự phục hồi được. Không đáng.

#### Giới hạn bộ nhớ — chỗ này phải nhớ

Một buổi live viral có thể có **hàng chục nghìn người tặng quà**. Mỗi người một
bản ghi, giữ suốt 20 phút, nhân với số trận đang chạy đồng thời trên server.

→ Đặt trần (ví dụ 20.000 người/trận) và **loại theo LRU**: ai lâu nhất không hoạt
động thì bỏ trước. Người bị loại chỉ mất phe tạm thời, món quà tiếp theo của họ
sẽ dựng lại.

Đây cùng họ với vấn đề ngập socket ở mục 3.2: **một buổi live viral phải làm hệ
thống chậm đi, không được làm nó sập.**

---

## 3. Hai rủi ro kỹ thuật còn nguyên

### 3.1 Trận đấu phải sống qua restart

**"Restart" nghĩa là gì.** Server LiveNova là một chương trình đang chạy. Mọi thứ
nó "nhớ" mà không ghi xuống database thì nằm trong RAM — và RAM mất sạch mỗi khi
chương trình dừng lại. Chương trình dừng trong bốn trường hợp, cả bốn đều bình
thường:

1. Deploy phiên bản mới (mỗi lần merge PR là một lần)
2. Server crash vì lỗi
3. Nhà cung cấp hosting khởi động lại máy / chuyển container
4. Hết bộ nhớ, hệ điều hành kill tiến trình

**Chuyện gì xảy ra nếu điểm chỉ nằm trong RAM:**

```
20:00  Trận bắt đầu, đồng hồ 20 phút
20:07  Mèo 45.000 xu · Chó 38.000 · Gấu 12.000 · Capy 9.000
       (người xem đã bỏ ra hơn 100.000 xu tiền thật)
20:08  Deploy bản mới  ← server tắt rồi bật lại trong 15 giây
20:08  Mèo 0 · Chó 0 · Gấu 0 · Capy 0
       Đồng hồ biến mất. Trận coi như chưa từng xảy ra.
```

Streamer đang live, không tắt được, không giải thích được. Người vừa tặng 30.000
xu cho phe Mèo thấy điểm về 0.

**Với thanh mục tiêu (`GoalService`) thì chấp nhận được** — nó chỉ là một thanh
chạy, mất thì bò lên lại, không ai mất gì. Tôi đã ghi rõ giới hạn đó trong code.

**Với một trận có đồng hồ và có người thắng thì không.** Khác biệt nằm ở chỗ trận
đấu có *kết quả*, và người xem đã trả tiền để tác động vào kết quả đó.

**Cách sửa:** ghi điểm xuống database. Restart xong, server đọc lại bảng `Battle`
+ `BattleScore`, thấy có trận `RUNNING` chưa hết giờ thì dựng lại đúng chỗ đang
dở — điểm còn nguyên, đồng hồ tính tiếp từ `endsAt`.

```
20:08  Deploy bản mới  ← server tắt rồi bật lại
20:08  Đọc DB: có trận RUNNING, endsAt = 20:20
       Mèo 45.000 · Chó 38.000 · Gấu 12.000 · Capy 9.000
       Đồng hồ: còn 12 phút. Overlay tự kết nối lại và vẽ tiếp.
```

Người xem chỉ thấy overlay đứng hình vài giây rồi chạy tiếp.

Đây cũng là lý do phải ghi **gộp ~2 giây một lần** chứ không phải mỗi món quà: ghi
mỗi sự kiện thì buổi live đông sẽ đấm database liên tục. Mất tối đa 2 giây dữ liệu
khi crash là cái giá chấp nhận được.

→ Bảng `Battle` + `BattleScore`. **Bắt buộc, không phải tuỳ chọn.** Đây là khác
biệt lớn nhất so với GOAL.

Trả lời câu hỏi của anh ở mục 2 — **đúng, có bảng tỉ số**: `BattleScore`, mỗi phe
một dòng, ghi xuống DB (gộp ~2 giây một lần chứ không phải mỗi món quà).

### 3.2 Game không tốn credit ⇒ không có phanh

TTS tự giới hạn vì tốn credit của streamer. Gọi rồng / bắn đại bác **không tốn
credit** — nó tốn xu của người xem, mà xu đó TikTok trả thẳng cho streamer
(anh đã xác nhận, nên không có bài toán ăn chia).

Nhưng hệ quả kỹ thuật vẫn còn: một buổi live đông có thể sinh **hàng trăm sự kiện
mỗi phút**, và giờ cả tim cũng tính điểm — tim là loại sự kiện nhiều nhất trong
mọi buổi live TikTok, có thể vài chục cái mỗi giây.

→ Hai lớp phanh, cả hai bắt buộc:
- **Gộp state**: tối đa ~4 frame/giây thay vì một frame mỗi sự kiện.
- **Hàng đợi action có trần**: giống `useSpeechQueue` đã làm — quá tải thì bỏ cái
  cũ nhất, vì hiệu ứng của 30 giây trước không còn ý nghĩa trên sóng.

Riêng tim còn cần **gộp theo lô** trước khi vào engine: `likeCount` trong một
frame webcast đã là số gộp sẵn, đừng tính từng cái một.

---

## 4. Kiến trúc

### 4.1 Ba khái niệm mới

```
GameMode   — engine, code. Hiện chỉ một: TEAM_BATTLE (N phe đánh nhau).
Template   — dữ liệu admin tạo: cấu hình cho một GameMode + luật + media.
Battle     — một lượt chơi cụ thể, có bắt đầu / kết thúc / điểm.
```

"Kingdom War" = một **Template** trỏ vào GameMode `TEAM_BATTLE`, 4 phe tên
Mèo/Chó/Gấu/Capybara, ảnh lâu đài, bảng quà→phe và bảng hoả lực.

### 4.2 Hình dạng `Template.config`

```jsonc
{
  // N phe — schema không khoá số lượng, UI mặc định vẽ 4.
  "teams": [
    { "key": "cat", "name": "Vương quốc Mèo", "color": "#a78bfa",
      "castleAsset": "castle_cat", "giftNames": ["Rose", "Hoa hồng"] },
    { "key": "dog", "name": "Vương quốc Chó", "color": "#60a5fa",
      "castleAsset": "castle_dog", "giftNames": ["Finger Heart"] }
    // ...
  ],

  // Quy mọi sự kiện về một con số xu-tương-đương.
  "power": { "like": 1, "share": 3, "follow": 10 },
  //          quà không có ở đây: power = số xu thật của món quà

  // Chống spam tim/share. Follow chặn bằng "một lần mỗi trận", không cần bình.
  "energy": { "capacity": 30, "refillPerSec": 0.5 },

  // Sự kiện miễn phí chỉ gọi được tới bậc này. Bom trở lên phải là quà thật.
  "freeEventMaxAction": "castle",

  // Một bảng ngưỡng duy nhất quyết định bắn ra gì.
  "actions": [
    { "minPower": 1,   "key": "soldier", "asset": "fx_soldier" },
    { "minPower": 10,  "key": "castle",  "asset": "fx_castle"  },
    { "minPower": 50,  "key": "bomb",    "asset": "fx_bomb"    },
    { "minPower": 99,  "key": "dragon",  "asset": "fx_dragon"  },
    { "minPower": 199, "key": "cannon",  "asset": "fx_cannon"  },
    { "minPower": 999, "key": "meteor",  "asset": "fx_meteor"  }
  ],

  "battle": { "durationSec": 1200, "showTopDonors": 4 }
}
```

`asset` và `castleAsset` trỏ vào **khoá** trong `TemplateAsset`, không nhúng URL
Cloudinary. Đổi video rồng chỉ cần đổi asset, không đụng config.

### 4.3 Schema (Prisma)

```prisma
enum TemplateKind { GAME, MEDIA_PACK, RULE_PACK }
enum GameMode     { TEAM_BATTLE }
enum BattleStatus { PENDING, RUNNING, FINISHED, CANCELLED }

model Template {
  id             String       @id @default(uuid())
  kind           TemplateKind
  gameMode       GameMode?              // chỉ có khi kind = GAME
  name           String
  description    String?
  thumbnailUrl   String?
  config         Json
  /// Trường nào streamer được ghi đè. Ngoài danh sách này là admin khoá.
  editableFields String[]     @default([])
  published      Boolean      @default(false)
  createdById    String
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  assets         TemplateAsset[]
  @@index([kind, published])
}

model TemplateAsset {
  id         String   @id @default(uuid())
  templateId String
  /// Khoá logic: "fx_dragon", "castle_cat". Config trỏ vào đây, không nhúng URL.
  key        String
  url        String
  mediaType  String
  template   Template @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@unique([templateId, key])
}

/// Bản sao template lúc streamer áp dụng. Admin sửa template gốc không đụng
/// tới bản này — quyết định số 6.
model UserTemplate {
  id         String   @id @default(uuid())
  userId     String
  templateId String                     // nguồn gốc, để biết ai đang dùng gì
  name       String
  config     Json                       // bản sao, streamer sửa được phần cho phép
  createdAt  DateTime @default(now())

  @@index([userId])
}

model Battle {
  id             String       @id @default(uuid())
  userId         String
  channelId      String
  userTemplateId String
  status         BattleStatus @default(PENDING)
  startedAt      DateTime?
  endsAt         DateTime?
  /// Snapshot lúc bắt đầu: sửa template giữa trận không đổi luật trận đang chạy.
  configSnapshot Json
  scores         BattleScore[]

  @@index([userId, status])
  @@index([channelId, startedAt])
}

model BattleScore {
  battleId String
  teamKey  String                       // "cat", "dog", ...
  power    Int      @default(0)         // xu-tương-đương tích luỹ
  battle   Battle   @relation(fields: [battleId], references: [id], onDelete: Cascade)

  @@id([battleId, teamKey])
}
```

Hai chi tiết đáng nói:

- **`UserTemplate` là bản sao** (quyết định 6). Admin sửa template gốc lúc 21h
  không làm đổi cấu hình streamer đã áp lúc 20h.
- **`configSnapshot` trên `Battle`** là lớp bảo vệ thứ hai: kể cả streamer tự sửa
  `UserTemplate` giữa trận cũng không đổi luật trận đang chạy. Lỗi này kinh điển
  với hệ template và rất khó debug về sau.

### 4.4 Luồng chạy

```
Quà / tim / share / follow  (bus live.* — đã có)
   ↓
BattleService
   ├─ quà  → tra giftName → phe          (không cần biết người tặng là ai)
   ├─ tim/share/follow → tra phe theo món quà gần nhất của người đó   [cách A]
   ├─ quy về power → cộng BattleScore    (ghi DB gộp ~2s)
   ├─ tra bảng ngưỡng → action nào
   ├─ phát OVERLAY_STATE   (điểm N phe + đồng hồ)  ← gộp ≤4 frame/giây
   └─ phát OVERLAY_ACTION  (rồng/đại bác/bom)      ← hàng đợi có trần
   ↓
OverlayGateway  (đã có, không sửa)
   ↓
/overlays/battle?token=...   ← trang mới
```

---

## 5. Admin

`Role.ADMIN` đã có trong schema nhưng **chưa guard nào dùng**. Cần làm thật.

### 5.1 Bắt buộc về bảo mật

1. **Không có đường tự phong admin.** Admin đầu tiên tạo bằng seed script chạy
   tay, không qua API. Endpoint nâng quyền (nếu có) phải yêu cầu admin sẵn có.
2. **Admin không được xem `Overlay.publicToken` của người khác.** Token đó là
   credential phát sóng — endpoint admin phải `select` bỏ nó ra, giống
   `getPublicByToken` hiện tại đã cẩn thận không trả `userId`.
3. **Cộng/trừ credit phải qua ledger** với `LedgerReason.ADMIN_ADJUST` (đã có
   sẵn) — không `UPDATE` thẳng `CreditBalance`. Constraint
   `credit_balance_non_negative` là tuyến phòng thủ cuối, không phải tuyến duy nhất.
4. **Ghi log mọi hành động admin** (`AdminAuditLog`: ai, làm gì, lên ai, lúc nào).
   Không có nó thì "tự dưng mất credit" là câu hỏi không trả lời được.

### 5.2 Việc admin làm được

| Nhóm | Chức năng |
|---|---|
| User | Danh sách, tìm kiếm, xem chi tiết, khoá/mở, cộng/trừ credit kèm lý do |
| Template | CRUD, upload asset, publish/unpublish, xem bao nhiêu streamer đang dùng |
| Game | Sửa bảng quà→phe, bảng hoả lực, thời lượng trận |
| Vận hành | Xem trận đang chạy, huỷ trận lỗi, tỉ lệ cache TTS (`getCacheStats` đã có) |

### 5.3 Kỹ thuật

- `RolesGuard` + decorator `@Roles(Role.ADMIN)`, đặt cạnh `JwtAuthGuard` hiện có.
- Module `modules/admin`, prefix `/admin`.
- Web: nhóm route `app/(admin)/` với layout riêng, **chặn ở server-side**, không
  chỉ ẩn nút ở client.

---

## 6. Chia giai đoạn

Nguyên tắc: **mỗi giai đoạn kết thúc phải chạy được thật.**

### Giai đoạn 1 — Admin + Template (chưa có game)

- `RolesGuard`, module `admin`, seed admin đầu tiên, `AdminAuditLog`
- Bảng `Template`, `TemplateAsset`, `UserTemplate`
- **Chuyển `applyPreset` từ hardcode sang đọc DB** — 3 preset hiện có thành 3
  template hạt giống. Đây là gỡ nợ, không phải thêm mới.
- UI admin: quản lý user, CRUD template
- UI streamer: "Kho mẫu" — chọn và áp (tạo `UserTemplate` bản sao)

Giá trị độc lập: kể cả không bao giờ làm game, việc này vẫn đáng — admin hiện
tại **không tồn tại**, và preset đang nằm trong code.

### Giai đoạn 2 — Engine TEAM_BATTLE

- Bảng `Battle`, `BattleScore`
- `BattleService`: quà→phe, quy đổi power, gộp frame, bảng ngưỡng action
- `BattleState` thêm vào union `OverlayState`
- Trang `/overlays/battle`
- Template "Kingdom War" **tạo bằng UI admin ở giai đoạn 1, không viết cứng**
- Khôi phục trận sau restart từ `Battle` + `BattleScore`

### Giai đoạn 3 — Hoàn thiện

- Bảng TOP DONATE trong trận (như ảnh chụp)
- Kết trận + hiệu ứng ăn mừng phe thắng
- Bản đồ thu nhỏ, lính di chuyển
- Streamer sửa tên phe / màu trong giới hạn `editableFields`

---

## 7. Quyết định đã chốt

| # | Câu hỏi | Chốt | Ảnh hưởng |
|---|---|---|---|
| 1 | Chọn phe kiểu gì | **Theo món quà**, admin gán | Bỏ hẳn bài toán danh tính khỏi đường tính điểm |
| 2 | Có bảng tỉ số không | **Có** — `BattleScore`, ghi DB | Trận sống qua restart |
| 3 | Hoả lực | tim < share < follow < quà (theo xu) | Quy về một số "power", một bảng ngưỡng |
| 4 | Số phe | **N phe**, schema mở | UI mặc định 4, không khoá cứng |
| 5 | Ăn chia xu | **Không** — TikTok trả thẳng streamer | Bỏ hẳn bài toán thanh toán |
| 6 | Template chung hay copy | **Copy khi áp dụng** | Thêm bảng `UserTemplate` |
| 7 | Tim/share/follow thuộc phe nào | **Theo món quà gần nhất của người đó** | Một bản ghi/người trong RAM, có trần LRU |

---

## 8. Còn mở

1. **`LiveEvent` chưa có ai ghi.** Bảng có sẵn, không service nào `create`. Không
   chặn game vì `BattleScore` đã đủ để khôi phục điểm, nhưng nếu muốn dựng lại
   diễn biến chi tiết thì cần writer.
2. **PK bar chưa verify bằng trận PK thật.** Cùng họ với battle — phát hiện sớm
   vấn đề của `battleArmies` thì tốt hơn.
3. **`OBS_COMMAND` vẫn là stub.** Không chặn game, nhưng nếu template muốn "phe
   thắng thì đổi scene OBS" thì cần.

---

## 9. Ước lượng

Tính bằng khối lượng so với PR vừa xong (rule engine + TTS + goal + PK + bridge):

| Giai đoạn | Khối lượng | Rủi ro |
|---|---|---|
| 1 — Admin + Template | ≈ 1x | Thấp — CRUD, đã có mẫu sẵn |
| 2 — Engine battle | ≈ 1.2x | **Cao** |
| 3 — Hoàn thiện | ≈ 1x | Trung bình — chủ yếu đồ hoạ overlay |

Giai đoạn 2 nhẹ hơn bản kế hoạch trước (1.5x → 1.2x) vì quyết định "chọn phe theo
quà" đã bỏ đi phần khó nhất.

Rủi ro cao nhất **không phải** vẽ overlay. Là hai thứ: **khôi phục trận sau
restart**, và **không làm ngập socket khi live đông** — nhất là khi tim cũng tính
điểm, mà tim là loại sự kiện dày nhất trong mọi buổi live.

---

## 10. Đồ hoạ và animation

### 10.1 Ràng buộc quyết định tất cả

Overlay này **không chạy trong tab trình duyệt bình thường**. Nó chạy trong OBS
Browser Source, **trên cùng cái máy đang encode 1080p60 lên TikTok**.

Nghĩa là GPU và CPU đã bị tranh chấp sẵn. Nếu overlay ăn quá nhiều, thứ giật
không phải overlay — **là cả buổi live của streamer**. Người xem thấy hình vỡ,
streamer không hiểu vì sao, và họ sẽ gỡ overlay ra chứ không đi báo lỗi.

Đây là ràng buộc phải cầm lái mọi lựa chọn kỹ thuật bên dưới, không phải "cái nào
đẹp nhất".

Ràng buộc thứ hai đến từ hệ template: **đồ hoạ phải là dữ liệu, không phải code**.
Admin tạo chủ đề "Chiến tranh trái cây" mà phải nhờ lập trình viên build lại thì
cả hệ template mất ý nghĩa. Nên mọi định dạng chọn ở đây đều phải **nạp được từ
URL lúc chạy** (Cloudinary → `TemplateAsset`).

### 10.2 Chia lớp, không chọn một công nghệ duy nhất

Sai lầm phổ biến là chọn một engine rồi vẽ mọi thứ bằng nó. Màn hình này có bốn
loại nội dung với chi phí rất khác nhau:

| Lớp | Nội dung | Công nghệ | Vì sao |
|---|---|---|---|
| 1. Nền tĩnh | Bản đồ, sông, cầu, địa hình | Ảnh PNG/WebP một tấm | Không đổi suốt trận, vẽ một lần |
| 2. HUD | Điểm 4 phe, đồng hồ, TOP DONATE, bong bóng thoại | **DOM + CSS** (như hiện tại) | Chữ phải sắc nét; DOM render chữ tốt hơn canvas. Số lượng ít, đổi chậm |
| 3. Đám đông | Hàng trăm lính, lâu đài, đại bác | **Một lớp Canvas/WebGL duy nhất** | Chỗ này mới là vấn đề — xem 10.3 |
| 4. Hiệu ứng lớn | Rồng bay, thiên thạch, nổ bom | **Video WebM có alpha** | Đẹp nhất trên mỗi đơn vị CPU — xem 10.4 |

Lớp 2 giữ nguyên cách đang làm (`goal`, `pk` đã chứng minh chạy tốt). Chỉ lớp 3
và 4 là mới.

### 10.3 Đám đông: đừng dùng DOM

Đếm sơ trong ảnh anh gửi: khoảng **200+ đơn vị lính** cùng lúc, mỗi con có animation
riêng. Nếu mỗi con là một `<div>`:

- 200 node DOM có animation → trình duyệt phải tính layout/style cho từng cái mỗi frame
- Con số này còn tăng: quà càng nhiều, lính càng đông. Không có trần tự nhiên

CSS `transform` được GPU composite nên không tệ như `left/top`, nhưng 200+ node
vẫn là gánh nặng thật, và nó **cạnh tranh trực tiếp với encoder của OBS**.

Cách đúng: **một thẻ `<canvas>` duy nhất**, vẽ tất cả lính bằng sprite sheet.
Trình duyệt chỉ thấy một element.

Hai lựa chọn cho lớp này:

- **Canvas 2D thuần** — không thêm thư viện, đủ cho vài trăm sprite. Phải tự viết
  vòng lặp vẽ và quản lý sprite sheet. Nhẹ nhất cho máy streamer.
- **PixiJS (WebGL)** — sinh ra đúng cho việc này, gộp sprite (batching) nên chịu
  được hàng nghìn con, có sẵn hệ particle cho khói/lửa. Đổi lại: thêm ~400KB và
  **mở một WebGL context tranh GPU với encoder**.

**Tôi chưa chọn thay anh được, vì đây là câu hỏi đo được chứ không phải câu hỏi ý
kiến.** Xem 10.6.

### 10.4 Hiệu ứng lớn: video có alpha, không phải code

Rồng bay ngang màn hình, thiên thạch rơi, đại bác nổ — đây là thứ quyết định game
trông "xịn" hay "nghiệp dư". Và cách rẻ nhất để đẹp **không phải là lập trình nó**,
mà là **phát một đoạn video có nền trong suốt**.

- Định dạng: **WebM / VP9 có alpha channel**. Chrome (và CEF trong OBS) hỗ trợ.
  *Không dùng HEVC-alpha* — đó là đường của Safari, sẽ không chạy trong OBS.
- Nghệ sĩ dựng ở After Effects / Blender, xuất WebM, admin upload vào
  `TemplateAsset` với khoá `fx_dragon`. **Không ai phải sửa code.**
- Đường phát lại **đã có sẵn**: overlay `media` hiện tại đã phát video từ URL.
  Lớp này gần như là tái sử dụng.

Đây cũng là lý do `Template.config` trỏ vào **khoá asset** (`"asset": "fx_dragon"`)
chứ không nhúng URL: đổi video rồng đẹp hơn chỉ cần thay asset.

### 10.5 Nhân vật có phản ứng: Rive (nếu cần)

Trong ảnh, mỗi vua có biểu cảm và bong bóng thoại. Nếu muốn vua **phản ứng theo
trận** (cười khi phe mình dẫn, gục khi thua) thì có hai mức:

- **Đủ dùng**: vài file WebM/ảnh cho từng trạng thái, đổi qua lại. Không thêm
  thư viện nào.
- **Đẹp hơn**: **Rive** — nghệ sĩ dựng nhân vật kèm *state machine* trong editor
  của Rive, code chỉ gọi `setState('winning')`. File `.riv` nạp từ URL, hợp với
  hệ template. Đổi lại là thêm một runtime và một công cụ mà cả team phải học.

Lottie cũng nạp được từ URL nhưng chỉ phát animation cố định, không có state —
hợp với hiệu ứng một lần hơn là nhân vật phản ứng. Mà hiệu ứng một lần thì WebM
alpha đã làm tốt và rẻ hơn.

**Đề xuất: giai đoạn 2 dùng mức "đủ dùng". Chỉ cân nhắc Rive ở giai đoạn 3**, và
chỉ khi đã có người làm được đồ hoạ — công cụ không tự sinh ra nội dung đẹp.

### 10.6 Việc cần làm trước khi cam kết: đo thật

Tôi **không nên đoán** Canvas 2D hay PixiJS hợp hơn, vì con số duy nhất có ý nghĩa
là con số đo trên máy streamer thật, trong lúc OBS đang encode.

Một spike ngắn, trước khi vào giai đoạn 2:

1. Dựng một trang thử vẽ N sprite chuyển động (N = 100 / 300 / 600) bằng ba cách:
   DOM, Canvas 2D, PixiJS.
2. Mở trong **OBS Browser Source thật**, đang stream/record 1080p60.
3. Đo hai thứ — và thứ hai mới là thứ quan trọng:
   - FPS của overlay
   - **Số frame OBS bị rớt** (OBS có sẵn thống kê này)
4. Chốt ngưỡng: bao nhiêu sprite là trần an toàn, rồi **giới hạn cứng trong
   engine** — quà đông tới đâu cũng không vẽ quá ngần đó lính.

Bước 4 là bước hay bị quên. Không có trần thì một buổi live viral sẽ tự làm sập
overlay của chính nó, đúng vào lúc đông người xem nhất.

### 10.7 Vài điều nhỏ nhưng ăn tiền

- **Nền phải trong suốt thật.** `background: transparent` trên `body` và `html` —
  các overlay hiện tại đã làm đúng, giữ nguyên.
- **Không dùng `prefers-reduced-motion` để tắt animation ở đây.** Overlay là nội
  dung phát sóng, không phải giao diện người dùng đọc. Nhưng **giới hạn hiệu năng
  thì vẫn phải có** (10.6).
- **Preload asset trước khi trận bắt đầu.** Rồng tải xong sau khi hiệu ứng đã qua
  thì coi như không có. Tải hết asset của template lúc overlay kết nối, không phải
  lúc cần dùng.
- **Cloudinary nén giúp**: dùng `f_auto,q_auto` cho ảnh. Riêng WebM alpha thì
  **không** để Cloudinary tự chuyển định dạng — nó có thể bỏ mất alpha channel.
- **Kích thước cố định 1920×1080.** Browser Source có kích thước cố định; đừng
  làm responsive, làm đúng một khung.
