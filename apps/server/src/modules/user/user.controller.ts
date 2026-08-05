import { Controller, Get, Patch, Delete, UseGuards, Req, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserService } from './user.service';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { userId: string };
}

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getMe(@Req() req: AuthenticatedRequest) {
    return this.userService.findById(req.user.userId);
  }

  @Patch('me')
  async updateMe(@Req() req: AuthenticatedRequest, @Body() body: Partial<{ displayName: string; locale: string; timezone: string }>) {
    return this.userService.update(req.user.userId, body);
  }

  @Delete('me')
  async deleteMe(@Req() req: AuthenticatedRequest) {
    return this.userService.softDelete(req.user.userId);
  }
}
