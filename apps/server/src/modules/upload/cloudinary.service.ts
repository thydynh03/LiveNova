import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface UploadOptions {
  /**
   * `raw` giữ nguyên byte. Cần cho `.vrm`: dưới `auto` Cloudinary nhận ra đây
   * là mô hình 3D và có thể chuyển mã, mà nhiều giấy phép VRM ghi rõ
   * `modification: prohibited` — chưa kể three-vrm cần đúng file gốc.
   */
  resourceType?: 'auto' | 'raw' | 'image' | 'video';
  /** Đuôi tệp được phép khi rơi về lưu trên đĩa. */
  allowedExtensions?: string[];
  /** Đuôi dùng khi tên tệp gốc không có đuôi hợp lệ. */
  defaultExtension?: string;
  /** Thư mục con dưới `public/` khi lưu trên đĩa. */
  localFolder?: string;
  /**
   * Cấm rơi về lưu trên đĩa.
   *
   * Nhánh dự phòng ghi tệp vào `../web/public/` và trả về một đường dẫn **tương
   * đối**. Điều đó chỉ đúng khi máy chủ và web dùng chung ổ đĩa — tức là trên
   * máy lập trình. Khi web chạy ở Vercel còn API chạy nơi khác, đường dẫn ấy
   * được trình duyệt ghép vào tên miền của web và trả về 404, trong khi lệnh
   * tải lên vẫn báo thành công. Một liên kết chết kèm dấu tích xanh tệ hơn hẳn
   * một lỗi nói thẳng.
   */
  requireRemote?: boolean;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor() {
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      this.logger.log(`CloudinaryService initialized for cloud: ${cloudinary.config().cloud_name}`);
    } else {
      this.logger.log('Cloudinary credentials not set, fallback to local storage mode');
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder = 'livenova',
    options: UploadOptions = {},
  ): Promise<UploadApiResponse> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Vui lòng chọn tệp media để tải lên');
    }

    const resourceType = options.resourceType ?? 'auto';

    // Try Cloudinary if credentials present
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        return await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            // `.vrm` phải đi đường `raw`: dưới `auto` Cloudinary đoán đây là mô
            // hình 3D và có thể chuyển mã nó, mà giấy phép của nhiều mô hình
            // cấm sửa đổi — chưa kể three-vrm cần đúng byte gốc.
            { folder, resource_type: resourceType },
            (error, result) => {
              if (error) {
                this.logger.error(`Cloudinary upload error: ${error.message}`);
                return reject(error);
              }
              if (!result) {
                return reject(new Error('No response from Cloudinary'));
              }
              resolve(result);
            },
          );

          const stream = new Readable();
          stream.push(file.buffer);
          stream.push(null);
          stream.pipe(uploadStream);
        });
      } catch (err: any) {
        if (options.requireRemote) {
          // Rơi về đĩa ở đây sẽ tạo ra một URL 404 kèm thông báo thành công.
          throw new ServiceUnavailableException(
            `Không lưu được tệp lên kho lưu trữ đám mây (${err?.message ?? 'lỗi không rõ'}). ` +
              'Tệp chưa được lưu — hãy thử lại.',
          );
        }
        this.logger.warn(`Cloudinary upload failed (${err?.message}), falling back to local disk storage`);
      }
    }

    if (options.requireRemote) {
      throw new ServiceUnavailableException(
        'Máy chủ chưa cấu hình kho lưu trữ đám mây nên không nhận được tệp. ' +
          'Cần đặt CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY và CLOUDINARY_API_SECRET ' +
          'trong môi trường của máy chủ API.',
      );
    }

    // Local Disk Storage Fallback
    try {
      const allowedExts = options.allowedExtensions ?? [
        '.png',
        '.jpg',
        '.jpeg',
        '.webp',
        '.gif',
        '.svg',
        '.mp4',
        '.webm',
      ];
      const rawExt = path.extname(file.originalname || '').toLowerCase();
      const ext = allowedExts.includes(rawExt)
        ? rawExt
        : options.defaultExtension ??
          (file.mimetype.startsWith('video/') ? '.mp4' : '.png');

      const localFolder = options.localFolder ?? 'uploads';
      const safeFilename = `${uuidv4()}${ext}`;
      const targetDir = path.resolve(process.cwd(), `../web/public/${localFolder}`);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filePath = path.resolve(targetDir, safeFilename);
      if (!filePath.startsWith(targetDir)) {
        throw new BadRequestException('Path traversal security validation failed');
      }

      fs.writeFileSync(filePath, file.buffer);

      const localUrl = `/${localFolder}/${safeFilename}`;
      this.logger.log(`Local file saved successfully at: ${localUrl}`);

      return {
        secure_url: localUrl,
        public_id: safeFilename,
        format: ext.replace('.', ''),
        bytes: file.size,
      } as UploadApiResponse;
    } catch (localErr: any) {
      this.logger.error(`Local file save error: ${localErr?.message}`);
      throw new BadRequestException(`Tải tệp lên thất bại: ${localErr?.message}`);
    }
  }
}
