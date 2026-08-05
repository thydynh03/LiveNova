import {
  Controller,
  Get,
  Patch,
  Delete,
  UseGuards,
  Body,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { UserService } from './user.service';

class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  displayName?: string;

  @IsOptional()
  @IsIn(['vi', 'en'])
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  // IANA zone names only — this value drives the BR-06 quota reset boundary.
  @Matches(/^[A-Za-z]+\/[A-Za-z_+-]+(\/[A-Za-z_+-]+)?$|^UTC$/, {
    message: 'timezone must be a valid IANA identifier, e.g. Asia/Ho_Chi_Minh',
  })
  timezone?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getMe(@CurrentUserId() userId: string) {
    const user = await this.userService.findById(userId);
    if (!user || user.deletedAt) throw new NotFoundException('User not found');

    // Never return passwordHash — the previous version returned the whole row.
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }

  @Patch('me')
  async updateMe(@CurrentUserId() userId: string, @Body() dto: UpdateMeDto) {
    const user = await this.userService.update(userId, dto);
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  async deleteMe(@CurrentUserId() userId: string) {
    await this.userService.softDelete(userId);
    return { success: true, purgeAfterDays: 30 };
  }
}
