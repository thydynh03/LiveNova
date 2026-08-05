import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RuleService } from './rule.service';

@UseGuards(JwtAuthGuard)
@Controller('rules')
export class RuleController {
  constructor(private readonly ruleService: RuleService) {}

  @Get()
  async getRules(@Req() req: any) {
    return this.ruleService.getRules(req.user.userId);
  }

  @Post()
  async createRule(@Req() req: any, @Body() body: any) {
    return this.ruleService.createRule(req.user.userId, body);
  }

  @Patch(':id')
  async updateRule(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.ruleService.updateRule(id, req.user.userId, body);
  }

  @Delete(':id')
  async deleteRule(@Req() req: any, @Param('id') id: string) {
    return this.ruleService.deleteRule(id, req.user.userId);
  }

  @Post(':id/test')
  async testRule(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.ruleService.testRuleDryRun(id, req.user.userId, body.event);
  }
}
