# Kế hoạch: quà tặng → nhân vật VRM nhảy một đoạn

> **Mục tiêu:** người xem tặng quà → nhân vật diễn một **đoạn nhảy ngắn** kèm đoạn nhạc tương ứng, rồi trở về trạng thái nghỉ. Mỗi mức quà ứng với một đoạn nhảy khác nhau.
>
> Bài hát: **"2 Phút Hơn"**. Không nhảy hết bài — chỉ những đoạn 3–15 giây.
>
> Phiên bản này thay thế bản kế hoạch "nhảy hết bài 2 phút" trước đó. Yêu cầu đổi thành đoạn ngắn, và điều đó làm kiến trúc đơn giản đi rất nhiều — xem §4.

---

## 1. Yêu cầu đã chốt

| Câu hỏi | Trả lời |
|---|---|
| Bài hát | "2 Phút Hơn" |
| Nhảy hết bài hay đoạn ngắn? | **Đoạn ngắn**, kích hoạt theo quà |
| Quà chèn lên hay thay bài nhảy? | **Quà = chọn đoạn nhảy**. Tặng quà nào thì nhảy đoạn của quà đó |
| Ai làm bước Blender? | **Script tự động**, chạy headless — xem §3 |
| Làm giai đoạn upload VMD? | **Có** — thiết kế lưu trữ phải tính trước |

---

## 2. Bộ file hiện có: đo được gì

Đã đọc ở mức nhị phân và đo biên độ xoay từng xương.

### Mật độ keyframe

Trung bình toàn cục gây hiểu nhầm vì 207 xương phần lớn là váy/tóc. Chỉ tính xương chính:

| Đoạn | Thời lượng | Xương có >2 keyframe |
|---|---|---|
| part 1 | 2.9s | 6 |
| part 2 | 6.9s | 18 |
| part 3 | 11.1s | 10 |
| part 4 | 14.3s | 43 |

### Biên độ chuyển động (tổng góc quét)

| Đoạn | Tay P/T | Khuỷu P/T | Chân IK | Dịch `センター` | Kết luận |
|---|---|---|---|---|---|
| part 1 | 41° / 41° | 0° | đứng yên | 0.70 | Yếu, chủ yếu quay đầu (181°) |
| **part 2** | **322° / 716°** | **460° / 473°** | đứng yên | 0.60 | **Múa tay thật, ngồi tại chỗ** |
| part 3 | 74° / 98° | 140° / 100° | 1162°, dịch 5.83 | **5.23** | Lên/xuống xe |
| part 4 | 201° / 123° | 0° / 420° | dịch 1.68 / 2.04 | **5.60** | Ngồi trên xe đang chạy |

### Kết luận về từng đoạn

- **part 2 — dùng được ngay.** Tay quét 716°, khuỷu 473° trong 7 giây là biên độ múa thật. Chân đứng yên vì nhân vật ngồi.
- **part 1 — yếu.** 41° ở tay, gần như chỉ quay đầu. Có thể dùng cho quà nhỏ nhất.
- **part 3, part 4 — có vấn đề.** `センター` dịch 5.2–5.6 đơn vị nghĩa là nhân vật **di chuyển trong không gian** cùng chiếc xe. Trên overlay không có xe, nhân vật sẽ trôi khỏi khung hình. Khử root motion xong thì phần "ngồi trên xe chạy" mất hết ý nghĩa.

`tutorial.png` xác nhận bối cảnh: hướng dẫn dùng *outside parent* gắn nhân vật lên Audi RS6. Đây là bộ dựng cảnh MV, trong đó part 2 tình cờ chứa đoạn múa tay dùng lại được.

### Việc cần làm

Nếu muốn 4 mức quà có 4 đoạn nhảy khác nhau, cần tìm thêm **2–3 đoạn VMD nữa** có múa thật và không phụ thuộc đạo cụ.

---

## 3. Blender: đã sẵn sàng, chạy bằng script

```
Blender 5.2.0 LTS                 ✅ chạy headless OK
bl_ext.user_default.mmd_tools     ✅ đã cài
bl_ext.blender_org.vrm            ✅ đã cài
```

Chạy `blender --background --python script.py` — **không thao tác chuột**. Script nằm trong repo, lặp lại được, đưa vào CI được nếu muốn.

### Script làm gì

1. Nạp model VRM của người dùng
2. Nạp VMD, ánh xạ xương MMD (tiếng Nhật) → xương VRM
3. **Khử root motion** — xoá dịch chuyển `センター` để nhân vật đứng yên tại chỗ
4. Nướng (bake) ra keyframe FK, giải sẵn IK chân
5. Xuất glTF animation hoặc `.vrma`
6. Render video xem trước để **nhìn** kết quả trước khi đưa lên sóng

Bước 6 quan trọng: mọi phân tích ở §2 là suy ra từ con số. Chỉ khi nhìn video mới biết đoạn nhảy có đẹp không.

### Rủi ro đã biết

