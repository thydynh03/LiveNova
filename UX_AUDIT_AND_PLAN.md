# LiveNova — Audit UI/UX & Kế hoạch cải thiện

Ngày audit: 2026-08-15 · Nhánh: `master` @ `972f742`

## 0. Tình trạng sức khỏe hiện tại

| Kiểm tra | Kết quả |
|---|---|
| `tsc --noEmit` (web) | Sạch |
| `eslint .` (toàn repo) | Sạch |
| `jest` (web) | 23 suites / 210 tests — pass |

**Kết luận:** không có lỗi biên dịch hay test đỏ. Cảm giác "nhiều lỗi" và "khó dùng" đến từ
lỗi **runtime im lặng**, **logic bị nhân bản ở 2 nơi**, và **UI không có hệ thống**.
Đây là 3 nhóm nguyên nhân gốc, không phải 3 chục bug rời rạc.

---

## 1. Phát hiện (xếp theo mức độ ảnh hưởng)

### P0 — Lỗi thật, ảnh hưởng trực tiếp buổi live

**P0-1. Logic diễn giải sự kiện TikTok bị copy ở 2 file và đã lệch nhau**

Cùng một bộ luật (nhận diện `hey`/`1`/`join`, phân loại quà Rosa/Rose/TikTok/Pháo hoa)
tồn tại song song ở:
- `apps/web/app/(dashboard)/disco/page.tsx:164-276`
- `apps/web/app/overlays/disco/page.tsx:96-...`

Hai bản đã lệch nhau (ví dụ nhánh quà "TikTok" ở dashboard **không** gọi `broadcastSync`,
trong khi các nhánh khác có). Mọi lần sửa luật đều phải nhớ sửa 2 chỗ — đây là nguồn
"sửa xong vẫn còn lỗi" điển hình.

**P0-2. Overlay xử lý cùng một sự kiện hai lần**

Overlay disco vừa nghe socket (`useOverlaySocket` → `handleAction`), vừa nghe
`BroadcastChannel` (`liveAction` do dashboard gửi sang). Khi dashboard và overlay mở
trên **cùng một máy** (kịch bản phổ biến nhất: OBS + trình duyệt), một comment "hey"
sẽ kích hoạt `engine.join()` hai lần → dancer nhân đôi, camera giật.

**P0-3. `BroadcastChannel` không hoạt động qua tiến trình khác**

Đồng bộ nhạc / video DJ / camera đang đi hoàn toàn qua `BroadcastChannel`
(`disco/page.tsx:75-88`), mà API này chỉ hoạt động **trong cùng một trình duyệt, cùng
origin**. OBS Browser Source và TikTok Live Studio là tiến trình riêng → **mọi thao tác
đổi nhạc/video/camera trên dashboard không tới được overlay đang phát sóng.**
Đây gần như chắc chắn là "lỗi" mà bạn thấy khó tái hiện.

**P0-4. Lỗi bị nuốt im lặng — 22 chỗ `console.error` không có phản hồi UI**

Không có hệ thống toast/notification nào trong dự án. Các thao tác sau thất bại mà
người dùng **không thấy gì**:
- Copy link overlay (`handleCopyUrl` — `clipboard` không tồn tại trên HTTP non-secure)
- Lấy `publicToken` overlay (`loadToken` catch → im lặng, UI hiện link thiếu token)
- `POST /tiktok/channels/:id/connect` (`channels/page.tsx:82` — `.catch(() => undefined)`)

Người dùng bấm nút, không có gì xảy ra, và kết luận "app lỗi".

**P0-5. Auto-connect chạy lặp không kiểm soát**

`channels/page.tsx:79-86` gọi `/tiktok/channels/:id/connect` cho **mọi** kênh verified,
trong `useEffect` phụ thuộc `data` — mỗi lần `reload()` (kể cả khi chỉ chuyển tab, vì có
listener `visibilitychange`) lại bắn lại toàn bộ. Không debounce, không kiểm tra trạng
thái hiện tại, lỗi bị nuốt.

### P1 — Cản trở sử dụng

**P1-1. Không có bộ component UI**

