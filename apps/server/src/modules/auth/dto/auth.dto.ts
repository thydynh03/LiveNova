import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty, IsBoolean, IsOptional, Matches } from 'class-validator';

/**
 * H-01 — every endpoint takes a DTO *class*. TypeScript interfaces are erased at
 * compile time, so `ValidationPipe({ whitelist, forbidNonWhitelisted })` had no
 * metadata to work with and silently validated nothing.
 */

export class RegisterDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(200)
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'Mật khẩu phải chứa ít nhất 1 chữ cái và 1 chữ số',
  })
  password!: string;

  @IsString()
  @MinLength(2, { message: 'Tên hiển thị tối thiểu 2 ký tự' })
  @MaxLength(60)
  displayName!: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'A valid email is required' })
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(320)
  email!: string;
}

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Mã OTP gồm 6 chữ số' })
  @MaxLength(6, { message: 'Mã OTP gồm 6 chữ số' })
  code!: string;

  @IsOptional()
  @IsString()
  type?: 'REGISTER' | 'FORGOT_PASSWORD';
}

export class ResendOtpDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsString()
  type?: 'REGISTER' | 'FORGOT_PASSWORD';
}

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Mã OTP gồm 6 chữ số' })
  @MaxLength(6, { message: 'Mã OTP gồm 6 chữ số' })
  code!: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới tối thiểu 8 ký tự' })
  @MaxLength(200)
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'Mật khẩu mới phải chứa ít nhất 1 chữ cái và 1 chữ số',
  })
  newPassword!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới tối thiểu 8 ký tự' })
  @MaxLength(200)
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'Mật khẩu mới phải chứa ít nhất 1 chữ cái và 1 chữ số',
  })
  newPassword!: string;
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
