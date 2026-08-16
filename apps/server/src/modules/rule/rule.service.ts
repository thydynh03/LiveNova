import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import {
  RuleEvaluator,
  LiveEvent,
  LiveEventType,
  RuleActionType,
  Rule as SharedRule,
  RuleCondition,
  RuleAction,
  OVERLAY_DISPATCH_EVENT,
  OverlayDispatchEvent,
} from '@livenova/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RuleEngineService } from './rule-engine.service';
import { CreateRuleDto, UpdateRuleDto, TestRuleEventDto } from './dto/rule.dto';

@Injectable()
export class RuleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEngine: RuleEngineService,
    private readonly eventEmitter: EventEmitter2,
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
    const rules = await this.prisma.rule.findMany({
      where: { userId },
      orderBy: { priority: 'asc' },
    });

    for (const rule of rules) {
      if (rule.name.includes('Rồng') || rule.name.includes('dragon')) {
        let actions = rule.actions as any[];
        if (Array.isArray(actions) && actions.length > 0) {
          let updated = false;
          actions = actions.map((act) => {
            if (act.type === RuleActionType.MEDIA_POPUP && act.payload) {
              if (
                act.payload.url?.includes('giphy.gif') ||
                act.payload.url?.includes('dragon_phoenix.png') ||
                act.payload.mediaType === 'image'
              ) {
                updated = true;
                return {
                  ...act,
                  payload: {
                    ...act.payload,
                    mediaType: 'video',
                    url: 'http://localhost:3000/dragon_phoenix.mp4',
                  },
                };
              }
            }
            return act;
          });

          if (updated) {
            await this.prisma.rule.update({
              where: { id: rule.id },
              data: { actions: actions as unknown as Prisma.InputJsonValue },
            });
            rule.actions = actions as unknown as Prisma.JsonValue;
          }
        }
      }
    }

    return rules;
  }

  async duplicateRule(id: string, userId: string) {
    const existing = await this.prisma.rule.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Rule not found');

    this.ruleEngine.invalidateUser(userId);
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

    this.ruleEngine.invalidateUser(userId);

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

  private static readonly FALLBACK_PRESETS: Record<string, CreateRuleDto[]> = {
    'vs-battle-game': [
      {
        name: 'Đấu trường VS - Comment "1" → Ronaldo',
        enabled: true,
        priority: 0,
        conditions: {
          eventType: [LiveEventType.COMMENT],
          keywords: ['1'],
        },
        actions: [
          {
            type: RuleActionType.GAME_BATTLE_ACTION,
            payload: {
              character: 'ronaldo',
              bricks: 1,
              actionKey: 'comment_brick_ronaldo',
            },
          },
        ],
        continueMatching: false,
        cooldownMs: 0,
      },
      {
        name: 'Đấu trường VS - Comment "2" → Messi',
        enabled: true,
        priority: 0,
        conditions: {
          eventType: [LiveEventType.COMMENT],
          keywords: ['2'],
        },
        actions: [
          {
            type: RuleActionType.GAME_BATTLE_ACTION,
            payload: {
              character: 'messi',
              bricks: 1,
              actionKey: 'comment_brick_messi',
            },
          },
        ],
        continueMatching: false,
        cooldownMs: 0,
      },
      {
        name: 'Đấu trường VS - Ronaldo (Hoa Hồng)',
        enabled: true,
        priority: 1,
        conditions: { eventType: [LiveEventType.GIFT], giftName: 'Rose' },
        actions: [
          {
            type: RuleActionType.GAME_BATTLE_ACTION,
            payload: {
              character: 'ronaldo',
              bricks: 1,
              actionKey: 'rose_brick',
            },
          },
        ],
      },
      {
        name: 'Đấu trường VS - Messi (Galaxy)',
        enabled: true,
        priority: 1,
        conditions: { eventType: [LiveEventType.GIFT], giftName: 'Galaxy' },
        actions: [
          {
            type: RuleActionType.GAME_BATTLE_ACTION,
            payload: {
              character: 'messi',
              bricks: 5,
              actionKey: 'galaxy_brick',
            },
          },
        ],
      },
    ],

    'blackout-troll': [
      {
        name: 'Troll Che Màn Hình 5s',
        enabled: true,
        priority: 0,
        conditions: { eventType: [LiveEventType.GIFT], minCoinValue: 1 },
        actions: [
          {
            type: RuleActionType.MEDIA_POPUP,
            payload: {
              mediaType: 'blackout' as any,
              url: 'blackout',
              durationMs: 5000,
              position: 'center',
              caption: '🙈 MÀN HÌNH BỊ CHE 5s! Cảm ơn {sender} đã tặng {gift}!',
            },
          },
        ],
      },
    ],
    'rose-popup': [
      {
        name: 'Cảm ơn Hoa Hồng',
        enabled: true,
        priority: 1,
        conditions: { eventType: [LiveEventType.GIFT], giftName: 'Rose' },
        actions: [
          {
            type: RuleActionType.MEDIA_POPUP,
            payload: {
              mediaType: 'image',
              url: '/uploads/thanks-rose.gif',
              durationMs: 5000,
              position: 'center',
              caption: 'Cảm ơn {sender} đã tặng Hoa Hồng!',
            },
          },
        ],
      },
    ],
    'dragon-gift': [
      {
        name: 'Siêu quà',
        enabled: true,
        priority: 0,
        conditions: { eventType: [LiveEventType.GIFT], minCoinValue: 1000 },
        actions: [
          {
            type: RuleActionType.MEDIA_POPUP,
            payload: {
              mediaType: 'video',
              url: '/DogDonate.mp4',
              durationMs: 8000,
              position: 'center',
              caption: 'SIÊU VIP {sender} đã tặng {gift} ({coins} xu)!',
            },
          },
        ],
      },
    ],
  };

  /**
   * Áp một mẫu luật theo slug.
   */
  async applyPreset(userId: string, presetSlug: string) {
    let rules: CreateRuleDto[] = [];

    const template = await this.prisma.template.findFirst({
      where: { slug: presetSlug, published: true },
      select: { config: true },
    });

    if (template?.config) {
      const cfg = template.config as unknown as { rules?: CreateRuleDto[] };
      if (Array.isArray(cfg.rules)) {
        rules = cfg.rules;
      }
    }

    if (rules.length === 0 && RuleService.FALLBACK_PRESETS[presetSlug]) {
      rules = RuleService.FALLBACK_PRESETS[presetSlug];
    }

    if (rules.length === 0) {
      throw new NotFoundException(`Preset '${presetSlug}' not found`);
    }

    const created = [];
    for (const rule of rules) {
      created.push(await this.createRule(userId, rule));
    }
    // Trả về một luật khi preset chỉ có một, giữ đúng hình dạng cũ.
    return created.length === 1 ? created[0] : created;
  }
}
