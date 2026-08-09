import {
  Controller,
  Post,
  Body,
  Get,
  Delete,
  Param,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { UserService } from '../user/user.service';
import {
  LoginDto,
  RegisterDto,
  VerifyOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  RefreshDto,
  LogoutDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { TurnstileService } from '../../common/turnstile/turnstile.service';

const ALLOWED_REDIRECTS = new Set([
  '/',
  '/dashboard',
  '/rules',
  '/tts',
  '/billing',
  '/overlays',
  '/overlays/media',
  '/settings/profile',
]);

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly userService: UserService,
    private readonly turnstile: TurnstileService,
  ) {}

  /**
   * The visitor's address, for Turnstile's own risk signal.
   *
   * Behind Render and Cloudflare, `req.ip` is the proxy unless Express is told
   * to trust it, so the forwarded header is read first and only its leftmost
   * entry — the rest of that list is appended by intermediaries and is not the
   * client.
   */
  private static clientIp(req: Request): string | undefined {
    const forwarded = req.get('x-forwarded-for');
    const first = forwarded?.split(',')[0]?.trim();
    return first || req.ip || undefined;
  }

  private static context(req: Request, rememberMe?: boolean) {
    return {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
      rememberMe,
    };
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    await this.turnstile.assertHuman(dto.turnstileToken, AuthController.clientIp(req));
    return this.authService.register(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.authService.verifyOtp(dto.email, dto.code, dto.type || 'REGISTER', AuthController.context(req));
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto.email, dto.type || 'REGISTER');
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    // Before the password is even looked at: a bot spraying credentials should
    // not get to measure how long a lookup takes, and should not consume the
    // hashing work that a real comparison costs.
    await this.turnstile.assertHuman(dto.turnstileToken, AuthController.clientIp(req));

    const user = await this.userService.findByEmail(dto.email);

    if (!user || !user.passwordHash || user.deletedAt) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    const valid = await this.authService.verifyPassword(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    return this.authService.login(user.id, AuthController.context(req, dto.rememberMe));
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    // Unauthenticated and it sends mail, so an unprotected one is a way to have
    // this service deliver unwanted email to any address a bot supplies.
    await this.turnstile.assertHuman(dto.turnstileToken, AuthController.clientIp(req));
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const success = await this.authService.resetPassword(dto);
    return { success, message: 'Đặt lại mật khẩu thành công' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@CurrentUserId() userId: string, @Body() dto: ChangePasswordDto) {
    const success = await this.authService.changePassword(userId, dto);
    return { success, message: 'Đổi mật khẩu thành công' };
  }

  @Get('facebook/callback')
  facebookCallback(): never {
    throw new NotFoundException('Facebook OAuth is not configured yet');
  }

  @Get('google/callback')
  googleCallback(): never {
    throw new NotFoundException('Google OAuth is not configured yet');
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, AuthController.context(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: LogoutDto) {
    const revoked = await this.authService.logout(dto.refreshToken);
    return { success: revoked };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUserId() userId: string) {
    const count = await this.authService.logoutEverywhere(userId);
    return { success: true, revokedSessions: count };
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async sessions(@CurrentUserId() userId: string) {
    return { sessions: await this.sessionService.listActive(userId) };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  async revokeSession(@CurrentUserId() userId: string, @Param('id') id: string) {
    const revoked = await this.sessionService.revokeById(userId, id);
    if (!revoked) throw new NotFoundException('Session not found');
    return { success: true };
  }

  @Get('redirect')
  redirect(@Query('path') path: string, @Res() res: Response) {
    if (!path || !ALLOWED_REDIRECTS.has(path)) {
      throw new BadRequestException('Invalid redirect path');
    }
    return res.redirect(path);
  }
}
