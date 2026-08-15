import { IsString, IsNumber, IsOptional, Min, Max, MaxLength, MinLength } from 'class-validator';

export class SynthesizeDto {
  @IsString()
  @MinLength(1)
  // Hard ceiling mirrors TTS_MAX_CHARS; the service re-checks against the
  // configured value so the two can never silently diverge.
  @MaxLength(500)
  text!: string;

  @IsString()
  @MaxLength(64)
  voice!: string;

  /** FR-020 — 0.5x to 2.0x. */
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  rate?: number;

  @IsOptional()
  @IsNumber()
  @Min(-20)
  @Max(20)
  pitch?: number;
}

export class PreviewDto extends SynthesizeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  declare text: string;
}

/**
 * Cập nhật cài đặt giọng đọc.
 *
 * Mọi trường tuỳ chọn: giao diện chỉ gửi thứ vừa đổi. Biên giá trị khớp với
 * `SynthesizeDto` để cài đặt lưu được không thể tạo ra một yêu cầu tổng hợp
 * không hợp lệ về sau.
 */
export class UpdateTtsSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  voiceId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(2.0)
  rate?: number;

  @IsOptional()
  @IsNumber()
  @Min(-20)
  @Max(20)
  pitch?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  volume?: number;
}
