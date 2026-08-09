# Kế hoạch kiểm thử phần game: quà, phe, và người xem

## Hiện trạng — không phải trắng trơn

`battle.service.spec.ts` có **35 test** và chúng phủ khá tốt ba nhóm:

- **Tính điểm**: quà tính theo coin thật, quà đủ lớn kết thúc trận, sự kiện gửi cho phe không tồn tại thì bị bỏ.
- **Kết trận**: hết giờ, hạ hết thành, hoà, trận không điểm, chỉ đóng một lần dù tick chạy nhiều lần.
- **Bảng công thần**: giữ tổng khi donor rớt khỏi bảng, đếm một lần khi đổi phe, tên hiển thị, số dòng theo mẫu.

Cộng thêm nhóm đa-instance và ngân sách chống spam. Nên vấn đề không phải "chưa ai viết test", mà là **các test hiện có đi qua đường tính điểm, không đi qua đường quyết định phe**.

Đó là hai đường khác nhau, và đường thứ hai mới là thứ người xem cảm nhận: tặng quà xong thấy mình thuộc phe nào.

---

## Lỗ hổng thật, liệt kê theo nhánh mã

Toàn bộ việc quyết định phe nằm trong `resolveTeam` (`battle.service.ts`) và một dòng gán trong `handleLiveEvent`:

```ts
const giftName = (event.giftName ?? '').trim().toLowerCase();
const match = battle.state.teams.find((t) =>
  t.giftNames.some((g) => g.trim().toLowerCase() === giftName),
);
```

```ts
this.allegiance.set(`${battle.userId}:${event.senderUsername}`, teamKey);
```

Mười một nhánh dưới đây **chưa có test nào chạm tới**.

### A. Khớp tên quà

| # | Kịch bản | Vì sao quan trọng |
|---|---|---|
| A1 | TikTok gửi `"rose"` viết thường, mẫu khai `"Rose"` | Mã có `toLowerCase()` nhưng chưa ai chứng minh nó đúng. Nếu hỏng, quà rơi vào hư không và người tặng không thấy gì xảy ra. |
| A2 | TikTok gửi `" Rose "` có khoảng trắng thừa | `trim()` ở cả hai vế, chưa được kiểm. |
| A3 | Tên quà tiếng Việt có dấu: `"Hoa Hồng"`, `"Thần Rồng"` | **Đã kiểm chứng là lỗi thật — xem phần dưới.** |
| A4 | `giftName` rỗng hoặc `undefined` | Trả `null` sớm. Có nhánh, chưa có test. |
| A5 | Hai phe cùng khai một tên quà (lỗi cấu hình của streamer) | `find` lấy phe đầu tiên. Không sai, nhưng phải có test để hành vi đó là quyết định chứ không phải tình cờ, và nên cảnh báo trong bảng điều khiển. |

### B. Ghi nhớ phe của người xem

| # | Kịch bản | Vì sao quan trọng |
|---|---|---|
| B1 | Tặng quà cho Mèo → like → điểm về Mèo | Có test rồi (`sends a like to the team the sender last gifted to`). ✅ |
| B2 | Tặng Mèo → tặng Chó → like | **Chưa có.** Like phải về Chó. Đây là hành vi "đổi phe" mà người xem thật sẽ làm. |
| B3 | Tặng quà → **share** | Chỉ `LIKE` được kiểm. Nhánh `SHARE` đi cùng đường nhưng chưa ai chứng minh. |
| B4 | Tặng quà → **follow** | Tương tự B3. |
| B5 | Cùng một người xem, hai streamer khác nhau | Khoá là `${battle.userId}:${senderUsername}`. Nếu khoá sai, phe của khán giả ở phòng này rò sang phòng kia. Chưa có test nào có hai `userId`. |
| B6 | Người xem bị đẩy khỏi bộ nhớ khi quá 20.000 người | `evictIfCrowded` xoá người cũ nhất. Sau đó like của họ không còn phe → không cộng điểm. Đây là đánh đổi có chủ ý, nhưng chưa được ghi lại bằng test. |

---

## A3 — đã kiểm chứng, đây là lỗi đang sống

Chạy thử trực tiếp:

```
Hai chuỗi nhìn giống nhau: Hoa Hồng | Hoa Hồng
Độ dài NFC = 8 , NFD = 10
nfc === nfd ?  false

--- mô phỏng đúng logic resolveTeam hiện tại ---
Có khớp không: false

--- nếu chuẩn hoá cả hai vế ---
Có khớp không: true
```

Tiếng Việt có hai cách mã hoá cùng một chữ. `"Hồng"` dạng NFC là 1 ký tự cho
`ồ`; dạng NFD là `o` + hai dấu rời. Trên màn hình chúng **giống hệt nhau**, và
với `===` chúng **khác nhau**.

`resolveTeam` hiện chỉ `trim()` và `toLowerCase()`, không chuẩn hoá. Nên nếu
TikTok gửi tên quà ở dạng khác với dạng streamer gõ vào mẫu, quà đó **không
khớp phe nào** — và theo đúng thiết kế, sự kiện bị bỏ qua trong im lặng. Người
xem tặng quà, không có gì xảy ra trên màn hình, không có lỗi nào trong log.

Cả bốn phe mặc định đều khai tên quà tiếng Việt có dấu: `Hoa Hồng`, `Nước Hoa`,
`Bánh Donut`, `Thần Rồng`. Nên bề mặt rủi ro là toàn bộ trò chơi.

