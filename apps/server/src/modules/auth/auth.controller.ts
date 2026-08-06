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
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  RefreshDto,
  LogoutDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';

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
  ) {}

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
    return this.authService.register(dto, AuthController.context(req));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
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
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const success = await this.authService.resetPassword(dto.token, dto.newPassword);
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
