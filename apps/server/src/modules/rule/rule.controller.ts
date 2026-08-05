import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RuleService } from './rule.service';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { userId: string };
}

@UseGuards(JwtAuthGuard)
@Controller('rules')
export class RuleController {
  constructor(private readonly ruleService: RuleService) {}

  @Get()
  async getRules(@Req() req: AuthenticatedRequest) {
    return this.ruleService.getRules(req.user.userId);
  }

  @Post()
  async createRule(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.ruleService.createRule(req.user.userId, body);
  }

  @Patch(':id')
  async updateRule(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.ruleService.updateRule(id, req.user.userId, body);
  }

  @Delete(':id')
  async deleteRule(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.ruleService.deleteRule(id, req.user.userId);
  }

  @Post(':id/test')
  async testRule(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: { event?: Record<string, unknown> }) {
    return this.ruleService.testRuleDryRun(id, req.user.userId, body.event || {});
  }
}
