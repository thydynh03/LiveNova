import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import {
  RuleEvaluator,
  LiveEvent,
  LiveEventType,
  Rule as SharedRule,
  RuleCondition,
  RuleAction,
  OVERLAY_DISPATCH_EVENT,
  OverlayDispatchEvent,
} from '@livenova/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRuleDto, UpdateRuleDto, TestRuleEventDto } from './dto/rule.dto';

@Injectable()
export class RuleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createRule(userId: string, dto: CreateRuleDto) {
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

  async duplicateRule(id: string, userId: string) {
    const existing = await this.prisma.rule.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Rule not found');

    return this.prisma.rule.create({
      data: {
        userId,
        name: `${existing.name} (Bản sao)`,
        enabled: false,
        priority: existing.priority + 1,
        conditions: existing.conditions as Prisma.InputJsonValue,
        actions: existing.actions as Prisma.InputJsonValue,
        continueMatching: existing.continueMatching,
        cooldownMs: existing.cooldownMs,
      },
    });
  }

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
    if (result.count === 0) {
      throw new NotFoundException('Rule not found');
    }
    return { success: true };
  }

  async testRuleDryRun(id: string, userId: string, event: TestRuleEventDto) {
    const rule = await this.prisma.rule.findFirst({ where: { id, userId } });
    if (!rule) throw new NotFoundException('Rule not found');

    const sharedRule: SharedRule = {
      id: rule.id,
      userId: rule.userId,
      name: rule.name,
      enabled: true, // Always test as enabled for dry-run
      priority: rule.priority,
      conditions: rule.conditions as unknown as RuleCondition,
      actions: rule.actions as unknown as RuleAction[],
      continueMatching: rule.continueMatching,
      cooldownMs: 0, // No cooldown for test
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };

    const sampleEvent: LiveEvent = {
      id: `dry-run-${Date.now()}`,
      type: event.type ?? LiveEventType.GIFT,
      channelId: 'dry-run',
      senderUsername: event.senderUsername || 'tester',
      senderDisplayName: event.senderUsername || 'Người chơi mẫu',
      content: event.content,
      giftName: event.giftName || 'Hoa Hồng',
      giftCoinValue: event.giftCoinValue || 1,
      occurredAt: new Date(),
    };

    const started = process.hrtime.bigint();
    const results = new RuleEvaluator().evaluate(sampleEvent, [sharedRule]);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;

    const matched = results.length > 0;

    // Dispatch match to real WebSockets overlay if matched so streamer can see visual popup on OBS overlay immediately
    if (matched && results[0].actions.length > 0) {
      for (const action of results[0].actions) {
        const payload: OverlayDispatchEvent = {
          userId,
          action: {
            id: `dry-run-act-${Date.now()}`,
            ruleId: rule.id,
            ruleName: rule.name,
            type: action.type,
            payload: action.payload,
            event: {
              type: sampleEvent.type,
              senderDisplayName: sampleEvent.senderDisplayName,
              giftName: sampleEvent.giftName,
              giftCoinValue: sampleEvent.giftCoinValue,
              content: sampleEvent.content,
            },
            createdAt: new Date().toISOString(),
          },
        };
        this.eventEmitter.emit(OVERLAY_DISPATCH_EVENT, payload);
      }
    }

    return {
      match: matched,
      actionsTriggered: matched ? results[0].actions : [],
      latencyMs: Number(elapsedMs.toFixed(3)),
      creditsCharged: 0,
    };
  }

  async applyPreset(userId: string, presetId: string) {
    const PRESETS: Record<string, CreateRuleDto> = {
      'rose-popup': {
        name: '🌹 Popup Video Cảm ơn Hoa Hồng',
        enabled: true,
        priority: 1,
        conditions: {
          eventType: [LiveEventType.GIFT],
          giftName: 'Rose',
        },
        actions: [
          {
            type: RuleActionType.MEDIA_POPUP,
            payload: {
              mediaType: 'image',
              url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500',
              durationMs: 5000,
              position: 'center',
              caption: 'Cảm ơn {sender} đã tặng Hoa Hồng! 🌹',
            },
          },
        ],
      },
      'dragon-gift': {
        name: '🐉 Popup Siêu Quà Tặng (Rồng/Lớn hơn 1000 Xu)',
        enabled: true,
        priority: 0,
        conditions: {
          eventType: [LiveEventType.GIFT],
          minCoinValue: 1000,
        },
        actions: [
          {
            type: RuleActionType.MEDIA_POPUP,
            payload: {
              mediaType: 'image',
              url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600',
              durationMs: 8000,
              position: 'center',
              caption: '💥 SIÊU VIP {sender} ĐÃ TẶNG {gift} ({coins} Xu)! 💥',
            },
          },
        ],
      },
      'comment-welcome': {
        name: '💬 Tự động chào khi comment "chao"',
        enabled: true,
        priority: 5,
        conditions: {
          eventType: [LiveEventType.COMMENT],
          keywords: ['chao', 'hi', 'hello', 'chào'],
        },
        actions: [
          {
            type: RuleActionType.TTS_READ,
            payload: {
              text: 'Xin chào {sender} đã đến với livestream!',
            },
          },
        ],
      },
    };

    const preset = PRESETS[presetId];
    if (!preset) {
      throw new NotFoundException(`Preset '${presetId}' not found`);
    }

    return this.createRule(userId, preset);
  }
}