- **mmd_tools trên Blender 5.2** — addon này bám sát API Blender, phiên bản 5.2 rất mới. Chưa kiểm chứng nó chạy được với script headless.
- **Không có PMX gốc.** Bộ file chỉ có `rs6.pmx` (xe) và `Beach Ball Colorable.pmx`, không có model Miku mà VMD dựng cho. Điều này ảnh hưởng cách retarget: không có bộ xương nguồn để so tư thế nghỉ, phải dựng bảng ánh xạ thủ công thay vì để Blender tự khớp.

---

## 4. Kiến trúc: đơn giản hơn hẳn bản trước

Vì mỗi đoạn nhảy chỉ 3–15 giây và được kích hoạt bởi quà, **nó chính là một động tác dài** — không phải một lớp nền chạy song song.

Nghĩa là:

> **`MotionQueue` không đổi một dòng.** Ưu tiên, hợp nhất, hoà trộn hai lớp, hàng đợi — tất cả đã đúng sẵn cho việc này. 18 test hiện có vẫn hợp lệ.

Bản kế hoạch trước đề xuất đổi "tư thế nghỉ" thành "lớp nền" để bài nhảy 2 phút chạy dưới các động tác quà. **Bỏ hẳn phần đó.** Không cần nữa.

### Thay đổi thật sự cần

| Thay đổi | Vị trí | Quy mô |
|---|---|---|
| Nguồn động tác thứ hai: phát `AnimationClip` thay vì hàm procedural | `lib/vrm/vrm-stage.ts` | Trung bình |
| `AvatarMotionKind` nhận thêm định danh clip ngoài | `packages/shared` | Nhỏ |
| Phát đoạn nhạc kèm đoạn nhảy | `lib/vrm/` + overlay | Trung bình |
| Bảng ánh xạ mức quà → đoạn nhảy | Config overlay STAGE | Nhỏ |

### Đồng bộ nhạc — vẫn cần, nhưng dễ hơn nhiều

Với đoạn 7 giây, độ trôi của `requestAnimationFrame` là vài mili-giây — không nhìn thấy được. Vấn đề trôi nhịp của bản kế hoạch trước **biến mất cùng với bài nhảy dài**.

Nhưng vẫn phải xử lý:
- **Độ trễ bắt đầu.** Âm thanh và hoạt hình phải khởi động cùng lúc. Trình duyệt chặn autoplay có tiếng, nên overlay cần một lần tương tác hoặc `muted` rồi bật tiếng.
- **Tải trước.** Đoạn nhạc phải nằm sẵn trong bộ nhớ trước khi quà đến; tải lúc quà đến là trễ nửa giây, thấy rõ.

### Quà đến dồn dập

`MotionQueue` đã xử lý sẵn:
- Cùng một đoạn nhảy đến trong 1200ms → gộp thành một lượt mạnh hơn, không xếp hàng
- Quà đắt hơn cắt ngang quà rẻ đang nhảy, có crossfade
- Hàng đợi tối đa 6, bỏ mục ưu tiên thấp nhất khi tràn

**Cần chốt:** một đoạn nhảy 14 giây có nên cho phép cắt ngang không? Nếu quà lớn đang nhảy dở mà quà lớn hơn đến, cắt giữa chừng có thể trông hỏng. Đề xuất: cho phép cắt, nhưng chỉ khi chênh lệch ưu tiên ≥ 3.

---

## 5. Giấy phép — vẫn là cổng chặn

`.vmd` **không có siêu dữ liệu giấy phép nhúng trong file**. Không dựng được cửa kiểm tự động như đã làm cho `.vrm` ở `POST /upload/vrm`. Người phải đọc readme.

Ba thứ kiểm riêng:

| Đối tượng | Câu hỏi |
|---|---|
| Motion data | Tác giả có cho dùng thương mại không? |
| "2 Phút Hơn" | Có quyền phát trên nền tảng thương mại không? |
| Nhân vật nguồn | VMD dựng cho `Tda式初音ミク`. Miku thuộc Crypton, Piapro License cấm thương mại |

Về điểm thứ ba, có một lập luận **có lợi**: motion không mang IP của nhân vật. Phát motion đó trên model của bạn thì phần IP Miku không bị kéo theo — chỉ còn điều khoản của tác giả motion. Nhưng đây là lập luận cần xác nhận, không phải kết luận chắc chắn.

**Cần từ bạn:** file readme đi kèm bộ motion. Nó ghi điều khoản của tác giả.

---

## 6. Lộ trình

### Giai đoạn 0 — Xác minh bằng mắt *(làm trước, rẻ nhất)*

- [ ] Viết script Blender headless: nạp VRM + VMD, khử root motion, render video xem trước
- [ ] Xem 4 đoạn trông thế nào trên model thật
- [ ] Quyết định giữ đoạn nào

**Đây là bước đầu tiên vì nó rẻ và nó có thể phủ định phần còn lại của kế hoạch.** Nếu part 2 nhìn không ra dáng nhảy, cả hướng VMD cần xem lại trước khi đầu tư thêm.

