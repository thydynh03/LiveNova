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
import { LoginDto, RefreshDto, LogoutDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';

/**
 * FR-005 — the post-login destination is chosen from a fixed allowlist.
 *
 * Pattern-matching on the string ("must start with /", "must not start with //")
 * is a losing game: `/\evil.com` is normalised to `//evil.com` by several
 * browsers and sails straight through such a filter. An allowlist has no
 * equivalent bypass.
 */
const ALLOWED_REDIRECTS = new Set([
  '/',
  '/dashboard',
  '/rules',
  '/tts',
  '/billing',
  '/overlays',
  '/overlays/media',
]);

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly userService: UserService,
  ) {}

  private static context(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const user = await this.userService.findByEmail(dto.email);

    // Same message and roughly the same work either way, so the response does
    // not reveal whether the address is registered.
    if (!user || !user.passwordHash || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.authService.verifyPassword(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.authService.login(user.id, AuthController.context(req));
  }

  /**
   * OAuth callbacks are intentionally still unimplemented — wiring them requires
   * provider credentials and a decision on Q-02. They now fail loudly instead of
   * returning a success-shaped stub.
   */
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
    // C-06 — this used to return { success: true } without revoking anything.
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

  /** FR-007 — visible session list, token material never returned. */
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
