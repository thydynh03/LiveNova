import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';
import { RuleActionType } from '@livenova/shared';
import { RuleService } from './rule.service';
import { RuleEngineService } from './rule-engine.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resetEnvCache } from '../../common/config/env';

function makePrisma() {
  return {
    rule: {
      create: jest.fn(async (args: { data: Record<string, unknown> }) => args.data),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    template: { findFirst: jest.fn() },
  };
}

describe('RuleService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let engine: { invalidateUser: jest.Mock };
  let service: RuleService;

  function build() {
    resetEnvCache();
    prisma = makePrisma();
    engine = { invalidateUser: jest.fn() };
    return new RuleService(
      prisma as unknown as PrismaService,
      engine as unknown as RuleEngineService,
      new EventEmitter2(),
    );
  }

  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CORS_ORIGIN = 'https://livenova.vn';
    service = build();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetEnvCache();
  });

  describe('applyPreset', () => {
    /*
     * The three presets used to be hard-coded in rule.service.ts. They are now
     * RULE_PACK templates in the database, seeded rather than compiled, so an
     * admin can change them without a deploy. These tests moved with them: the
     * asset-URL concern now belongs to the seed (see prisma/seed.ts), and what
     * matters here is that the lookup is scoped and materialises real rules.
     */
    function seedTemplate(rules: unknown[]) {
      prisma.template.findFirst.mockResolvedValue({ config: { rules } });
    }

    it('materialises every rule in the pack', async () => {
      seedTemplate([
        { name: 'A', conditions: {}, actions: [{ type: RuleActionType.TTS_READ, payload: {} }] },
        { name: 'B', conditions: {}, actions: [{ type: RuleActionType.TTS_READ, payload: {} }] },
      ]);

      const created = (await service.applyPreset('user-1', 'welcome-pack')) as unknown[];

      expect(prisma.rule.create).toHaveBeenCalledTimes(2);
      expect(created).toHaveLength(2);
    });

    it('returns a single rule unwrapped, keeping the old response shape', async () => {
      seedTemplate([
        { name: 'A', conditions: {}, actions: [{ type: RuleActionType.TTS_READ, payload: {} }] },
      ]);

      const created = (await service.applyPreset('user-1', 'rose-popup')) as { name?: string };

      expect(Array.isArray(created)).toBe(false);
      expect(created.name).toBe('A');
    });

    it('only reads published templates', async () => {
      seedTemplate([{ name: 'A', conditions: {}, actions: [{ type: RuleActionType.TTS_READ, payload: {} }] }]);

      await service.applyPreset('user-1', 'rose-popup');

      // An unpublished draft is an admin's working state; a streamer applying
      // one would get a half-finished pack onto a live broadcast.
      expect(prisma.template.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'rose-popup', published: true },
        }),
      );
    });

    it('rejects an unknown preset slug', async () => {
      prisma.template.findFirst.mockResolvedValue(null);

      await expect(service.applyPreset('user-1', 'nope')).rejects.toThrow(NotFoundException);
      expect(prisma.rule.create).not.toHaveBeenCalled();
    });

    it('rejects a pack with no rules rather than silently doing nothing', async () => {
      seedTemplate([]);

      await expect(service.applyPreset('user-1', 'empty')).rejects.toThrow(NotFoundException);
    });

    it('drops the engine cache so a preset takes effect immediately', async () => {
      seedTemplate([
        { name: 'A', conditions: {}, actions: [{ type: RuleActionType.TTS_READ, payload: {} }] },
      ]);

      await service.applyPreset('user-1', 'rose-popup');

      expect(engine.invalidateUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('engine cache invalidation', () => {
    it('fires on every write path, not just create', async () => {
      prisma.rule.findFirst.mockResolvedValue({
        id: 'r1',
        userId: 'user-1',
        name: 'Gốc',
        priority: 0,
        conditions: {},
        actions: [{ type: RuleActionType.MEDIA_POPUP, payload: {} }],
        continueMatching: false,
        cooldownMs: 0,
      });

      await service.createRule('user-1', {
        name: 'A',
        conditions: {},
        actions: [],
      } as never);
      await service.updateRule('r1', 'user-1', { name: 'B' } as never);
      await service.duplicateRule('r1', 'user-1');
      await service.deleteRule('r1', 'user-1');

      // A rule edited mid-broadcast must not wait out the 30s cache TTL.
      expect(engine.invalidateUser).toHaveBeenCalledTimes(4);
    });
  });
});
