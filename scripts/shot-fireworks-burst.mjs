import { chromium } from 'playwright';

const out = new URL('../public/images/cos-design-v4/', import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.addInitScript(() => {
  localStorage.setItem('cos-design-locale', 'zh-CN');
  localStorage.setItem('i18nextLng', 'zh-CN');
});

const base = 'http://localhost:4000/?lang=zh-CN#/fireworks';

async function clickCanvasBurst() {
  // Prefer canvas; fall back to preview stage center
  const canvas = page.locator('canvas').first();
  if ((await canvas.count()) > 0) {
    const box = await canvas.boundingBox();
    if (box) {
      // click a few times for denser bursts
      for (const [dx, dy] of [
        [0.5, 0.45],
        [0.35, 0.55],
        [0.65, 0.4],
        [0.5, 0.6],
      ]) {
        await page.mouse.click(box.x + box.width * dx, box.y + box.height * dy);
        await page.waitForTimeout(120);
      }
      return;
    }
  }
  // fallback: click center of preview area
  const stage = page.locator('[class*="fillStage"], [class*="preview"], [class*="demo"]').first();
  const box = (await stage.boundingBox().catch(() => null)) ?? { x: 520, y: 280, width: 700, height: 420 };
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
  await page.waitForTimeout(100);
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.55);
  await page.waitForTimeout(100);
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.4);
}

async function shotFramework(tabName, file) {
  await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);

  if (tabName !== 'React') {
    const tab = page.locator('[role="tab"]', { hasText: tabName }).first();
    await tab.click();
    await page.waitForTimeout(2000);
  } else {
    // ensure React tab active
    const tab = page.locator('[role="tab"]', { hasText: 'React' }).first();
    if ((await tab.count()) > 0) await tab.click();
    await page.waitForTimeout(800);
  }

  // wait for canvas mount
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);

  await clickCanvasBurst();
  // fireworks peak shortly after click
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${out}${file}`, fullPage: false });
  console.log('saved', file, 'tab=', tabName);
}

await shotFramework('React', '03-fireworks-react.png');
await shotFramework('Vue', '04-fireworks-vue.png');
await shotFramework('Web Components', '05-fireworks-wc.png');
await shotFramework('Core', '05b-fireworks-core.png');

await browser.close();
console.log('done');
