/**
 * Thu thập bằng chứng cho sàn nhảy.
 *
 * Chạy trên dev server đang bật ở cổng 3000. Chụp ảnh và đo lại đúng những con
 * số mà bản audit đã nêu — khung 9:16, độ phân giải render, ai đứng ở đâu, luật
 * quà. Kết quả ghi vào `evidence/`.
 *
 *   node scripts/disco-evidence.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.EVIDENCE_BASE ?? 'http://localhost:3000';
const OUT = path.resolve('evidence');

/** Đợi WebGL vẽ vài khung: chụp ngay khi tải xong sẽ ra sân khấu trống. */
const settle = (page, ms = 4500) => page.waitForTimeout(ms);

const results = [];
function record(id, title, data) {
  results.push({ id, title, data });
  console.log(`\n[${id}] ${title}`);
  console.log(JSON.stringify(data, null, 2));
}

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}` + (ok ? '' : ` — nhận ${JSON.stringify(actual)}, cần ${JSON.stringify(expected)}`));
  return ok;
}

const browser = await chromium.launch();

try {
  await mkdir(OUT, { recursive: true });

  // ───────────────────────────────────────────────────────────────────────────
  // E1 — Khung 9:16 cố định + độ phân giải render, ở đúng điều kiện OBS
  //      (deviceScaleFactor = 1) và với khung nguồn đặt SAI thành 16:9.
  // ───────────────────────────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/overlays/disco`, { waitUntil: 'networkidle' });
    await settle(page);

    const m = await page.evaluate(() => {
      const inner = document.querySelector('[data-testid="fixed-frame-inner"]');
      const c = document.querySelector('canvas');
      return {
        viewport: { w: innerWidth, h: innerHeight },
        devicePixelRatio,
        frameCssSize: inner ? { w: inner.style.width, h: inner.style.height } : null,
        frameTransform: inner ? inner.style.transform : null,
        canvasBackingStore: c ? { w: c.width, h: c.height } : null,
      };
    });

    record('E1', 'Khung cố định 9:16 + độ phân giải render khi Browser Source là 16:9', m);
    check('khung vẫn là 1080×1920 dù viewport 16:9', m.frameCssSize, { w: '1080px', h: '1920px' });
    check('canvas render đủ 1080×1920 dù devicePixelRatio = 1', m.canvasBackingStore, { w: 1080, h: 1920 });
    await page.screenshot({ path: path.join(OUT, 'E1-khung-tren-viewport-16x9.png') });
    await ctx.close();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // E2 — Khung 9:16 đúng chuẩn: đây là thứ khán giả TikTok nhìn thấy.
  // ───────────────────────────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/overlays/disco`, { waitUntil: 'networkidle' });
    await settle(page);

    const m = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return { canvasBackingStore: c ? { w: c.width, h: c.height } : null };
    });
    record('E2', 'Overlay ở khung dọc 9:16 đúng chuẩn (ảnh chính)', m);
    await page.screenshot({ path: path.join(OUT, 'E2-overlay-doc-9x16.png') });
    await ctx.close();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // E3 — Khung ngang qua ?ratio=16:9, cho người dùng OBS.
  // ───────────────────────────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/overlays/disco?ratio=16:9`, { waitUntil: 'networkidle' });
    await settle(page);

    const m = await page.evaluate(() => {
      const inner = document.querySelector('[data-testid="fixed-frame-inner"]');
      return { frameCssSize: { w: inner.style.width, h: inner.style.height } };
    });
    record('E3', 'Tham số ?ratio=16:9 đổi sang khung ngang', m);
    check('khung đổi thành 1920×1080', m.frameCssSize, { w: '1920px', h: '1080px' });
    await page.screenshot({ path: path.join(OUT, 'E3-khung-ngang-16x9.png') });
    await ctx.close();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // E4 — Nghiệp vụ: DJ giữ ghế, Top 3 lên bục, bảng quà không có DJ.
  //      Đọc thẳng trạng thái engine — pixel không nói được ai đang ở đâu.
  // ───────────────────────────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/lab/disco-rules`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="rules-report"]', { timeout: 20000 });

    const report = JSON.parse(
      await page.locator('[data-testid="rules-report"]').getAttribute('data-report'),
    );
    record('E4', 'Nghiệp vụ: ghế DJ, bục Top 3, luật quà', report);

    check('ghế DJ vẫn là DJ LiveNova sau khi khách tặng quà lớn', report.djAfterBigGift, 'bot_dj_livenova');
    check('người tặng quà lớn KHÔNG chiếm được ghế DJ', report.bigGifterIsDj, false);
    check('người tặng quà lớn đứng hạng 1 trên bục', report.podiumAfterBigGift[0], 'dai_gia');
    check('bục chứa tối đa 3 người', report.podiumSize, 3);
    check('DJ không có mặt trong bảng quà', report.djOnPodium, false);
    check('quà đắt có tên riêng không bị biến thành pháo hoa', report.rosaExpensive, 'ROSA_SPOTLIGHT');
    check('quà 1 xu tên lạ không bị biến thành hoa hồng', report.sodaOneCoin, 'GENERIC');
    check('comment "hey" là lệnh vào sàn', report.heyCommand, 'join');
    check('comment tán gẫu không tạo nhân vật', report.chatterCommand, null);

    // Đợi sân khấu vẽ xong rồi mới chụp: bảng số liệu có ngay, WebGL thì không.
    await settle(page, 5000);
    await page.screenshot({ path: path.join(OUT, 'E4-nghiep-vu.png'), fullPage: true });
    await page.locator('[data-testid="lab-stage"]').screenshot({ path: path.join(OUT, 'E5-buc-top3.png') });
    await ctx.close();
  }

  console.log('\n─────────────────────────────────────────');
  console.log(failures === 0 ? 'TẤT CẢ KIỂM TRA ĐỀU PASS' : `${failures} KIỂM TRA THẤT BẠI`);
  console.log('Ảnh và số liệu:', OUT);
  await writeFile(path.join(OUT, 'metrics.json'), JSON.stringify(results, null, 2), 'utf8');
} finally {
  await browser.close();
}

process.exit(failures === 0 ? 0 : 1);