`components/ui/` chỉ có `Icon.tsx` và `motion-primitives.tsx`. Không có `Button`,
`Input`, `Card`, `Field`, `Toast`, `Dialog`. Hệ quả: **hơn 1000 khối `style={{}}` viết tay**
(disco 122, admin 117, battle simulator 111, TeamBattleConfigEditor 108, RuleModal 90).
Mỗi nút có padding/bo góc/màu riêng, focus state không đồng nhất, không thể đổi theme
tập trung. Đây là nguyên nhân số một của cảm giác "chưa dễ dùng".

**P1-2. Trang Disco là một file 1886 dòng, cuộn dọc vô tận**

Toàn bộ: sân khấu 3D, cấu hình video DJ, nhạc, đạo diễn tự động, trình mô phỏng test,
link OBS — xếp chồng trong một cột. Không tab, không nhóm, không thứ tự ưu tiên. Người
dùng phải cuộn qua khu vực "test simulator" để tới thứ họ cần khi đang live.

**P1-3. Dashboard không responsive**

Sidebar `width: 236px` cố định (`Sidebar.tsx:56`), không có breakpoint layout nào
(`globals.css` chỉ có 3 `@media`, đều cho `prefers-*`, không có cái nào cho kích thước).
Trên laptop 13" hoặc tablet, khung nội dung `maxWidth: 1180px` + sidebar → bể layout.
Không có menu mobile.

**P1-4. Nhãn làm thay việc của help text**

Ví dụ thật: `🎵 Âm Nhạc Sàn Nhảy (Tự Động Đồng Bộ Lên Live Ngay Lập Tức)`,
`🔊 Đang Bật tiếng Video (YouTube)`. Emoji đang bị dùng như icon (dù dự án đã có
Phosphor Icons), nhãn dài, có ngoặc đơn giải thích → mắt không quét được.

**P1-5. Cấu hình chỉ nằm ở `localStorage`, không lưu server**

Nhạc, video DJ, cấu hình TTS lưu ở `localStorage` của đúng một trình duyệt. Đổi máy,
xóa cache, hay mở overlay ở máy khác → mất sạch. Đồng thời gây "split-brain": dashboard
nghĩ đang phát nhạc A, overlay đang phát nhạc B.

### P2 — Nợ kỹ thuật / trải nghiệm dài hạn

- **P2-1.** Không có luồng onboarding. Người dùng mới vào `/dashboard` với 0 kênh, không
  có hướng dẫn "liên kết TikTok → tạo overlay → copy link vào OBS".
- **P2-2.** Sidebar 10 mục ngang hàng, không nhóm (Vận hành / Nội dung / Hệ thống).
- **P2-3.** Luật quà dùng chuỗi `if/else if` với điều kiện chồng lấn:
  `giftCoins >= 100` nằm trong nhánh "Pháo Hoa Giấy" → **mọi quà đắt tiền đều thành
  pháo hoa**; `giftCoins === 1` nằm trong nhánh "Rose" → mọi quà 1 xu đều thành hoa hồng.
  Cần bảng cấu hình có độ ưu tiên rõ ràng, không phải if-chain.

---

## 2. Kế hoạch cải thiện

Thứ tự này cố ý: sửa nền móng trước, vì nếu làm UI trước thì P0-1/P0-3 sẽ khiến mọi
màn hình mới vẫn "lỗi".

### Giai đoạn 1 — Chặn chảy máu (ưu tiên cao nhất)

| # | Việc | File chính |
|---|---|---|
| 1.1 | Tách toàn bộ luật comment/quà ra `packages/shared/src/disco/event-rules.ts`, trả về một `DiscoAction` thuần dữ liệu. Dashboard và overlay cùng gọi một hàm. | `packages/shared` + 2 trang disco |
| 1.2 | Viết unit test cho bộ luật đó (mọi biến thể "hey/1/join/vào", từng loại quà, thứ tự ưu tiên). Đây là chỗ test có giá trị cao nhất trong dự án. | `event-rules.spec.ts` |
| 1.3 | Chọn **một** nguồn sự thật cho overlay: overlay chỉ nghe socket, dashboard **không** broadcast `liveAction` nữa. Xóa nhánh double-handling. | `overlays/disco/page.tsx` |
| 1.4 | Chuyển đồng bộ media (nhạc / video / camera) từ `BroadcastChannel` sang socket server (`OverlayAction`), giữ `BroadcastChannel` làm fallback nội bộ. Đây là fix cho lỗi "đổi nhạc không lên sóng". | `overlay.service.ts`, `use-overlay-socket.ts` |
| 1.5 | Thay `giftCoins >= 100` / `=== 1` bằng bảng luật có `priority` + `match` tường minh. | `event-rules.ts` |

