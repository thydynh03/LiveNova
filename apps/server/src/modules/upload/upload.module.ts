import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { SupabaseStorageService } from './supabase-storage.service';
import { UploadController } from './upload.controller';

@Module({
  controllers: [UploadController],
  providers: [CloudinaryService, SupabaseStorageService],
  exports: [CloudinaryService, SupabaseStorageService],
})
export class UploadModule {}
