import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

/**
 * Lưu tệp lớn lên Supabase Storage.
 *
 * Có mặt vì Cloudinary không phải chỗ đúng cho mô hình VRM: gói miễn phí chặn
 * tệp `raw` ở 10MB, trong khi một mô hình nhân vật thực tế nặng 15–25MB. Supabase
 * đã nằm sẵn trong hạ tầng của dự án, nên đây là nơi ít tốn kém nhất để đặt chúng.
 *
 * Gọi thẳng REST API thay vì thêm `@supabase/supabase-js`: cả việc này gói gọn
 * trong ba lệnh HTTP, còn Node 22 đã có `fetch` toàn cục. Một gói phụ thuộc nữa
 * cho ba lệnh gọi là cái giá không đáng trả.
 */

/** Tên bucket mặc định. Đổi được để môi trường thử không ghi đè lên production. */
const DEFAULT_BUCKET = 'vrm-models';

/**
 * Trần dung lượng đặt cho bucket lúc tạo, 50MB.
 *
 * Khớp với trần của endpoint tải lên. Đặt ở tầng bucket nữa để một đường đi khác
 * — ai đó gọi thẳng API bằng service role key — cũng không nạp được tệp lớn hơn.
 */
const BUCKET_FILE_SIZE_LIMIT = 50 * 1024 * 1024;

export interface SupabaseUploadResult {
  url: string;
  path: string;
  bytes: number;
}

export interface SupabaseUploadOptions {
  /** Thư mục con trong bucket, ví dụ `vrm`. */
  folder?: string;
  /** Đuôi tệp, kèm dấu chấm. */
  extension: string;
  contentType?: string;
  bucket?: string;
}

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  /** Đã bảo đảm bucket tồn tại rồi thì không hỏi lại ở mỗi lần tải lên. */
  private readonly ensuredBuckets = new Set<string>();

  private get url(): string | undefined {
    return process.env.SUPABASE_URL?.replace(/\/+$/, '');
  }

  /**
   * Chỉ dùng service role key, và chỉ ở phía máy chủ.
   *
   * Khoá này bỏ qua toàn bộ Row Level Security. Đặt nó sau tiền tố
   * `NEXT_PUBLIC_` sẽ nhúng thẳng một chiếc chìa vạn năng của cả cơ sở dữ liệu
   * vào gói JavaScript mà trình duyệt tải về.
   */
  private get key(): string | undefined {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  isConfigured(): boolean {
    return Boolean(this.url && this.key);
  }

  async upload(
    buffer: Buffer,
    options: SupabaseUploadOptions,
  ): Promise<SupabaseUploadResult> {
    const url = this.url;
    const key = this.key;
    if (!url || !key) {
      throw new ServiceUnavailableException(
        'Máy chủ chưa cấu hình Supabase Storage. Cần đặt SUPABASE_URL và ' +
          'SUPABASE_SERVICE_ROLE_KEY trong môi trường của máy chủ API.',
      );
    }

    const bucket = options.bucket ?? process.env.SUPABASE_VRM_BUCKET ?? DEFAULT_BUCKET;
    await this.ensureBucket(url, key, bucket);

    // Tên tệp ngẫu nhiên, không lấy theo tên người dùng đặt.
    //
    // Bucket là công khai, nên bất kỳ ai biết URL đều tải được. Giấy phép của
    // nhiều mô hình VRM cấm phát tán lại, vì vậy đường dẫn phải không đoán
    // được — chứ không phải một dãy tên tuần tự ai cũng duyệt qua được.
    const path = `${options.folder ? `${options.folder}/` : ''}${uuidv4()}${options.extension}`;

    const res = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        apikey: key,
        'content-type': options.contentType ?? 'application/octet-stream',
        // Tên đã ngẫu nhiên nên không bao giờ trùng; để `false` biến một va chạm
        // ngoài dự kiến thành lỗi thay vì âm thầm đè mất tệp của người khác.
        'x-upsert': 'false',
      },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      const detail = await this.readError(res);
      this.logger.error(`Supabase upload failed (${res.status}): ${detail}`);
      throw new ServiceUnavailableException(
        `Không lưu được tệp lên Supabase Storage (${res.status}: ${detail}). Tệp chưa được lưu.`,
      );
    }

    return {
      url: `${url}/storage/v1/object/public/${bucket}/${path}`,
      path,
      bytes: buffer.byteLength,
    };
  }

  /**
   * Tạo bucket nếu chưa có.
   *
   * Làm tự động thay vì bắt người vận hành bấm tay trong bảng điều khiển: một
   * bước cài đặt thủ công không ai nhắc sẽ bị bỏ quên, và biểu hiện của nó là
   * một lỗi tải lên khó hiểu ở đúng lúc người dùng đang cần dùng tính năng.
   *
   * Bucket để **công khai** vì OBS không có phiên đăng nhập. Dùng URL ký hạn sẽ
   * hết hạn giữa buổi phát và nhân vật biến mất khỏi sân khấu.
   */
  private async ensureBucket(url: string, key: string, bucket: string): Promise<void> {
    if (this.ensuredBuckets.has(bucket)) return;

    const headers = { authorization: `Bearer ${key}`, apikey: key };

    const existing = await fetch(`${url}/storage/v1/bucket/${bucket}`, { headers });
    if (existing.ok) {
      this.ensuredBuckets.add(bucket);
      return;
    }

    const created = await fetch(`${url}/storage/v1/bucket`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: bucket,
        name: bucket,
        public: true,
        file_size_limit: BUCKET_FILE_SIZE_LIMIT,
      }),
    });

    // 409 nghĩa là một tiến trình khác vừa tạo xong — kết quả mong muốn đã đạt,
    // nên đó không phải lỗi.
    if (created.ok || created.status === 409) {
      this.ensuredBuckets.add(bucket);
      return;
    }

    const detail = await this.readError(created);
    throw new ServiceUnavailableException(
      `Không tạo được bucket "${bucket}" trên Supabase Storage (${created.status}: ${detail}).`,
    );
  }

  /** Supabase trả JSON khi lỗi, nhưng proxy đứng trước nó thì không. */
  private async readError(res: Response): Promise<string> {
    const text = await res.text().catch(() => '');
    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string };
      return parsed.message ?? parsed.error ?? text.slice(0, 200);
    } catch {
      return text.slice(0, 200) || res.statusText;
    }
  }
}
