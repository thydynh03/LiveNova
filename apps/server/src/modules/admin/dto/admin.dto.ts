import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  NotEquals,
} from 'class-validator';

export class ListUsersQuery {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class AdjustCreditDto {
  /**
   * Positive adds, negative deducts.
   *
   * Zero is rejected rather than treated as a no-op: it would write an audit
   * entry describing a change that never happened, and `CreditLedger` has a
   * `delta <> 0` constraint that would reject it at the database anyway.
   */
  @IsInt()
  @NotEquals(0)
  amount!: number;

  /** Required. An unexplained balance change is what the audit log exists to prevent. */
  @IsString()
  @MaxLength(300)
  reason!: string;
}

export class SetSuspendedDto {
  @Type(() => Boolean)
  suspended!: boolean;
}
