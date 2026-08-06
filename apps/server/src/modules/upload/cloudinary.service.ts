import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'du1akwqrs',
      api_key: process.env.CLOUDINARY_API_KEY || '186125776682511',
      api_secret: process.env.CLOUDINARY_API_SECRET || 'uWAp9ZclxfIgXzmrPaPYJl8IIb4',
    });
    this.logger.log(`CloudinaryService initialized for cloud: ${cloudinary.config().cloud_name}`);
  }

  async uploadFile(file: Express.Multer.File, folder = 'livenova'): Promise<UploadApiResponse> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Vui lòng chọn tệp hình ảnh để tải lên');
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (error, result) => {
          if (error) {
            this.logger.error(`Cloudinary upload error: ${error.message}`);
            return reject(new BadRequestException(`Cloudinary upload error: ${error.message}`));
          }
          if (!result) {
            return reject(new BadRequestException('Không nhận được phản hồi từ Cloudinary'));
          }
          resolve(result);
        },
      );

      const stream = new Readable();
      stream.push(file.buffer);
      stream.push(null);
      stream.pipe(uploadStream);
    });
  }
}
