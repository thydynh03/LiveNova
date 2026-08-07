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
import { PrismaClient, Role, TemplateKind } from '@prisma/client';
// Rule JSON is compared by the shared evaluator, so it must use the shared
// enums ("gift"), not Prisma's ("GIFT"). They are different vocabularies for
// different layers and mixing them produces rules that silently never match.
import { LiveEventType, RuleActionType } from '@livenova/shared';
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

/**
 * The three presets that used to live hard-coded in `RuleService.applyPreset`.
 *
 * They are data now, so an admin can change the wording or the gift name
 * without a deploy. `slug` keeps the old `POST /rules/presets/:slug` endpoint
 * working and makes re-running this script idempotent.
 */
function starterTemplates(assets: string) {
  return [
    {
      slug: 'rose-popup',
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
  ];
}

async function seedTemplates(adminId: string) {
  const assets = publicWebUrl();

  for (const template of starterTemplates(assets)) {
    await prisma.template.upsert({
      where: { slug: template.slug },
      create: {
        slug: template.slug,
        kind: TemplateKind.RULE_PACK,
        name: template.name,
        description: template.description,
        config: template.config,
        published: true,
        createdById: adminId,
      },
      // Re-running picks up copy changes but does not un-publish anything an
      // admin deliberately hid.
      update: {
        name: template.name,
        description: template.description,
        config: template.config,
      },
    });
    console.log(`Mẫu: ${template.slug}`);
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
