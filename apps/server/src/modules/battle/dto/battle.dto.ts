import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class SimulateBattleEventDto {
  @IsString()
  @IsNotEmpty()
  sender!: string;

  @IsString()
  @IsNotEmpty()
  teamKey!: string;

  @IsString()
  @IsNotEmpty()
  eventType!: 'GIFT' | 'LIKE' | 'SHARE' | 'FOLLOW' | 'COMMENT';

  @IsString()
  @IsOptional()
  giftName?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  giftCount?: number;

  /**
   * Real coin value of the gift, when the caller knows it.
   *
   * The live path always does. Firepower used to be guessed from substrings in
   * the gift's name, so an unrecognised name scored 1 no matter how many coins
   * it cost — the most valuable gifts scored the least.
   */
  @IsNumber()
  @IsOptional()
  @Min(0)
  coinValue?: number;

  @IsString()
  @IsOptional()
  comment?: string;
}
