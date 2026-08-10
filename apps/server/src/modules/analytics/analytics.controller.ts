import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { SeoService } from './seo.service';
import { CollectEventDto } from './dto/analytics.dto';

/**
 * Đường ghi, công khai.
 *
 * Phải công khai: phần lớn lượt xem đến từ khách chưa đăng nhập, và đó chính là
 * nhóm cần đo. Đổi lại nó chỉ ghi được vào một bảng, không đọc được gì, và
 * `UserThrottlerGuard` chặn theo IP cho lưu lượng ẩn danh nên một script không
 * thể bơm số liệu vô hạn.
 */
@Controller('analytics')
export class AnalyticsCollectController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('collect')
  @HttpCode(HttpStatus.NO_CONTENT)
  async collect(
    @Body() dto: CollectEventDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    await this.analytics.collect(dto, userAgent);
  }
}

/** Đường đọc, chỉ quản trị viên. Cùng khuôn bảo vệ với `AdminController`. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/analytics')
export class AnalyticsAdminController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly seo: SeoService,
  ) {}

  @Get()
  report(@Query('days') days?: string) {
    const parsed = Number(days);
    // Chặn khoảng: 90 ngày đã là quét vài chục nghìn dòng, và một tham số vô
    // nghĩa từ thanh địa chỉ không được phép biến thành truy vấn toàn bảng.
    const window = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 90) : 7;
    return this.analytics.getReport(window);
  }

  @Get('seo')
  seoAudit() {
    return this.seo.audit();
  }
}
