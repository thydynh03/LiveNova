import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  describeCommercialUse,
  isCommercialUseAllowed,
  parseVrmMeta,
  type VrmParseFailure,
} from '@livenova/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CloudinaryService } from './cloudinary.service';

/**
 * Trần dung lượng cho mô hình VRM.
 *
 * Mô hình nhân vật thực tế nằm quanh 15–25MB. Đặt ở 50MB để không chặn nhầm
 * mô hình chi tiết, nhưng vẫn là một trần — `FileInterceptor` giữ toàn bộ tệp
 * trong bộ nhớ, nên "không giới hạn" nghĩa là một yêu cầu duy nhất có thể hạ
 * tiến trình máy chủ.
 */
const MAX_VRM_BYTES = 50 * 1024 * 1024;

const VRM_PARSE_ERRORS: Record<VrmParseFailure, string> = {
  'not-glb': 'Tệp này không phải định dạng VRM. Hãy chọn tệp .vrm xuất từ VRoid Studio hoặc công cụ tương đương.',
  truncated: 'Tệp VRM bị cắt cụt hoặc hỏng. Hãy tải lại tệp gốc rồi thử lần nữa.',
  'bad-json': 'Không đọc được siêu dữ liệu bên trong tệp VRM.',
  'not-vrm': 'Đây là tệp glTF nhưng không chứa phần mở rộng VRM, nên không có thông tin nhân vật lẫn giấy phép.',
};

@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('image')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploadMedia(file);
  }

  @Post('media')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp hình ảnh hoặc video');
    }

    // Allow images and videos
    if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
      throw new BadRequestException('Chỉ chấp nhận các tệp hình ảnh (PNG, JPG, WEBP, GIF, SVG) hoặc Video (MP4, WEBM)');
    }

    // 100MB cap for media files
    if (file.size > 100 * 1024 * 1024) {
      throw new BadRequestException('Kích thước tệp vượt quá 100MB');
    }

    const result = await this.cloudinaryService.uploadFile(file, 'livenova/media');
    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
    };
  }

  /**
   * Nhận mô hình VRM cho nhân vật trên sân khấu.
   *
   * Cửa chặn giấy phép nằm ở đây chứ không phải ở trình duyệt. Mô hình VRM mang
   * điều khoản sử dụng *bên trong chính tệp*, và LiveNova là sản phẩm thương
   * mại: mô hình dùng để đo hiệu năng trong kho mã này ghi
   * `corporate_commercial_use=disallow` và đã phải chặn khỏi git bằng một dòng
   * `.gitignore` cùng một đoạn ghi chú — tức là bằng kỷ luật của con người. Kỷ
   * luật đó không sống sót qua một ô "chọn tệp" mở cho người dùng, nên máy phải
   * đọc và từ chối thay.
   *
   * Kiểm tra chạy trước khi lưu: một tệp bị từ chối không được để lại byte nào.
   */
  @Post('vrm')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_VRM_BYTES } }))
  async uploadVrm(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException('Vui lòng chọn tệp .vrm để tải lên');
    }

    if (file.size > MAX_VRM_BYTES) {
      throw new BadRequestException(
        `Tệp ${(file.size / 1024 / 1024).toFixed(1)}MB vượt quá giới hạn ${MAX_VRM_BYTES / 1024 / 1024}MB`,
      );
    }

    // Nhận diện bằng byte thật, không bằng đuôi tệp hay Content-Type: trình
    // duyệt gửi `application/octet-stream` cho `.vrm`, nên cả hai chỉ là lời
    // khai của phía tải lên.
    const parsed = parseVrmMeta(
      new Uint8Array(file.buffer.buffer, file.buffer.byteOffset, file.buffer.byteLength),
    );

    if (!parsed.ok) {
      throw new BadRequestException(VRM_PARSE_ERRORS[parsed.reason]);
    }

    if (!isCommercialUseAllowed(parsed.meta)) {
      throw new BadRequestException(
        `Không dùng được mô hình "${parsed.meta.name}": ${describeCommercialUse(
          parsed.meta.commercialUse,
        )}.`,
      );
    }

    const result = await this.cloudinaryService.uploadFile(file, 'livenova/vrm', {
      resourceType: 'raw',
      allowedExtensions: ['.vrm'],
      defaultExtension: '.vrm',
      localFolder: 'vrm',
      // Trên bản phát hành, web và API là hai máy khác nhau: nhánh lưu trên đĩa
      // ghi tệp vào ổ của API rồi trả về đường dẫn tương đối, trình duyệt ghép
      // nó vào tên miền của web và nhận 404 — trong khi giao diện vẫn báo tải
      // lên thành công. Ở môi trường phát triển thì hai bên dùng chung thư mục
      // `public/` nên nhánh đó chạy đúng và vẫn được giữ.
      requireRemote: process.env.NODE_ENV === 'production',
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      bytes: result.bytes ?? file.size,
      meta: parsed.meta,
    };
  }
}
