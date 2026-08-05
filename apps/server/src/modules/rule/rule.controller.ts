import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { RuleService } from './rule.service';
import { CreateRuleDto, UpdateRuleDto, TestRuleEventDto } from './dto/rule.dto';

@UseGuards(JwtAuthGuard)
@Controller('rules')
export class RuleController {
  constructor(private readonly ruleService: RuleService) {}

  @Get()
  async getRules(@CurrentUserId() userId: string) {
    return this.ruleService.getRules(userId);
  }

  @Post()
  async createRule(@CurrentUserId() userId: string, @Body() dto: CreateRuleDto) {
    return this.ruleService.createRule(userId, dto);
  }

  @Patch(':id')
  async updateRule(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRuleDto,
  ) {
    return this.ruleService.updateRule(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteRule(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ruleService.deleteRule(id, userId);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  async testRule(
    @CurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TestRuleEventDto,
  ) {
    return this.ruleService.testRuleDryRun(id, userId, dto);
  }
}