### Giai đoạn 2 — Người dùng thấy được chuyện gì đang xảy ra

| # | Việc |
|---|---|
| 2.1 | Thêm `components/ui/Toast.tsx` + `ToastProvider` (thành công / lỗi / cảnh báo, tự ẩn, có `aria-live`). |
| 2.2 | Thay toàn bộ 22 `console.error` bằng toast có nội dung hành động được ("Không copy được — trình duyệt chặn clipboard trên HTTP. Bấm để chọn thủ công."). |
| 2.3 | `handleCopyUrl` có fallback `document.execCommand` + hiện ô input đã select sẵn khi clipboard API không dùng được. |
| 2.4 | Debounce + guard cho auto-connect kênh: chỉ gọi khi kênh chưa `connected`, và hiện trạng thái kết nối thật (đang kết nối / lỗi + lý do / đang nhận sự kiện) trên từng thẻ kênh. |
| 2.5 | Một chỉ báo trạng thái toàn cục ở TopBar: socket, kênh TikTok, overlay — xanh/vàng/đỏ, bấm vào ra chi tiết. |

### Giai đoạn 3 — Hệ thống UI

| # | Việc |
|---|---|
| 3.1 | Xây `components/ui/`: `Button` (variant primary/secondary/ghost/danger × size sm/md), `Input`, `Textarea`, `Select`, `Field` (label + hint + error), `Card`, `Badge`, `Dialog`, `Tabs`, `Switch`. Tất cả dùng token trong `globals.css`, có `:focus-visible` thống nhất. |
| 3.2 | Migrate theo thứ tự mật độ inline-style: `disco` → `admin` → `battle/simulator` → `TeamBattleConfigEditor` → `RuleModal`. Mỗi file một PR để review được. |
| 3.3 | Bỏ emoji trong nhãn, dùng Phosphor Icon. Rút nhãn còn ≤ 4 từ, phần giải thích đưa xuống `hint` của `Field`. |
| 3.4 | Thêm breakpoint layout: sidebar thu thành drawer < 1024px, grid nội dung 1 cột < 768px, `maxWidth` đổi sang `min(1180px, 100%)`. |

### Giai đoạn 4 — Cấu trúc lại màn hình Disco

Chia `disco/page.tsx` (1886 dòng) thành:

```
app/(dashboard)/disco/page.tsx        — chỉ layout + state top-level (~150 dòng)
components/disco/panels/StagePreview.tsx
components/disco/panels/MediaPanel.tsx      — video DJ + nhạc
components/disco/panels/DirectorPanel.tsx   — camera / auto-director
components/disco/panels/SimulatorPanel.tsx  — test (ẩn sau tab "Kiểm thử")
components/disco/panels/OutputPanel.tsx     — link OBS + trạng thái
components/disco/use-disco-controller.ts    — toàn bộ logic, không JSX
```

Bố cục mới: sân khấu 3D cố định bên trái (sticky), panel điều khiển dạng **tab** bên
phải. Tab "Kiểm thử" tách khỏi luồng vận hành để không bấm nhầm khi đang live.

### Giai đoạn 5 — Onboarding & thông tin kiến trúc

| # | Việc |
|---|---|
| 5.1 | Trạng thái rỗng có hướng dẫn: dashboard khi 0 kênh hiện checklist 3 bước (liên kết TikTok → chọn overlay → copy link vào OBS), mỗi bước có nút hành động. |
| 5.2 | Nhóm sidebar: **Vận hành** (Dashboard, Kênh, Disco, Battle) · **Nội dung** (Overlay, Luật, Mẫu, TTS) · **Tài khoản** (Thanh toán, Cài đặt). |
| 5.3 | Chuyển cấu hình disco/tts từ `localStorage` sang server (`/overlays/:id/config`), `localStorage` chỉ còn là cache khởi động nhanh. |

---

### Giai đoạn 6 — Sàn nhảy: khung hình cho TikTok Studio, chất lượng, và bố cục sân khấu

Nhóm việc này độc lập với 1–5, có thể làm song song.

#### 6.1 Khung hình sai và vỡ nét trong TikTok Live Studio (P0)