**Chưa xác định được** TikTok thực sự gửi dạng nào — điều đó cần lưu lượng thật.
Nhưng bản sửa an toàn theo cả hai chiều: `normalize('NFC')` ở hai vế là phép
lũy đẳng, không đổi gì khi hai bên vốn đã cùng dạng, và cứu được khi chúng khác
dạng. Không có lý do để chờ mới sửa.

---

## Ba câu hỏi phải quyết trước khi viết test

Đây là phần quan trọng nhất của kế hoạch này, và nó **không phải việc kỹ thuật**.

`resetBattle` hiện xoá `topDonors`, `donors`, `recentEvents`, `winnerTeamKey` — nhưng **không** xoá `allegiance`, `followed`, `viewerEnergy`. Ba tập đó sống sót qua trận mới.

Không thể viết test cho ba thứ này cho tới khi có người quyết định chúng *nên* làm gì. Viết test bây giờ chỉ là đóng băng hành vi tình cờ.

### Câu 1 — Sang trận mới, người xem còn thuộc phe cũ không?

- **Giữ**: người hâm mộ Mèo vẫn là fan Mèo, like của họ vẫn về Mèo mà không cần tặng lại. Thân thiện với người xem trung thành.
- **Xoá**: mỗi trận là một ván mới, ai muốn theo phe nào phải tặng quà lại. Có lợi cho streamer vì mỗi trận tạo ra một đợt tặng quà mới.

Hành vi hiện tại là **giữ**. Tôi nghiêng về giữ, nhưng đó phải là lựa chọn được ghi ra.

### Câu 2 — Sang trận mới, follow còn được tính lại không?

Hiện tại **không**: tập `followed` sống sót, nên một người đã follow ở trận trước sẽ không cộng điểm follow ở trận sau.

Tôi cho rằng đây **là lỗi**, không phải thiết kế. Follow chỉ xảy ra một lần trong đời một người xem, nên nếu không tính lại thì ở mọi trận sau, phần thưởng follow gần như bằng không cho phòng có khán giả quen. Nhưng đây vẫn là quyết định của sản phẩm.

### Câu 3 — Sang trận mới, ngân sách chống spam có được nạp lại không?

Hiện tại **không**. Người xem đã dùng hết ngân sách like ở trận trước bước vào trận mới với ví rỗng.

Cái này tôi khá chắc là sai, vì ngân sách vốn để chống spam trong một trận chứ không phải hạn mức trọn đời.

---

## Bộ dựng dữ liệu cần làm trước

Các test hiện tại lặp lại rất nhiều mã dựng `LiveEvent`. Thêm 15 test nữa theo cách đó sẽ tạo ra một file không ai dám sửa.

Nên làm trước một bộ dựng nhỏ trong `battle.test-helpers.ts`:

```ts
const viewer = (username: string) => ({
  gifts: (giftName: string, coinValue = 5) => LiveEvent…,
  likes: (count = 1) => LiveEvent…,
  shares: () => LiveEvent…,
  follows: () => LiveEvent…,
});
```

Để một kịch bản đọc được thành câu:

```ts
await service.handleLiveEvent(viewer('@an').gifts('Hoa Hồng'));
await service.handleLiveEvent(viewer('@an').gifts('Nước Hoa'));
await service.handleLiveEvent(viewer('@an').likes());
// điểm phải về Chó, không phải Mèo
```

Đây không phải trang trí. Kịch bản "quà → phe" là kịch bản nhiều bước, và nếu mỗi bước tốn tám dòng thì không ai viết đủ số kịch bản cần thiết.

---

## Phần không thể unit-test

Ba thứ dưới đây phải kiểm bằng trình mô phỏng và bằng mắt, và nên ghi thành checklist trước mỗi lần phát hành:

1. **Quà → lính chạy ra**: `TroopCanvas.spawn` chưa có test nào gọi tới. Có thể viết test cho đường này bằng cách kiểm số lượng lính sinh ra theo tier quà, nhưng phần "trông có đúng không" thì không.
2. **Quà lớn → cinematic**: `SkillCinematic` có spec riêng, nhưng việc *xếp hàng* khi hai người tặng quà lớn trong cùng một giây thì chưa.
3. **Độ trễ cảm nhận được**: từ lúc tặng tới lúc màn hình đổi. Đã có `livenova_gift_to_broadcast_ms` trong `/metrics` — nên dùng nó làm ngưỡng chứ không cảm tính.

---

## Thứ tự làm

| Bước | Việc | Ước lượng |
|---|---|---|
| 1 | Trả lời ba câu hỏi hành vi ở trên | 15 phút, cần người quyết |
| 2 | Bộ dựng `battle.test-helpers.ts` | 1 giờ |
| 3 | Nhóm A — khớp tên quà (A1–A5) | 2 giờ |
| 4 | **Sửa A3** — đã kiểm chứng là lỗi thật, không còn là "nếu". Chuẩn hoá `normalize('NFC')` ở cả hai vế | 30 phút |
| 5 | Nhóm B — ghi nhớ phe (B2–B6) | 2 giờ |
| 6 | Sửa reset theo quyết định ở bước 1, kèm test | 1 giờ |
| 7 | Test cho `TroopCanvas.spawn` theo tier quà | 1 giờ |

Bước 4 nên làm sớm hơn thứ tự này gợi ý nếu sản phẩm đang chạy thật: nó rẻ, an
toàn theo cả hai chiều, và nếu TikTok đang gửi dạng NFD thì mọi món quà tiếng
Việt hiện đang rơi vào hư không mà không ai biết.
