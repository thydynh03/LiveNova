import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { ProviderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService, RefreshContext } from './session.service';

export interface OAuthProfile {
  /** Stable, provider-issued subject id. NOT the email. */
  providerUserId: string;
  email?: string;
  /** Whether the provider asserts the email address is verified. */
  emailVerified?: boolean;
  displayName?: string;
  avatar?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * H-02 — resolve an OAuth login by (provider, providerUserId).
   *
   * The previous implementation looked the user up by email alone and ignored the
   * provider entirely, so anyone who could obtain an account at *any* provider
   * asserting a victim's email address inherited the victim's account. Email is
   * now only used to merge accounts when the provider explicitly vouches that it
   * is verified, and never to authenticate on its own.
   */
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

    // No identity yet. Only consider merging into an existing account when the
    // provider asserts the email is verified — otherwise create a fresh account.
    let user =
      profile.email && profile.emailVerified
        ? await this.prisma.user.findUnique({ where: { email: profile.email } })
        : null;

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          // Providers that withhold an email still need a unique placeholder.
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

  /** Issues a new access token plus a fresh refresh rotation family. */
  async login(userId: string, ctx: RefreshContext = {}): Promise<TokenPair> {
    const refresh = await this.sessionService.issue(userId, ctx);
    return {
      accessToken: this.signAccessToken(userId),
      refreshToken: refresh.token,
      expiresAt: refresh.expiresAt,
    };
  }

  /** C-06 — rotates the refresh token and detects replay of a consumed one. */
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