**Nguyên nhân gốc — hai lỗi cộng lại:**

1. Overlay đang render theo kích thước **của khung Browser Source**
   (`overlays/disco/page.tsx:212` dùng `100vw × 100vh`, và
   [DiscoThreeStage.tsx:27](apps/web/components/disco/DiscoThreeStage.tsx:27) đọc
   `container.clientWidth/clientHeight`). Không có tỉ lệ chuẩn nào được ép → khung mặc
   định của TikTok Studio là ngang, không khớp sàn nhảy dọc.
2. Khi kéo giãn source cho vừa, **TikTok Studio phóng to ảnh bitmap đã render**, chứ
   không yêu cầu trang render lại ở độ phân giải cao hơn. Cộng thêm
   [`setPixelRatio(Math.min(window.devicePixelRatio, 2))`](apps/web/components/disco/DiscoThreeStage.tsx:49)
   — trong OBS/TikTok Studio `devicePixelRatio` **luôn = 1** — nên canvas render đúng
   bằng kích thước CSS rồi bị phóng lên. Đó chính là hiện tượng mờ/rỗ trong ảnh chụp.

**Cách sửa:**

| # | Việc |
|---|---|
| 6.1.1 | Overlay render ở **khung cố định 1080×1920 (9:16)**, không phụ thuộc kích thước Browser Source. Dùng wrapper `width:1080px; height:1920px; transform: scale(...); transform-origin: top left` để fit vào viewport — canvas luôn render ở độ phân giải gốc, TikTok Studio chỉ việc đặt source đúng 1080×1920 và không cần kéo giãn. |
| 6.1.2 | Bỏ phụ thuộc `devicePixelRatio`: `renderer.setSize(1080, 1920, false)` + `setPixelRatio(1)` với backing store đúng 1080×1920. Thêm tham số `?quality=1\|1.5\|2` cho máy mạnh. |
| 6.1.3 | Thêm query param `?w=&h=` (mặc định `1080×1920`) và preset `?ratio=9:16\|16:9\|1:1` để dùng lại overlay cho OBS ngang. |
| 6.1.4 | `isPortrait` hiện suy ra từ `width < height` ([DiscoThreeStage.tsx:39](apps/web/components/disco/DiscoThreeStage.tsx:39)) và chỉ đổi FOV/vị trí camera bằng toán tử ba ngôi. Tách thành **2 preset camera riêng** (portrait / landscape) được tinh chỉnh độc lập — khung 9:16 hiện cắt mất hai bên sân khấu. |
| 6.1.5 | Trong trang Disco, thay ô "copy link" bằng khối hướng dẫn: link + kích thước cần đặt (1080×1920) + nút copy riêng cho từng con số, kèm cảnh báo "không kéo giãn source". |

#### 6.2 Lớp phủ làm mờ màn hình LED (P1)

Màn LED trung tâm ([DiscoThreeStage.tsx:225-242](apps/web/components/disco/DiscoThreeStage.tsx:225))
đang là `MeshBasicMaterial` với `opacity: 1` — video phát hết độ sáng, làm chữ và dancer
phía trước bị chìm (thấy rõ trong ảnh chụp).

- Thêm mesh phủ dùng **cùng `CylinderGeometry`** nhưng bán kính nhỏ hơn một chút (22.9)
  để nằm trước màn: `MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, side: THREE.BackSide, depthWrite: false })`.
- **Trường hợp YouTube:** khi có `ytId`, mesh màn LED bị gỡ khỏi scene và video là
  `<iframe>` DOM ([DiscoStageView.tsx:215](apps/web/components/disco/DiscoStageView.tsx:215)).
  Lớp phủ 3D không áp được — cần thêm một `div` phủ CSS `background: rgba(0,0,0,0.28)`,
  `pointer-events: none`, đặt đè lên iframe.
- Đưa độ mờ thành tham số điều chỉnh được (`ledDim`, khoảng 0–0.6, mặc định **0.28**),
  có slider trong panel Media của trang Disco.

#### 6.3 Xóa 2 bục VIP giữa sàn (P1)

Xóa khối "8. VIP Podiums"
([DiscoThreeStage.tsx:184-213](apps/web/components/disco/DiscoThreeStage.tsx:184)) —
`leftPodium`, `leftPodiumRing`, `rightPodium`, `rightPodiumRing`.

