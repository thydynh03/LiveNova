/**
 * Chép văn bản vào clipboard, có đường lùi.
 *
 * `navigator.clipboard` chỉ tồn tại trong secure context. Người dùng chạy
 * LiveNova qua `http://` trên máy trong mạng LAN — chuyện thường gặp khi OBS và
 * dashboard ở hai máy — thì API đó là `undefined`, và bản cũ chỉ `console.error`
 * rồi im lặng. Người dùng bấm "Copy", không thấy gì, và tưởng nút hỏng.
 */
export type CopyResult = 'copied' | 'failed';

export async function copyText(text: string): Promise<CopyResult> {
  if (!text) return 'failed';

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      // Rơi xuống đường lùi bên dưới: quyền có thể bị từ chối ngay cả trong
      // secure context.
    }
  }

  if (typeof document === 'undefined') return 'failed';

  // `execCommand` đã lỗi thời nhưng vẫn là thứ duy nhất chạy được ngoài secure
  // context, và đó chính là trường hợp cần cứu ở đây.
  try {
    const area = document.createElement('textarea');
    area.value = text;
    // Đặt ngoài màn hình thay vì `display:none`: phần tử ẩn hẳn thì không select
    // được, nên lệnh copy sẽ không có gì để chép.
    area.style.position = 'fixed';
    area.style.top = '-9999px';
    area.setAttribute('readonly', '');
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok ? 'copied' : 'failed';
  } catch {
    return 'failed';
  }
}
