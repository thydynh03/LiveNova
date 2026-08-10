/**
 * Seed: the first admin, and the starter templates.
 *
 * Run by hand, never from the API:
 *
 *   ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm --filter @livenova/server seed
 *
 * There is deliberately no endpoint that grants ADMIN. If there were, it would
 * be the single most valuable thing to attack in the product — the account that
 * can read every user and move every balance. Bootstrapping it requires shell
 * access to the machine holding the database, which is the property we want.
 *
 * Idempotent: safe to re-run. Templates are matched on `slug`.
 */
import { PrismaClient, Role, TemplateKind, GameMode } from '@prisma/client';
// Rule JSON is compared by the shared evaluator, so it must use the shared
// enums ("gift"), not Prisma's ("GIFT"). They are different vocabularies for
// different layers and mixing them produces rules that silently never match.
import { LiveEventType, RuleActionType, StageEffectKind } from '@livenova/shared';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

/**
 * Public origin of the web app, for assets bundled with it.
 *
 * Derived the same way `env.publicWebUrl` does. A hard-coded localhost here is
 * what previously sent every production streamer's overlay to their own
 * machine, where nothing is listening.
 */
function publicWebUrl(): string {
  const explicit = process.env.PUBLIC_WEB_URL;
  const firstCors = (process.env.CORS_ORIGIN ?? '').split(',')[0]?.trim();
  return (explicit || firstCors || 'http://localhost:3000').replace(/\/$/, '');
}

async function seedAdmin(): Promise<string> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Cần ADMIN_EMAIL và ADMIN_PASSWORD để tạo tài khoản quản trị');
  }
  if (password.length < 12) {
    // This account can read every user and move every balance. The product's
    // own 8-character minimum is not enough for it.
    throw new Error('Mật khẩu quản trị phải ít nhất 12 ký tự');
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });

  if (existing) {
    if (existing.role !== Role.ADMIN) {
      await prisma.user.update({ where: { id: existing.id }, data: { role: Role.ADMIN } });
      console.log(`Đã nâng ${email} lên quyền quản trị`);
    } else {
      console.log(`${email} đã là quản trị — bỏ qua`);
    }
    return existing.id;
  }

  const user = await prisma.user.create({
    data: {
      email,
      displayName: 'Quản trị viên',
      role: Role.ADMIN,
      emailVerified: true,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    },
    select: { id: true },
  });

  console.log(`Đã tạo tài khoản quản trị: ${email}`);
  return user.id;
}

interface StarterTemplateDef {
  slug: string;
  kind?: TemplateKind;
  gameMode?: GameMode;
  name: string;
  description: string;
  config: Record<string, unknown>;
}

/**
 * The starter templates: Rule packs and interactive Game templates.
 */
