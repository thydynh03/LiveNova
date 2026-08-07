import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { AdjustCreditDto, ListUsersQuery, SetSuspendedDto } from './dto/admin.dto';

/**
 * Administration.
 *
 * Both guards, and `@Roles` on the class rather than per method: a new endpoint
 * added here is protected by default. Protecting method-by-method means the one
 * someone forgets is the one that leaks.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  listUsers(@Query() query: ListUsersQuery) {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUser(id);
  }

  @Patch('users/:id/suspended')
  setSuspended(
    @CurrentUserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetSuspendedDto,
  ) {
    return this.adminService.setSuspended(adminId, id, dto.suspended);
  }

  @Post('users/:id/credit')
  @HttpCode(HttpStatus.OK)
  adjustCredit(
    @CurrentUserId() adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustCreditDto,
  ) {
    return this.adminService.adjustCredit(adminId, id, dto);
  }

  @Get('audit-log')
  auditLog(@Query('limit') limit?: string) {
    return this.adminService.listAuditLog(limit ? Number(limit) : undefined);
  }
}
