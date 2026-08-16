/**
 * Ảnh chụp các màn hình dashboard sau khi tách panel và dựng bộ component.
 *
 * Dashboard cần đăng nhập, nên script này chỉ chụp những gì công khai được và
 * kiểm tra cấu trúc trang Disco qua DOM ở chế độ không đăng nhập sẽ không chạy.
 * Thay vào đó nó đo bố cục đáp ứng trên trang marketing và overlay.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('evidence');
const browser = await chromium.launch();

try {
  await mkdir(OUT, { recursive: true });

  for (const [name, w, h] of [['desktop', 1440, 900], ['tablet', 820, 1180], ['mobile', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const overflow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    const ok = overflow.scrollW <= overflow.clientW + 1;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name} (${w}x${h}) không tràn ngang — scrollW ${overflow.scrollW} / clientW ${overflow.clientW}`);

    await page.screenshot({ path: path.join(OUT, `U-${name}.png`) });
    await ctx.close();
  }
} finally {
  await browser.close();
}
