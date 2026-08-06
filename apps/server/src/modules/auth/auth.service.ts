import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, createHmac } from 'crypto';
import { ProviderType, OtpType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService, RefreshContext } from './session.service';
import { RegisterDto, ChangePasswordDto } from './dto/auth.dto';
import { EmailService } from '../email/email.service';
import { loadEnv } from '../../common/config/env';

export interface OAuthProfile {
  providerUserId: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
  avatar?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

interface ResetTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // O(1) keyed lookup map
  private readonly resetTokens = new Map<string, ResetTokenData>();
  private readonly env = loadEnv();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly emailService: EmailService,
  ) {}

  async validateOAuthUser(provider: ProviderType, profile: OAuthProfile) {
    if (!profile?.providerUserId) {
      throw new UnauthorizedException('OAuth provider did not return a subject id');
    }

    const existingIdentity = await this.prisma.identity.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: profile.providerUserId,
        },
      },
      include: { user: true },
    });

    if (existingIdentity) {
      return existingIdentity.user;
    }

    let user =
      profile.email && profile.emailVerified
        ? await this.prisma.user.findUnique({ where: { email: profile.email } })
        : null;

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email:
            profile.email ??
            `${provider.toLowerCase()}_${profile.providerUserId}@placeholder.local`,
          displayName: profile.displayName,
          avatar: profile.avatar,
        },
      });
    }

    await this.prisma.identity.create({
      data: {
        userId: user.id,
        provider,
        providerUserId: profile.providerUserId,
        emailVerified: profile.emailVerified ?? false,
      },
    });

    return user;
  }

  private signAccessToken(userId: string): string {
    return this.jwtService.sign({ sub: userId, type: 'access' });
  }

  private async generateAndSendOtp(email: string, type: 'REGISTER' | 'FORGOT_PASSWORD'): Promise<string> {
    // Generate 6-digit random OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate old OTPs for this email & type
    await this.prisma.otpCode.updateMany({
      where: { email, type: type as OtpType, used: false },
      data: { used: true },
    });

    await this.prisma.otpCode.create({
      data: {
        email,
        code,
        type: type as OtpType,
        expiresAt,
      },
    });

    await this.emailService.sendOtp(email, code, type);
    return code;
  }

  async register(dto: RegisterDto): Promise<{ pendingVerification: boolean; email: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing && !existing.deletedAt && existing.emailVerified) {
      throw new ConflictException('Email này đã được sử dụng');
    }

    const passwordHash = await this.hashPassword(dto.password);

    let user = existing;
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          displayName: dto.displayName,
          passwordHash,
          emailVerified: false,
        },
      });

      await this.prisma.creditBalance.create({
        data: {
          userId: user.id,
          balance: 100,
        },
      });

      await this.prisma.ttsSettings.create({
        data: {
          userId: user.id,
          voiceId: 'vi-VN-Wavenet-A',
          rate: 1.0,
          pitch: 0.0,
        },
      });
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          displayName: dto.displayName,
          passwordHash,
        },
      });
    }

    await this.generateAndSendOtp(dto.email, 'REGISTER');

    return {
      pendingVerification: true,
      email: dto.email,
    };
  }

  async verifyOtp(
    email: string,
    code: string,
    type: 'REGISTER' | 'FORGOT_PASSWORD' = 'REGISTER',
    ctx: RefreshContext = {},
  ): Promise<TokenPair & { user: any }> {
    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        email,
        type: type as OtpType,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord || otpRecord.code !== code) {
      if (otpRecord) {
        await this.prisma.otpCode.update({
          where: { id: otpRecord.id },
          data: { attempts: { increment: 1 } },
        });
      }
      throw new BadRequestException('Mã OTP không hợp lệ hoặc đã hết hạn');
    }

    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    if (!user.emailVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    const tokens = await this.login(user.id, ctx);
    const { passwordHash: _, ...safeUser } = user;

    return {
      ...tokens,
      user: { ...safeUser, emailVerified: true },
    };
  }

  async resendOtp(email: string, type: 'REGISTER' | 'FORGOT_PASSWORD' = 'REGISTER'): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('Email chưa được đăng ký');
    }

    await this.generateAndSendOtp(email, type);
    return { success: true, message: 'Đã gửi lại mã OTP thành công' };
  }

  async login(userId: string, ctx: RefreshContext = {}): Promise<TokenPair> {
    const refresh = await this.sessionService.issue(userId, ctx);
    return {
      accessToken: this.signAccessToken(userId),
      refreshToken: refresh.token,
      expiresAt: refresh.expiresAt,
    };
  }

  async refresh(presentedToken: string, ctx: RefreshContext = {}): Promise<TokenPair> {
    const { userId, refresh } = await this.sessionService.rotate(presentedToken, ctx);
    return {
      accessToken: this.signAccessToken(userId),
      refreshToken: refresh.token,
      expiresAt: refresh.expiresAt,
    };
  }

  async logout(presentedToken: string): Promise<boolean> {
    return this.sessionService.revokeByToken(presentedToken);
  }

  async logoutEverywhere(userId: string): Promise<number> {
    return this.sessionService.revokeAllForUser(userId);
  }

  private computeTokenKey(token: string): string {
    return createHmac('sha256', this.env.jwtRefreshSecret).update(token).digest('hex');
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash || user.deletedAt) {
      return { success: true, message: 'Nếu email tồn tại, mã OTP đã được gửi' };
    }

    await this.generateAndSendOtp(email, 'FORGOT_PASSWORD');

    return { success: true, message: 'Mã OTP khôi phục đã được gửi tới email của bạn' };
  }

  async resetPassword(dto: { email: string; code: string; newPassword: string }): Promise<boolean> {
    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        email: dto.email,
        type: 'FORGOT_PASSWORD',
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord || otpRecord.code !== dto.code) {
      throw new BadRequestException('Mã OTP không hợp lệ hoặc đã hết hạn');
    }

    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException('User không tồn tại');
    }

    const passwordHash = await this.hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, emailVerified: true },
    });

    await this.logoutEverywhere(user.id);

    return true;
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash || user.deletedAt) {
      throw new NotFoundException('User không tồn tại');
    }

    const isValid = await this.verifyPassword(user.passwordHash, dto.currentPassword);
    if (!isValid) {
      throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');
    }

    const passwordHash = await this.hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.logoutEverywhere(userId);

    return true;
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}
