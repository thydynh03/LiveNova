'use client';

/**
 * Hâm sẵn các video hiệu ứng trước khi có ai tặng quà.
 *
 * `image-cache.ts` nạp trước mọi thứ trong bộ media của mẫu bằng `new Image()`,
 * kể cả các URL `.mp4` và `.webm`. Với một video, thẻ ảnh đó tải hỏng và bị ghi
 * là `failed` — nghĩa là phần nạp trước không những không giúp gì, nó còn kết
 * luận sai rằng tệp hỏng.
 *
 * Nên video không hề được chuẩn bị. Tệp bắt đầu tải đúng vào lúc nó phải phát:
 * tải mạng, tách luồng, khởi tạo bộ giải mã, tất cả chen vào một khung hình —
 * và đó chính là cái khựng mà khán giả nhìn thấy ngay khoảnh khắc đáng lẽ phải
 * ấn tượng nhất.
 *
 * Bộ này giữ một thẻ `<video>` ẩn cho mỗi URL, đã tải xong và sẵn sàng phát.
 * Số lượng có giới hạn tự nhiên: một mẫu chỉ có vài kỹ năng.
 */

type Entry = {
  el: HTMLVideoElement;
  /** `true` khi trình duyệt nói nó phát được tới hết mà không phải dừng đợi. */
  ready: boolean;
};

const pool = new Map<string, Entry>();
let host: HTMLDivElement | null = null;

/**
 * Một video ngoài cây DOM có thể bị trình duyệt hoãn tải.
 *
 * Nên các thẻ hâm sẵn được gắn vào một hộp ẩn thật sự nằm trong trang. Ẩn bằng
 * `opacity: 0` và kích thước 1px chứ không phải `display: none`: với
 * `display: none` một số trình duyệt coi phần tử là không cần thiết và hạ mức
 * ưu tiên tải xuống, đúng thứ ta đang cố tránh.
 */
function ensureHost(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  if (host) return host;

  host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-9999px;top:0;';
  document.body.appendChild(host);
  return host;
}

/** URL trỏ tới một tệp video mà bộ này lo được. */
export function isVideoUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

/**
 * Bắt đầu tải trước danh sách video.
 *
 * Gọi khi overlay khởi động. Không trả về gì và không bao giờ ném lỗi: một tệp
 * hỏng chỉ đơn giản là không bao giờ sẵn sàng, và phần phát sẽ tự xoay xở.
 */
export function warmVideos(urls: (string | undefined)[]): void {
  const container = ensureHost();
  if (!container) return;

  for (const url of urls) {
    if (!isVideoUrl(url) || !url || pool.has(url)) continue;

    const el = document.createElement('video');
    el.src = url;
    el.preload = 'auto';
    // Tắt tiếng và `playsInline` để trình duyệt cho phép chuẩn bị mà không cần
    // một cú chạm của người dùng.
    el.muted = true;
    el.playsInline = true;
    el.crossOrigin = 'anonymous';

    const entry: Entry = { el, ready: false };
    // `canplaythrough` là mốc đúng, không phải `canplay`. `canplay` chỉ nói
    // "phát được vài khung"; nó sẽ khựng ngay giữa chừng khi bộ đệm cạn.
    el.addEventListener('canplaythrough', () => {
      entry.ready = true;
    });
    el.load();

    pool.set(url, entry);
    container.appendChild(el);
  }
}

/** Video đã hâm sẵn cho URL này, hoặc null nếu chưa từng gọi `warmVideos`. */
export function warmedVideo(url: string | undefined): HTMLVideoElement | null {
  if (!url) return null;
  return pool.get(url)?.el ?? null;
}

export function isWarm(url: string | undefined): boolean {
  if (!url) return false;
  return pool.get(url)?.ready === true;
}

/** Test seam. */
export function resetVideoPool(): void {
  pool.forEach(({ el }) => el.remove());
  pool.clear();
  host?.remove();
  host = null;
}
