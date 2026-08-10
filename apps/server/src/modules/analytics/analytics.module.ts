import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { SeoService } from './seo.service';
import {
  AnalyticsAdminController,
  AnalyticsCollectController,
} from './analytics.controller';

@Module({
  providers: [AnalyticsService, SeoService],
  controllers: [AnalyticsCollectController, AnalyticsAdminController],
})
export class AnalyticsModule {}
