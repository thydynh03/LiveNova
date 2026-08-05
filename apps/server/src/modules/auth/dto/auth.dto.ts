import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty } from 'class-validator';

/**
 * H-01 — every endpoint takes a DTO *class*. TypeScript interfaces are erased at
 * compile time, so `ValidationPipe({ whitelist, forbidNonWhitelisted })` had no
 * metadata to work with and silently validated nothing.
 */

export class LoginDto {
  @IsEmail({}, { message: 'A valid email is required' })
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  refreshToken!: string;
}

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  refreshToken!: string;
}
