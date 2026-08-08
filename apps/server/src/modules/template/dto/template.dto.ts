import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { TemplateKind, GameMode } from '@prisma/client';

export class CreateTemplateDto {
  @IsEnum(TemplateKind)
  kind!: TemplateKind;

  @IsOptional()
  @IsEnum(GameMode)
  gameMode?: GameMode;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'] })
  thumbnailUrl?: string;

  /** Shape depends on `kind`; validated in the service against the shared schema. */
  @IsObject()
  config!: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  editableFields?: string[];
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'] })
  thumbnailUrl?: string;

  @IsOptional()
  @IsEnum(GameMode)
  gameMode?: GameMode;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  editableFields?: string[];
}

export class SetPublishedDto {
  @IsBoolean()
  published!: boolean;
}

export class CreateAssetDto {
  /** Logical key the config points at, e.g. "fx_dragon". */
  @IsString()
  @MaxLength(64)
  key!: string;

  @IsUrl({ protocols: ['http', 'https'] })
  url!: string;

  @IsString()
  @MaxLength(64)
  mediaType!: string;
}
