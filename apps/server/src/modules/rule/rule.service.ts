import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  RuleEvaluator,
  LiveEvent,
  LiveEventType,
  Rule as SharedRule,
  RuleCondition,
  RuleAction,
} from '@livenova/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RuleEngineService } from './rule-engine.service';
import { CreateRuleDto, UpdateRuleDto, TestRuleEventDto } from './dto/rule.dto';

@Injectable()
export class RuleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEngine: RuleEngineService,
  ) {}

  async createRule(userId: string, dto: CreateRuleDto) {
    // The engine caches each user's rule set for the duration of a broadcast;
    // without this a rule edited mid-stream would not take effect for 30s.
    this.ruleEngine.invalidateUser(userId);
    return this.prisma.rule.create({
      data: {
        userId,
        name: dto.name,
        enabled: dto.enabled ?? true,
        priority: dto.priority ?? 0,
        conditions: dto.conditions as unknown as Prisma.InputJsonValue,
        actions: dto.actions as unknown as Prisma.InputJsonValue,
        continueMatching: dto.continueMatching ?? false,
        cooldownMs: dto.cooldownMs ?? 0,
      },
    });
  }

  async getRules(userId: string) {
    return this.prisma.rule.findMany({
      where: { userId },
      orderBy: { priority: 'asc' },
    });
  }

  /**
   * C-07 — ownership is part of the WHERE clause, not an unused parameter.
   *
   * The previous signature took `_userId` and filtered on `{ id }` alone, so any
   * authenticated user could mutate or delete any rule by id. Prisma 5's
   * extended `where` on update/delete lets us scope by owner directly, which is
   * what OverlayService was already doing correctly.
   */
  async updateRule(id: string, userId: string, dto: UpdateRuleDto) {
    const data: Prisma.RuleUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.continueMatching !== undefined) data.continueMatching = dto.continueMatching;
    if (dto.cooldownMs !== undefined) data.cooldownMs = dto.cooldownMs;
    if (dto.conditions !== undefined) {
      data.conditions = dto.conditions as unknown as Prisma.InputJsonValue;
    }
    if (dto.actions !== undefined) {
      data.actions = dto.actions as unknown as Prisma.InputJsonValue;
    }

    const result = await this.prisma.rule.updateMany({
      where: { id, userId },
      data,
    });

    if (result.count === 0) {
      throw new NotFoundException('Rule not found');
    }

    return this.prisma.rule.findUnique({ where: { id } });
  }

  async deleteRule(id: string, userId: string) {
    const result = await this.prisma.rule.deleteMany({ where: { id, userId } });
    this.ruleEngine.invalidateUser(userId);
    if (result.count === 0) {
      throw new NotFoundException('Rule not found');
    }
    return { success: true };
  }

  /**
   * FR-034 — dry-run against the real evaluator, never against a stub.
   *
   * This previously returned `{ match: true }` unconditionally, which made the
   * "test before you go live" affordance actively misleading.
   */
  async testRuleDryRun(id: string, userId: string, event: TestRuleEventDto) {
    const rule = await this.prisma.rule.findFirst({ where: { id, userId } });
    if (!rule) throw new NotFoundException('Rule not found');

    const sharedRule: SharedRule = {
      id: rule.id,
      userId: rule.userId,
      name: rule.name,
      enabled: rule.enabled,
      priority: rule.priority,
      conditions: rule.conditions as unknown as RuleCondition,
      actions: rule.actions as unknown as RuleAction[],
      continueMatching: rule.continueMatching,
      cooldownMs: rule.cooldownMs,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };

    const sampleEvent: LiveEvent = {
      id: 'dry-run',
      type: event.type ?? LiveEventType.COMMENT,
      channelId: 'dry-run',
      senderUsername: event.senderUsername ?? 'tester',
      senderDisplayName: event.senderUsername ?? 'Tester',
      content: event.content,
      giftName: event.giftName,
      giftCoinValue: event.giftCoinValue,
      occurredAt: new Date(),
    };

    const started = process.hrtime.bigint();
    // A fresh evaluator per dry-run so the cooldown map cannot leak state between
    // tests, or suppress a match because the rule fired for real moments ago.
    const results = new RuleEvaluator().evaluate(sampleEvent, [sharedRule]);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;

    const matched = results.length > 0;
    return {
      match: matched,
      actionsTriggered: matched ? results[0].actions : [],
      latencyMs: Number(elapsedMs.toFixed(3)),
      // No credits are consumed by a dry run — BR-05 / FR-034.
      creditsCharged: 0,
    };
  }
}