Kèm theo phải xóa logic đặt dancer lên hai bục đó trong vòng render
([DiscoThreeStage.tsx:1098-1110](apps/web/components/disco/DiscoThreeStage.tsx:1098)) —
nếu chỉ xóa hình mà quên logic, Top 2/Top 3 sẽ **lơ lửng giữa không trung**.

#### 6.4 Bục lớn dưới bàn DJ cho Top 3 (P1)

Toạ độ hiện có để căn: sân khấu DJ ở `z = -11.5`, bán kính 5.8/6.4, cao 1.3
(mặt bục ở `y = 1.3`); bàn DJ ở `(0, 1.72, -11.0)`.

Đề xuất bục mới — **thấp hơn bục DJ** để không che DJ:

```
Hình học : BoxGeometry(7.6, 0.55, 2.2)  (hoặc CylinderGeometry dẹt nếu muốn bo tròn)
Vị trí   : (0, 0.275, -8.6)   — ngay trước sân khấu DJ
3 chỗ đứng: x = -2.4 | 0 | +2.4,  z = -8.6,  y = 0.55
Viền neon : vàng #ffd700 (Top 1) · bạc #c0c8d8 (Top 2) · đồng #cd7f32 (Top 3)
```

Mỗi ô đứng có một vòng sáng riêng dưới chân + nhãn tên nổi phía trên, để khán giả biết
ai đang ở hạng nào.

#### 6.5 DJ cố định là DJ của LiveNova (P0 — thay đổi luật chơi)

Hiện `engine.promoteToDj(senderId, senderName, avatarUrl)` được gọi khi có quà lớn
([disco/page.tsx:230](apps/web/app/(dashboard)/disco/page.tsx:230)) và **đưa người xem
lên chiếm vị trí DJ**.

Đổi thành:

- Vị trí bàn DJ **luôn** là avatar DJ LiveNova cố định, không ai thay thế được.
- Đổi tên `promoteToDj` → `promoteToTop1`; người đứng đầu bảng quà giờ đứng ở **ô giữa
  của bục Top 3** (x = 0), không lên booth.
- Khối "Elevated Top 1 DJ Booth Position"
  ([DiscoThreeStage.tsx:1091-1096](apps/web/components/disco/DiscoThreeStage.tsx:1091))
  đổi toạ độ đích sang ô giữa bục mới.
- Camera `DJ_POV` giữ nguyên tên và thời lượng, nhưng ý nghĩa đổi: **nhìn từ DJ LiveNova
  xuống bục Top 3 và đám đông** — hợp lý hơn hiện tại và không cần sửa phía gọi.
- Lời thoại TTS đổi theo: "…đăng quang **TOP 1** đêm nay" thay vì "…trở thành TOP 1 DJ".

> Lưu ý phụ thuộc: 6.5 sửa cùng vùng code với **P0-1** (tách luật sự kiện ra
> `packages/shared`). Nên làm P0-1 trước, rồi 6.5 chỉ sửa ở một chỗ duy nhất thay vì hai.

---

## 3. Đề xuất thứ tự thực thi

Nếu chỉ làm được một việc: **Giai đoạn 1** — cụ thể là 1.1 + 1.3 + 1.4. Ba việc đó xóa
nguyên nhân gốc của phần lớn lỗi khó tái hiện, và làm mọi việc sau đó an toàn hơn.

Nếu muốn thấy khác biệt ngay về "dễ dùng": làm **2.1–2.3** ngay sau đó (chỉ ~1 ngày công,
nhưng biến "app im lặng" thành "app biết nói"), rồi mới tới Giai đoạn 3.

Giai đoạn 3 là việc nặng nhất về khối lượng nhưng rủi ro thấp nhất — nên làm dần, mỗi
lần một file, không cần dừng phát triển tính năng.

**Giai đoạn 6 chạy song song được** và không đụng vào 2–5. Trong đó **6.1 nên làm sớm
nhất trong nhóm** — chừng nào khung hình còn sai thì mọi chỉnh sửa thẩm mỹ ở 6.2–6.5 đều
bị đánh giá qua một bản render đã vỡ nét. Thứ tự đề xuất trong nhóm:
6.1 → 6.3 → 6.4 → 6.5 → 6.2 (6.3 và 6.4 phải đi liền nhau vì cùng đụng vị trí Top 2/3).
