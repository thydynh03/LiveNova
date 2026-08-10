import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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
        this.logger.warn(`Cloudinary upload failed (${err?.message}), falling back to local disk storage`);
      }
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
