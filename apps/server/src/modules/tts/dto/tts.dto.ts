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