### Giai đoạn 1 — Xuất được một đoạn dùng được

- [ ] Bảng ánh xạ xương MMD → VRM, kèm bù chênh lệch tư thế nghỉ (A-pose → T-pose)
- [ ] Bake IK chân thành FK
- [ ] Xuất glTF/`.vrma`
- [ ] Kiểm dung lượng và số keyframe sau khi nướng

### Giai đoạn 2 — Phát trong studio

- [ ] Đường phát `AnimationClip` trong `vrm-stage.ts`, song song sampler procedural
- [ ] Bảng "Đoạn nhảy" trong studio: chọn, phát, xem
- [ ] Xác nhận spring bone (tóc, váy) không văng quá đà khi múa nhanh
- [ ] Đo p95 ở 1080×1920 với clip đang chạy

### Giai đoạn 3 — Kèm nhạc

- [ ] Cắt đoạn nhạc tương ứng từng đoạn nhảy
- [ ] Phát đồng thời, tải trước vào bộ nhớ
- [ ] Xử lý chính sách autoplay của trình duyệt trong OBS

### Giai đoạn 4 — Lên sóng

- [ ] Ánh xạ mức quà → đoạn nhảy, lưu trong config overlay STAGE
- [ ] Overlay tải trước clip + nhạc khi khởi động, không phải khi quà đến
- [ ] Kiểm hành vi khi quà dồn dập

### Giai đoạn 5 — Cho phép tải VMD lên *(đã chốt là có làm)*

Vì đã chốt làm, **thiết kế lưu trữ ở Giai đoạn 4 phải tính trước**:

- Không hardcode danh sách đoạn nhảy. Lưu thành bảng trong config overlay: `{ giftTier, clipUrl, audioUrl, durationMs, priority }`
- Dùng lại Supabase Storage như đã làm cho `.vrm` — thêm bucket `dance-clips`
- Endpoint `POST /upload/dance` nhận file đã nướng (glTF/`.vrma`), **không** nhận `.vmd` thô

Lý do không nhận `.vmd` thô: retarget lúc chạy cần giải IK và bù tư thế nghỉ trong trình duyệt — đắt và dễ sai. Nướng ngoại tuyến rồi tải lên file kết quả giữ được sự đơn giản của runtime.

**Hệ quả:** người dùng cần công cụ nướng. Có hai cách: script Blender chạy trên máy họ, hoặc một dịch vụ nướng phía máy chủ. Cách thứ hai đắt hơn nhiều (phải chạy Blender trên server).

**Giấy phép ở giai đoạn này không tự động hoá được** — sẽ phải là quy trình duyệt thủ công, khác hẳn cửa kiểm tự động của `.vrm`.

---

## 7. Rủi ro

| Rủi ro | Mức | Ghi chú |
|---|---|---|
| Chỉ có 1 đoạn (part 2) thật sự dùng được | **Cao** | Cần tìm thêm 2–3 đoạn VMD khác |
| Giấy phép motion cấm thương mại | **Cao** | Chưa có readme để kiểm |
| Bản quyền "2 Phút Hơn" trên nền tảng | **Cao** | Ngoài phạm vi kỹ thuật |
| mmd_tools không chạy trên Blender 5.2 headless | Trung bình | Chưa kiểm chứng |
| Không có PMX gốc để so tư thế nghỉ | Trung bình | Phải dựng bảng ánh xạ thủ công |
| Tỉ lệ cơ thể lệch → tay xuyên vào người | Trung bình | Motion dựng cho Miku, chạy trên model khác |
| Spring bone văng quá đà khi múa nhanh | Thấp | Chỉnh được bằng tham số |

### Điều chưa xác minh

- **Chưa nhìn thấy đoạn nhảy nào.** Toàn bộ §2 là suy ra từ số liệu keyframe và biên độ góc. Giai đoạn 0 tồn tại để sửa việc này.
- **Chưa chạy mmd_tools lần nào** trong dự án này.
- **Chưa đo hiệu năng** clip nướng trên model 22MB ở độ phân giải sân khấu.

---

## 8. Còn cần bạn quyết

1. **File readme của bộ motion** — mở khoá phần giấy phép
2. **Có tìm thêm đoạn VMD khác không**, hay chấp nhận 1–2 đoạn dùng được
3. **Đoạn nhảy dài có được cắt ngang không** (§4) — đề xuất: chỉ khi chênh ưu tiên ≥ 3

---

## Tham khảo

- [vrm-dance-viewer](https://github.com/JLChnToZ/vrm-dance-viewer)
- [Bảng đối chiếu xương VRM ↔ PMX](https://note.com/fantom1x/n/nca0bf10ce11f?hl=en)
- [retargeting-threejs](https://github.com/upf-gti/retargeting-threejs)
- [MikuMikuDance — điều khoản VPVP](https://grokipedia.com/page/MikuMikuDance)
