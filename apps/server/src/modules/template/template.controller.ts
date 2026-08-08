import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Role, TemplateKind } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { TemplateService } from './template.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  SetPublishedDto,
  CreateAssetDto,
} from './dto/template.dto';

/**
 * Template authoring. Admin only — the whole point is that a streamer receives
 * a template rather than composing one.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/templates')
export class AdminTemplateController {
  constructor(private readonly templates: TemplateService) {}

  @Get()
  list() {
    return this.templates.listForAdmin();
  }

  @Post()
  create(@CurrentUserId() adminId: string, @Body() dto: CreateTemplateDto) {
    return this.templates.create(adminId, dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTemplateDto) {
    return this.templates.update(id, dto);
  }

  @Patch(':id/published')
  setPublished(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetPublishedDto) {
    return this.templates.setPublished(id, dto.published);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.templates.remove(id);
  }

  @Post(':id/assets')
  @HttpCode(HttpStatus.OK)
  addAsset(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateAssetDto) {
    return this.templates.addAsset(id, dto);
  }

  @Delete(':id/assets/:key')
  removeAsset(@Param('id', ParseUUIDPipe) id: string, @Param('key') key: string) {
    return this.templates.removeAsset(id, key);
  }
}

/** What a signed-in streamer can do: browse published templates and apply them. */
@UseGuards(JwtAuthGuard)
@Controller('templates')
export class TemplateController {
  constructor(private readonly templates: TemplateService) {}

  @Get()
  listPublished(@Query('kind') kind?: TemplateKind) {
    return this.templates.listPublished(kind);
  }

  @Get('mine')
  listMine(@CurrentUserId() userId: string) {
    return this.templates.listMine(userId);
  }

  @Post(':id/apply')
  @HttpCode(HttpStatus.OK)
  apply(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.templates.apply(userId, id);
  }

  @Delete('mine/:id')
  removeMine(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.templates.removeMine(userId, id);
  }
}
