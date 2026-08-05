import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RuleService {
  constructor(private readonly prisma: PrismaService) {}

  async createRule(userId: string, data: any) {
    return this.prisma.rule.create({
      data: {
        userId,
        name: data.name,
        conditions: data.conditions || [],
        actions: data.actions || [],
        priority: data.priority || 0,
        continueMatching: data.continueMatching || false,
        cooldownMs: data.cooldownMs || 0,
      },
    });
  }

  async getRules(userId: string) {
    return this.prisma.rule.findMany({
      where: { userId },
      orderBy: { priority: 'desc' },
    });
  }

  async updateRule(id: string, userId: string, data: any) {
    return this.prisma.rule.update({
      where: { id, userId },
      data,
    });
  }

  async deleteRule(id: string, userId: string) {
    return this.prisma.rule.delete({
      where: { id, userId },
    });
  }

  async testRuleDryRun(id: string, userId: string, eventData: any) {
    const rule = await this.prisma.rule.findUnique({ where: { id, userId } });
    if (!rule) throw new Error('Rule not found');
    
    // Mock evaluation logic (FR-034)
    return {
      match: true,
      actionsTriggered: rule.actions,
      latencyMs: 2,
    };
  }
}