function starterTemplates(assets: string): StarterTemplateDef[] {
  return [
    {
      slug: 'rose-popup',
      kind: TemplateKind.RULE_PACK,
      name: 'Cảm ơn khi được tặng Hoa Hồng',
      description: 'Hiện ảnh cảm ơn mỗi khi có người tặng Hoa Hồng.',
      config: {
        rules: [
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
                  url: `${assets}/fx/thanks-rose.gif`,
                  durationMs: 5000,
                  position: 'center',
                  caption: 'Cảm ơn {sender} đã tặng Hoa Hồng!',
                },
              },
            ],
          },
        ],
      },
    },
    {
      slug: 'dragon-gift',
      kind: TemplateKind.RULE_PACK,
      name: 'Hiệu ứng siêu quà (từ 1000 xu)',
      description: 'Chạy video hoành tráng khi có món quà lớn.',
      config: {
        rules: [
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
                  url: `${assets}/dragon_phoenix.mp4`,
                  durationMs: 8000,
                  position: 'center',
                  caption: 'SIÊU VIP {sender} đã tặng {gift} ({coins} xu)!',
                },
              },
            ],
          },
        ],
      },
    },
    {
      slug: 'comment-welcome',
      kind: TemplateKind.RULE_PACK,
      name: 'Tự động chào người bình luận',
      description: 'Đọc lời chào khi khán giả gõ "chào", "hi", "hello".',
      config: {
        rules: [
          {
            name: 'Chào khán giả',
            enabled: true,
            priority: 5,
            conditions: {
              eventType: [LiveEventType.COMMENT],
              keywords: ['chao', 'hi', 'hello', 'chào'],
            },
            actions: [
              {
                type: RuleActionType.TTS_READ,
                payload: { text: 'Xin chào {sender} đã đến với livestream!' },
              },
            ],
          },
        ],
      },
    },
    {
      slug: 'game-dragon-comment',
      kind: TemplateKind.RULE_PACK,
      name: 'Bình luận Gọi Rồng (Đấu trường Game)',
      description: 'Ai bình luận chữ "rồng" sẽ lập tức thả rồng vào Đấu trường Game.',
      config: {
        rules: [
          {
            name: 'Bình luận Gọi Rồng',
            enabled: true,
            priority: 2,
            conditions: {
              eventType: [LiveEventType.COMMENT],
              keywords: ['rồng', 'rong', 'dragon'],
            },
            actions: [
              {
                type: RuleActionType.GAME_BATTLE_ACTION,
                payload: { actionKey: 'dragon', teamKey: '' },
              },
            ],
          },
        ],
      },
    },
    {
      slug: 'game-meteor-like',
      kind: TemplateKind.RULE_PACK,
      name: 'Thả tim rơi Thiên Thạch (Đấu trường Game)',
      description: 'Mỗi mốc thả tim sẽ giáng Thiên Thạch xuống Đấu trường Game.',
      config: {
        rules: [
          {
            name: 'Thả tim giáng Thiên Thạch',
            enabled: true,
            priority: 3,
            conditions: { eventType: [LiveEventType.LIKE] },
            actions: [
              {
                type: RuleActionType.GAME_BATTLE_ACTION,
                payload: { actionKey: 'meteor', teamKey: '' },
              },
            ],
          },
        ],
      },
    },
    // Stage effects. Every one carries a cooldown: these fire off chat
    // keywords, and without one a single viewer repeating "khói" turns the
    // broadcast into a smoke machine nobody can see through.
    {
      slug: 'stage-smoke-comment',
      kind: TemplateKind.RULE_PACK,
      name: 'Khói sân khấu theo lệnh chat',
      description: 'Ai bình luận "khói" thì sân khấu bốc khói.',
      config: {
        rules: [
          {
            name: 'Khói sân khấu',
            enabled: true,
            priority: 4,
            cooldownMs: 5000,
            conditions: {
              eventType: [LiveEventType.COMMENT],
              keywords: ['khói', 'khoi', 'smoke'],
            },
            actions: [
              {
                type: RuleActionType.EFFECT,
                payload: { kind: StageEffectKind.SMOKE, durationMs: 4000, intensity: 0.6 },
              },
            ],
          },
        ],
      },
    },
    {
      slug: 'stage-fireworks-biggift',
      kind: TemplateKind.RULE_PACK,
      name: 'Pháo hoa khi có quà lớn',
      description: 'Quà từ 500 xu trở lên thì bắn pháo hoa kèm lời cảm ơn.',
      config: {
        rules: [
          {
            name: 'Pháo hoa quà lớn',
            enabled: true,
            priority: 4,
            cooldownMs: 5000,
            conditions: { eventType: [LiveEventType.GIFT], minCoinValue: 500 },
            actions: [
              {
                type: RuleActionType.EFFECT,
                payload: {
                  kind: StageEffectKind.FIREWORKS,
                  durationMs: 6000,
                  intensity: 0.8,
                  caption: 'Cảm ơn {sender} đã tặng {gift}!',
                },
              },
            ],
          },
        ],
      },
    },
    {
      slug: 'stage-confetti-gift',
      kind: TemplateKind.RULE_PACK,
      name: 'Kim tuyến chào mỗi món quà',
      description: 'Rắc kim tuyến mỗi khi có người tặng quà, dù nhỏ.',
      config: {
        rules: [
          {
            name: 'Kim tuyến chào quà',
            enabled: true,
            priority: 5,
            cooldownMs: 5000,
            conditions: { eventType: [LiveEventType.GIFT] },
            actions: [
              {
                type: RuleActionType.EFFECT,
                payload: { kind: StageEffectKind.CONFETTI, durationMs: 3000, intensity: 0.6 },
              },
            ],
          },
        ],
      },
    },
    {
      slug: 'stage-hype-comment',
      kind: TemplateKind.RULE_PACK,
      name: 'Hype theo lệnh chat',
      description: 'Ai bình luận "hype" hoặc "quẩy" thì sân khấu bùng lên.',
      config: {
        rules: [
          {
            name: 'Hype sân khấu',
            enabled: true,
            priority: 4,
            cooldownMs: 5000,
            conditions: {
              eventType: [LiveEventType.COMMENT],
              keywords: ['hype', 'quẩy', 'quay'],
            },
            actions: [
              {
                type: RuleActionType.EFFECT,
                // Intensity stays moderate: HYPE includes a flash, and the
                // frequency cap limits the rate but not how bright it gets.
                payload: { kind: StageEffectKind.HYPE, durationMs: 2500, intensity: 0.5 },
              },
            ],
          },
        ],
      },
    },
    {
      slug: 'stage-shake-comment',
      kind: TemplateKind.RULE_PACK,
      name: 'Rung màn hình theo lệnh chat',
      description: 'Ai bình luận "rung" thì cả khung hình rung lên.',
      config: {
        rules: [
          {
            name: 'Rung màn hình',
            enabled: true,
            priority: 4,
            cooldownMs: 5000,
            conditions: {
              eventType: [LiveEventType.COMMENT],
              keywords: ['rung', 'shake'],
            },
            actions: [
              {
                type: RuleActionType.EFFECT,
                payload: { kind: StageEffectKind.SHAKE, durationMs: 1500, intensity: 0.7 },
              },
            ],
          },
        ],
      },
    },
    {
      slug: 'stage-strobe-comment',
      kind: TemplateKind.RULE_PACK,
      name: 'Đèn nhấp nháy theo lệnh chat',
      description:
        'Ai bình luận "nhấp nháy" thì bật đèn sàn nhảy. Đã giới hạn tần số để an toàn cho người xem nhạy sáng.',
      config: {
        rules: [
          {
            name: 'Đèn nhấp nháy',
            enabled: true,
            priority: 4,
            // Longest cooldown of the set. The renderer caps the flash rate at
            // STAGE_EFFECT_LIMITS.MAX_FLASH_HZ, but back-to-back triggers would
            // still add up to a long unbroken stretch of flashing.
            cooldownMs: 15_000,
            conditions: {
              eventType: [LiveEventType.COMMENT],
              keywords: ['nhấp nháy', 'nhap nhay', 'strobe'],
            },
            actions: [
              {
                type: RuleActionType.EFFECT,
                payload: {
                  kind: StageEffectKind.STROBE,
                  durationMs: 2000,
                  intensity: 0.3,
                },
              },
            ],
          },
        ],
      },
    },
    {
      slug: 'cat-vs-dog-battle',
      kind: TemplateKind.GAME,
      gameMode: GameMode.TEAM_BATTLE,
      name: 'Đại chiến Vương quốc Mèo vs Chó',
      description: 'Sàn đấu tương tác 2 phe Mèo và Chó tính điểm theo quà tặng TikTok LIVE.',
      config: {
        teams: [
          {
            key: 'cat',
            name: 'Vương quốc Mèo',
            color: '#a78bfa',
            castleAsset: 'castle_cat',
            giftNames: ['Rose', 'Hoa hồng'],
          },
          {
            key: 'dog',
            name: 'Vương quốc Chó',
            color: '#60a5fa',
            castleAsset: 'castle_dog',
            giftNames: ['Finger Heart', 'Bắn tim'],
          },
        ],
        power: { like: 1, share: 3, follow: 10 },
        energy: { capacity: 30, refillPerSec: 0.5 },
        freeEventMaxAction: 'castle',
        actions: [
          { minPower: 1, key: 'soldier', asset: 'fx_soldier' },
          { minPower: 10, key: 'castle', asset: 'fx_castle' },
          { minPower: 50, key: 'bomb', asset: 'fx_bomb' },
          { minPower: 99, key: 'dragon', asset: 'fx_dragon' },
        ],
        battle: { durationSec: 1200, showTopDonors: 4 },
      },
    },
  ];
}

async function seedTemplates(adminId: string) {
  const assets = publicWebUrl();

  for (const template of starterTemplates(assets)) {
    const kind = template.kind ?? TemplateKind.RULE_PACK;
    const gameMode = template.gameMode ?? null;

    await prisma.template.upsert({
      where: { slug: template.slug },
      create: {
        slug: template.slug,
        kind,
        gameMode,
        name: template.name,
        description: template.description,
        config: template.config as any,
        published: true,
        createdById: adminId,
      },
      // Re-running picks up copy changes but does not un-publish anything an
      // admin deliberately hid.
      update: {
        name: template.name,
        description: template.description,
        config: template.config as any,
        gameMode,
      },
    });
    console.log(`Mẫu: ${template.slug} (${kind})`);
  }
}

async function main() {
  const adminId = await seedAdmin();
  await seedTemplates(adminId);
  console.log('\nSeed xong.');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
