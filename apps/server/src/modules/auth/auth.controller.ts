import { Controller, Post, Body, Get, Req, Res, UnauthorizedException, BadRequestException, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService
  ) {}

  @Post('login')
  async login(@Body() body: Record<string, any>) {
    const { email, password } = body;
    const user = await this.userService.findByEmail(email);
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');
    
    const valid = await this.authService.verifyPassword(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    
    return this.authService.generateTokens(user.id);
  }

  @Get('facebook/callback')
  async facebookCallback(@Req() req: any) {
    // Mock OAuth callback
    return { message: 'Facebook callback' };
  }

  @Get('google/callback')
  async googleCallback(@Req() req: any) {
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
  redirect(@Query('path') path: string, @Res() res: any) {
    // Validate redirect param is relative path only (audit §13.3 FR-005)
    if (!path || !path.startsWith('/') || path.startsWith('//')) {
      throw new BadRequestException('Invalid redirect path');
    }
    return res.redirect(path);
  }
}
