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
    it('points bundled assets at the public web origin, not localhost', async () => {
      // Hard-coded http://localhost:3000 sent every production streamer's
      // overlay to their own machine, where nothing is listening.
      const rule = (await service.applyPreset('user-1', 'dragon-gift')) as unknown as {
        actions: { payload: { url: string } }[];
      };

      expect(rule.actions[0].payload.url).toBe('https://livenova.vn/dragon_phoenix.mp4');
    });

    it('does not leave a trailing slash doubled in the asset URL', async () => {
      process.env.CORS_ORIGIN = 'https://livenova.vn/';
      service = build();

      const rule = (await service.applyPreset('user-1', 'dragon-gift')) as unknown as {
        actions: { payload: { url: string } }[];
      };

      expect(rule.actions[0].payload.url).toBe('https://livenova.vn/dragon_phoenix.mp4');
    });

    it('rejects an unknown preset id', async () => {
      await expect(service.applyPreset('user-1', 'nope')).rejects.toThrow(NotFoundException);
    });

    it('drops the engine cache so a preset takes effect immediately', async () => {
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
