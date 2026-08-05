import {
  IsString,
  IsBoolean,
  IsInt,
  IsOptional,
  IsArray,
  IsEnum,
  IsNumber,
  Min,
  Max,
  MaxLength,
  MinLength,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LiveEventType, RuleActionType } from '@livenova/shared';

export class RuleConditionDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsEnum(LiveEventType, { each: true })
  eventType?: LiveEventType[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  giftName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minCoinValue?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxCoinValue?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  senderUsername?: string;
}

export class RuleActionDto {
  @IsEnum(RuleActionType)
  type!: RuleActionType;

  @IsOptional()
  payload?: Record<string, unknown>;
}

/**
 * C-07 — these DTOs are the allowlist.
 *
 * The controller used to hand `Record<string, unknown>` straight to
 * `prisma.rule.update()`, so a request body containing `userId` reassigned the
 * rule to another account. Only the fields declared here can ever reach Prisma.
 */
export class CreateRuleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  priority?: number;

  @ValidateNested()
  @Type(() => RuleConditionDto)
  conditions!: RuleConditionDto;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RuleActionDto)
  actions!: RuleActionDto[];

  @IsOptional()
  @IsBoolean()
  continueMatching?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3_600_000)
  cooldownMs?: number;
}

export class UpdateRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  priority?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => RuleConditionDto)
  conditions?: RuleConditionDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RuleActionDto)
  actions?: RuleActionDto[];

  @IsOptional()
  @IsBoolean()
  continueMatching?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3_600_000)
  cooldownMs?: number;
}

export class TestRuleEventDto {
  @IsEnum(LiveEventType)
  type!: LiveEventType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  giftName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  giftCoinValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  senderUsername?: string;
}
