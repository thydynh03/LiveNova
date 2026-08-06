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
import { randomBytes } from 'crypto';
import { ProviderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService, RefreshContext } from './session.service';
import { RegisterDto, ChangePasswordDto } from './dto/auth.dto';
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
  expiresAt: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly resetTokens = new Map<string, ResetTokenData>();
  private readonly env = loadEnv();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
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

  async register(dto: RegisterDto, ctx: RefreshContext = {}): Promise<TokenPair & { user: any }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('Email này đã được sử dụng');
    }

    const passwordHash = await this.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        displayName: dto.displayName,
        passwordHash,
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

    const tokens = await this.login(user.id, ctx);
    const { passwordHash: _, ...safeUser } = user;

    return {
      ...tokens,
      user: safeUser,
    };
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

  async forgotPassword(email: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // P0: Always return identical response shape for unknown emails to avoid account enumeration oracle.
    if (!user || !user.passwordHash || user.deletedAt) {
      return { success: true };
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = await argon2.hash(rawToken, { type: argon2.argon2id });
    const expiresAt = Date.now() + 15 * 60 * 1000;

    this.resetTokens.set(tokenHash, { userId: user.id, expiresAt });

    // Never return resetToken in API response body. Deliver out-of-band / log in dev.
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`[DEV ONLY] Password reset token for ${email}: ${rawToken}`);
    }

    return { success: true };
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<boolean> {
    let matchedHash: string | null = null;
    let matchedData: ResetTokenData | null = null;

    for (const [hash, data] of this.resetTokens.entries()) {
      if (data.expiresAt < Date.now()) {
        this.resetTokens.delete(hash);
        continue;
      }

      if (!matchedHash && (await argon2.verify(hash, rawToken))) {
        matchedHash = hash;
        matchedData = data;
      }
    }

    if (!matchedHash || !matchedData) {
      throw new BadRequestException('Token khôi phục không hợp lệ hoặc đã hết hạn');
    }

    const passwordHash = await this.hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: matchedData.userId },
      data: { passwordHash },
    });

    this.resetTokens.delete(matchedHash);

    await this.logoutEverywhere(matchedData.userId);

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

    // P3 fix: Revoke all sessions on password change to force re-authentication
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
