import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class RuleService {
  constructor(private readonly prisma: PrismaService) {}

  async createRule(userId: string, data: Record<string, unknown>) {
    return this.prisma.rule.create({
      data: {
        userId,
        name: (data.name as string) || 'New Rule',
        conditions: (data.conditions as Prisma.InputJsonValue) || {},
        actions: (data.actions as Prisma.InputJsonValue) || {},
        priority: (data.priority as number) || 0,
        continueMatching: (data.continueMatching as boolean) || false,
        cooldownMs: (data.cooldownMs as number) || 0,
      },
    });
  }

  async getRules(userId: string) {
    return this.prisma.rule.findMany({
      where: { userId },
      orderBy: { priority: 'asc' },
    });
  }

  async updateRule(id: string, _userId: string, data: Record<string, unknown>) {
    return this.prisma.rule.update({
      where: { id },
      data: data as Prisma.RuleUpdateInput,
    });
  }

  async deleteRule(id: string, _userId: string) {
    return this.prisma.rule.delete({
      where: { id },
    });
  }

  async testRuleDryRun(id: string, _userId: string, _eventData: Record<string, unknown>) {
    const rule = await this.prisma.rule.findUnique({ where: { id } });
    if (!rule) throw new Error('Rule not found');
    
    // Mock evaluation logic (FR-034)
    return {
      match: true,
      actionsTriggered: rule.actions,
      latencyMs: 2,
    };
  }
}
