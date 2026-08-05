import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UserService } from '../user/user.service';
import { ProviderType } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService
  ) {}

  async validateOAuthUser(provider: ProviderType, profile: { id: string; email: string; displayName?: string; avatar?: string }) {
    let user = await this.userService.findByEmail(profile.email);
    if (!user) {
      user = await this.userService.create({
        email: profile.email,
        displayName: profile.displayName,
        avatar: profile.avatar,
      });
    }
    // Link identity logic here if needed
    return user;
  }

  generateTokens(userId: string) {
    const payload = { sub: userId };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }

  validateRefreshToken(token: string) {
    try {
      const decoded = this.jwtService.verify(token);
      return this.generateTokens(decoded.sub);
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }

  async verifyPassword(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}
