import { ApiError } from './api-client';

/**
 * Biến một lỗi bắt được thành câu người dùng đọc được.
 *
 * Có một chỗ duy nhất làm việc này để mọi màn hình nói giống nhau, và để không
 * ai lỡ tay đưa nguyên `err.stack` lên giao diện.
 */
export function describeError(err: unknown, fallback = 'Vui lòng thử lại sau ít phút.'): string {
  if (err instanceof ApiError) {
    // Thông điệp từ API đã là tiếng Việt và nói đúng việc — ưu tiên nó.
    return err.message || fallback;
  }

  // Lỗi mạng của `fetch` chỉ có message "Failed to fetch", vô nghĩa với người
  // dùng cuối, nên đổi thành câu nói rõ phải làm gì.
  if (err instanceof TypeError) {
    return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
  }

  return fallback;
}
