import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

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

  async uploadFile(file: Express.Multer.File, folder = 'livenova'): Promise<UploadApiResponse> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Vui lòng chọn tệp media để tải lên');
    }

    // Try Cloudinary if credentials present
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        return await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder, resource_type: 'auto' },
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
      const ext = path.extname(file.originalname) || (file.mimetype.startsWith('video/') ? '.mp4' : '.png');
      const filename = `${uuidv4()}${ext}`;

      const targetDir = path.resolve(process.cwd(), '../web/public/uploads');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const filePath = path.join(targetDir, filename);
      fs.writeFileSync(filePath, file.buffer);

      const localUrl = `/uploads/${filename}`;
      this.logger.log(`Local file saved successfully at: ${localUrl}`);

      return {
        secure_url: localUrl,
        public_id: filename,
        format: ext.replace('.', ''),
        bytes: file.size,
      } as UploadApiResponse;
    } catch (localErr: any) {
      this.logger.error(`Local file save error: ${localErr?.message}`);
      throw new BadRequestException(`Tải tệp lên thất bại: ${localErr?.message}`);
    }
  }
}
