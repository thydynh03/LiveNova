import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TemplateKind, GameMode } from '@prisma/client';
import { TemplateService } from './template.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RuleService } from '../rule/rule.service';

function makePrisma() {
  return {
    template: {
      create: jest.fn(async (a: { data: unknown }) => a.data),
      update: jest.fn(async (a: { data: unknown }) => a.data),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    templateAsset: {
      upsert: jest.fn(async (a: { create: unknown }) => a.create),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    userTemplate: {
      create: jest.fn(async (a: { data: unknown }) => a.data),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

const battleConfig = () => ({
  teams: [
    { key: 'cat', name: 'Mèo', color: '#a78bfa', giftNames: ['Rose'] },
    { key: 'dog', name: 'Chó', color: '#60a5fa', giftNames: ['Finger Heart'] },
  ],
  power: { like: 1, share: 3, follow: 10 },
  energy: { capacity: 30, refillPerSec: 0.5 },
  freeEventMaxAction: 'castle',
  actions: [
    { minPower: 1, key: 'soldier' },
    { minPower: 10, key: 'castle' },
  ],
  battle: { durationSec: 1200, showTopDonors: 4 },
});

const rulePack = () => ({
  rules: [{ name: 'A', conditions: {}, actions: [{ type: 'tts_read', payload: {} }] }],
});

describe('TemplateService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let rules: { createRule: jest.Mock };
  let service: TemplateService;

  beforeEach(() => {
    prisma = makePrisma();
    rules = { createRule: jest.fn().mockResolvedValue({ id: 'r1' }) };
    service = new TemplateService(
      prisma as unknown as PrismaService,
      rules as unknown as RuleService,
    );
  });

  describe('config validation', () => {
    it('refuses a game template with no game mode', async () => {
      await expect(
        service.create('admin', {
          kind: TemplateKind.GAME,
          name: 'X',
          config: battleConfig(),
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a gift claimed by two teams', async () => {
      const config = battleConfig();
      config.teams[1].giftNames = ['Rose'];

      // Two teams claiming Rose makes scoring ambiguous, and the ambiguity
      // would only surface mid-broadcast.
      await expect(
        service.create('admin', {
          kind: TemplateKind.GAME,
          gameMode: GameMode.TEAM_BATTLE,
          name: 'X',
          config,
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a team with no gift, since nobody could ever join it', async () => {
      const config = battleConfig();
      config.teams[0].giftNames = [];

      await expect(
        service.create('admin', {
          kind: TemplateKind.GAME,
          gameMode: GameMode.TEAM_BATTLE,
          name: 'X',
          config,
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a freeEventMaxAction that is not in the action table', async () => {
      const config = battleConfig();
      config.freeEventMaxAction = 'meteor';

      await expect(
        service.create('admin', {
          kind: TemplateKind.GAME,
          gameMode: GameMode.TEAM_BATTLE,
          name: 'X',
          config,
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a valid battle config', async () => {
      await expect(
        service.create('admin', {
          kind: TemplateKind.GAME,
          gameMode: GameMode.TEAM_BATTLE,
          name: 'Kingdom War',
          config: battleConfig(),
        } as never),
      ).resolves.toBeDefined();
    });

    it('refuses an empty rule pack', async () => {
      await expect(
        service.create('admin', {
          kind: TemplateKind.RULE_PACK,
          name: 'X',
          config: { rules: [] },
        } as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('re-validates on publish, not only on create', async () => {
      const config = battleConfig();
      config.teams[1].giftNames = ['Rose'];
      prisma.template.findUnique.mockResolvedValue({
        kind: TemplateKind.GAME,
        gameMode: GameMode.TEAM_BATTLE,
        config,
      });

      // Publishing is the moment a template becomes visible to every streamer.
      await expect(service.setPublished('t1', true)).rejects.toThrow(BadRequestException);
    });

    it('does not re-validate on unpublish — hiding a broken one must work', async () => {
      const config = battleConfig();
      config.teams[1].giftNames = ['Rose'];
      prisma.template.findUnique.mockResolvedValue({
        kind: TemplateKind.GAME,
        gameMode: GameMode.TEAM_BATTLE,
        config,
      });

      await expect(service.setPublished('t1', false)).resolves.toBeDefined();
    });
  });

  describe('apply', () => {
    it('copies the config rather than referencing the source', async () => {
      const config = rulePack();
      prisma.template.findUnique.mockResolvedValue({
        id: 't1',
        kind: TemplateKind.RULE_PACK,
        published: true,
        name: 'Pack',
        config,
        assets: [],
      });

      const applied = (await service.apply('u1', 't1')) as unknown as {
        config: unknown;
        templateId: string;
      };

      // An admin editing the source at 9pm must not change the setup of someone
      // who applied it at 8:45 and is live now.
      expect(applied.config).toEqual(config);
      expect(applied.templateId).toBe('t1');
    });

    it('materialises the rules of a RULE_PACK', async () => {
      prisma.template.findUnique.mockResolvedValue({
        id: 't1',
        kind: TemplateKind.RULE_PACK,
        published: true,
        name: 'Pack',
        config: { rules: [{ name: 'A', conditions: {}, actions: [] }, { name: 'B', conditions: {}, actions: [] }] },
        assets: [],
      });

      await service.apply('u1', 't1');

      expect(rules.createRule).toHaveBeenCalledTimes(2);
    });

    it('creates no rules for a GAME template', async () => {
      prisma.template.findUnique.mockResolvedValue({
        id: 't1',
        kind: TemplateKind.GAME,
        published: true,
        name: 'War',
        config: battleConfig(),
        assets: [],
      });

      await service.apply('u1', 't1');

      expect(rules.createRule).not.toHaveBeenCalled();
    });

    it('refuses an unpublished draft', async () => {
      prisma.template.findUnique.mockResolvedValue({
        id: 't1',
        kind: TemplateKind.RULE_PACK,
        published: false,
        config: rulePack(),
        assets: [],
      });

      // Same answer as "does not exist", so a draft cannot be found by probing.
      await expect(service.apply('u1', 't1')).rejects.toThrow(NotFoundException);
      expect(prisma.userTemplate.create).not.toHaveBeenCalled();
    });
  });

  describe('listPublished', () => {
    it('never returns drafts', async () => {
      await service.listPublished();

      expect(prisma.template.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ published: true }) }),
      );
    });
  });

  describe('remove', () => {
    it('refuses while anyone is still using it', async () => {
      prisma.userTemplate.count.mockResolvedValue(3);

      await expect(service.remove('t1')).rejects.toThrow(BadRequestException);
      expect(prisma.template.deleteMany).not.toHaveBeenCalled();
    });

    it('deletes when nobody is using it', async () => {
      await expect(service.remove('t1')).resolves.toEqual({ success: true });
    });
  });

  describe('assets', () => {
    it('upserts so replacing a video does not need a delete first', async () => {
      prisma.template.findUnique.mockResolvedValue({ id: 't1' });

      await service.addAsset('t1', { key: 'fx_dragon', url: 'https://x/y.webm', mediaType: 'video/webm' });

      expect(prisma.templateAsset.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { templateId_key: { templateId: 't1', key: 'fx_dragon' } },
        }),
      );
    });
  });
});
