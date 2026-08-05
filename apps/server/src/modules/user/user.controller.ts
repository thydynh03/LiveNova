import { Controller, Get, Patch, Delete, UseGuards, Req, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserService } from './user.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getMe(@Req() req: any) {
    return this.userService.findById(req.user.userId);
  }

  @Patch('me')
  async updateMe(@Req() req: any, @Body() body: any) {
    return this.userService.update(req.user.userId, body);
  }

  @Delete('me')
  async deleteMe(@Req() req: any) {
    return this.userService.softDelete(req.user.userId);
  }
}
