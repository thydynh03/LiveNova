import { Controller, Post, Body, Get, Req, Res, UnauthorizedException, BadRequestException, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { Response, Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService
  ) {}

  @Post('login')
  async login(@Body() body: Record<string, unknown>) {
    const email = body.email as string;
    const password = body.password as string;
    const user = await this.userService.findByEmail(email);
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    
    const valid = await this.authService.verifyPassword(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    
    return this.authService.generateTokens(user.id);
  }

  @Get('facebook/callback')
  async facebookCallback(@Req() _req: Request) {
    // Mock OAuth callback
    return { message: 'Facebook callback' };
  }

  @Get('google/callback')
  async googleCallback(@Req() _req: Request) {
    // Mock OAuth callback
    return { message: 'Google callback' };
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    if (!body.refreshToken) throw new BadRequestException('Refresh token missing');
    return this.authService.validateRefreshToken(body.refreshToken);
  }

  @Post('logout')
  async logout() {
    return { success: true };
  }

  @Get('redirect')
  redirect(@Query('path') path: string, @Res() res: Response) {
    // Validate redirect param is relative path only (audit §13.3 FR-005)
    if (!path || !path.startsWith('/') || path.startsWith('//')) {
      throw new BadRequestException('Invalid redirect path');
    }
    return res.redirect(path);
  }
}
