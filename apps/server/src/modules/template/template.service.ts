import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, TemplateKind, GameMode } from '@prisma/client';
import {
  RulePackConfig,
  TemplateRule,
  TEMPLATE_LIMITS,
  validateTeamBattleConfig,
} from '@livenova/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RuleService } from '../rule/rule.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  CreateAssetDto,
} from './dto/template.dto';

/** What a streamer is allowed to see about a template. Never `createdById`. */
const PUBLIC_TEMPLATE = {
  id: true,
  kind: true,
  gameMode: true,
  name: true,
  description: true,
  thumbnailUrl: true,
  config: true,
  editableFields: true,
  assets: { select: { key: true, url: true, mediaType: true } },
} satisfies Prisma.TemplateSelect;

@Injectable()
export class TemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleService: RuleService,
  ) {}

  // ── Admin side ────────────────────────────────────────────────────────────

  /**
   * Reject a config that cannot work before it reaches a broadcast.
   *
   * A template that looks saved and then does nothing on stream is the worst
   * outcome here: the streamer has no way to tell whether it is their setup or
   * the product. Every problem is returned at once so the editor can show them
   * together rather than one per save.
   */
  private assertConfigValid(kind: TemplateKind, gameMode: GameMode | null, config: unknown) {
    if (kind === TemplateKind.GAME) {
      if (gameMode !== GameMode.TEAM_BATTLE) {
        throw new BadRequestException('Template loại GAME phải chọn một chế độ chơi');
      }
      const problems = validateTeamBattleConfig(config);
      if (problems.length > 0) throw new BadRequestException(problems);
      return;
    }

    if (kind === TemplateKind.RULE_PACK) {
      const rules = (config as Partial<RulePackConfig> | null)?.rules;
      if (!Array.isArray(rules) || rules.length === 0) {
        throw new BadRequestException('Bộ luật phải có ít nhất một luật');
      }
      if (rules.length > TEMPLATE_LIMITS.MAX_RULES_PER_PACK) {
        throw new BadRequestException(`Tối đa ${TEMPLATE_LIMITS.MAX_RULES_PER_PACK} luật`);
      }
      for (const rule of rules) {
        if (!rule?.name || !Array.isArray(rule.actions) || rule.actions.length === 0) {
          throw new BadRequestException('Mỗi luật cần có tên và ít nhất một hành động');
        }
      }
    }
  }

  async create(adminId: string, dto: CreateTemplateDto) {
    this.assertConfigValid(dto.kind, dto.gameMode ?? null, dto.config);

    return this.prisma.template.create({
      data: {
        kind: dto.kind,
        gameMode: dto.gameMode ?? null,
        name: dto.name,
        description: dto.description,
        thumbnailUrl: dto.thumbnailUrl,
        config: dto.config as Prisma.InputJsonValue,
        editableFields: dto.editableFields ?? [],
        published: false,
        createdById: adminId,
      },
    });
  }

  async update(id: string, dto: UpdateTemplateDto) {
    const existing = await this.prisma.template.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy mẫu');

    if (dto.config !== undefined) {
      this.assertConfigValid(
        existing.kind,
        dto.gameMode ?? existing.gameMode,
        dto.config,
      );
    }

    const data: Prisma.TemplateUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.thumbnailUrl !== undefined) data.thumbnailUrl = dto.thumbnailUrl;
    if (dto.gameMode !== undefined) data.gameMode = dto.gameMode;
    if (dto.editableFields !== undefined) data.editableFields = dto.editableFields;
    if (dto.config !== undefined) data.config = dto.config as Prisma.InputJsonValue;

    return this.prisma.template.update({ where: { id }, data });
  }

  /**
   * Publishing re-validates.
   *
   * The config could have been written when the rules were laxer, or edited by
   * a path that skipped validation. Publishing is the moment it becomes visible
   * to every streamer, so it is the right place to check again.
   */
  async setPublished(id: string, published: boolean) {
    const template = await this.prisma.template.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Không tìm thấy mẫu');

    if (published) {
      this.assertConfigValid(template.kind, template.gameMode, template.config);
    }

    return this.prisma.template.update({ where: { id }, data: { published } });
  }

  async remove(id: string) {
    // `UserTemplate` holds a copy, so deleting the source does not break anyone
    // already using it — but the foreign key would refuse anyway. Unpublishing
    // is the operation an admin usually wants; deletion is for mistakes.
    const inUse = await this.prisma.userTemplate.count({ where: { templateId: id } });
    if (inUse > 0) {
      throw new BadRequestException(
        `${inUse} người đang dùng mẫu này. Hãy ẩn (unpublish) thay vì xoá.`,
      );
    }

    const result = await this.prisma.template.deleteMany({ where: { id } });
    if (result.count === 0) throw new NotFoundException('Không tìm thấy mẫu');
    return { success: true };
  }

  async listForAdmin() {
    return this.prisma.template.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        assets: { select: { id: true, key: true, url: true, mediaType: true } },
        _count: { select: { applied: true } },
      },
    });
  }

  async addAsset(templateId: string, dto: CreateAssetDto) {
    const exists = await this.prisma.template.findUnique({
      where: { id: templateId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Không tìm thấy mẫu');

    // Upsert rather than create: replacing "fx_dragon" with a better video is
    // the common operation, and forcing a delete first would leave the template
    // referencing a missing key in between.
    return this.prisma.templateAsset.upsert({
      where: { templateId_key: { templateId, key: dto.key } },
      create: { templateId, key: dto.key, url: dto.url, mediaType: dto.mediaType },
      update: { url: dto.url, mediaType: dto.mediaType },
    });
  }

  async removeAsset(templateId: string, key: string) {
    const result = await this.prisma.templateAsset.deleteMany({ where: { templateId, key } });
    if (result.count === 0) throw new NotFoundException('Không tìm thấy asset');
    return { success: true };
  }

  // ── Streamer side ─────────────────────────────────────────────────────────

  /** Only published templates. Drafts are an admin's working state. */
  async listPublished(kind?: TemplateKind) {
    return this.prisma.template.findMany({
      where: { published: true, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: 'desc' },
      select: PUBLIC_TEMPLATE,
    });
  }

  async listMine(userId: string) {
    return this.prisma.userTemplate.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { id: true, kind: true, gameMode: true, thumbnailUrl: true } },
      },
    });
  }

  /**
   * Apply a template to a streamer's account.
   *
   * The config is **copied**, not referenced. An admin editing the source at 9pm
   * must not change the setup of someone who applied it at 8:45 and is live now.
   *
   * A RULE_PACK also materialises its rules immediately, which is what the old
   * hard-coded `applyPreset` did — this is that path, generalised.
   */
  async apply(userId: string, templateId: string) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      include: { assets: true },
    });

    if (!template || !template.published) {
      // Same answer for "does not exist" and "not published" so an unpublished
      // draft cannot be discovered by probing ids.
      throw new NotFoundException('Không tìm thấy mẫu');
    }

    const applied = await this.prisma.userTemplate.create({
      data: {
        userId,
        templateId: template.id,
        name: template.name,
        config: template.config as Prisma.InputJsonValue,
      },
    });

    if (template.kind === TemplateKind.RULE_PACK) {
      const { rules } = template.config as unknown as RulePackConfig;
      for (const rule of rules) {
        await this.createRuleFromTemplate(userId, rule);
      }
    }

    return applied;
  }

  private async createRuleFromTemplate(userId: string, rule: TemplateRule) {
    return this.ruleService.createRule(userId, {
      name: rule.name,
      enabled: rule.enabled ?? true,
      priority: rule.priority ?? 0,
      cooldownMs: rule.cooldownMs ?? 0,
      continueMatching: rule.continueMatching ?? false,
      conditions: rule.conditions,
      actions: rule.actions,
    } as never);
  }

  async removeMine(userId: string, id: string) {
    const result = await this.prisma.userTemplate.deleteMany({ where: { id, userId } });
    if (result.count === 0) throw new NotFoundException('Không tìm thấy mẫu đã áp dụng');
    return { success: true };
  }
}
