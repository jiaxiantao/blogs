import { chromium } from 'playwright';

const out = new URL('../public/images/cos-design-v4/', import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const base = 'http://localhost:4000/?lang=zh-CN';

async function ensureZh() {
  await page.addInitScript(() => {
    localStorage.setItem('cos-design-locale', 'zh-CN');
    localStorage.setItem('i18nextLng', 'zh-CN');
  });
}

await ensureZh();

async function shot(hash, file, waitMs = 2500) {
  await page.goto(`${base}${hash}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(800);
  // Prefer UI switch if still English
  const trigger = page.locator('button[aria-label*="语言"], button[aria-label*="Language"], .localeTrigger, [class*="localeTrigger"]').first();
  if (await trigger.count()) {
    const label = await trigger.innerText().catch(() => '');
    if (/English|en-US/i.test(label) || !/中文|zh/i.test(label)) {
      await trigger.click();
      const zh = page.locator('[role="listbox"] >> text=中文').or(page.locator('text=中文')).first();
      if (await zh.count()) {
        await zh.click();
        await page.waitForTimeout(600);
      }
    }
  }
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: `${out}${file}`, fullPage: false });
  console.log('saved', file, 'lang=', await page.locator('html').getAttribute('lang'));
}

await shot('#/', '01-home.png', 2200);
await shot('#/catalog', '02-catalog.png', 2200);
await shot('#/fireworks', '03-fireworks-react.png', 3200);

await page.goto(`${base}#/fireworks`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);
const tabs = page.locator('[role="tab"]');
const count = await tabs.count();
console.log('tabs', count);
for (let i = 0; i < count; i++) {
  console.log('tab', i, JSON.stringify(await tabs.nth(i).innerText()));
}
for (const name of ['Vue', 'Web Components', 'Core']) {
  const tab = page.locator('[role="tab"]', { hasText: name }).first();
  if ((await tab.count()) > 0) {
    await tab.click();
    await page.waitForTimeout(2800);
    const file =
      name === 'Vue'
        ? '04-fireworks-vue.png'
        : name === 'Web Components'
          ? '05-fireworks-wc.png'
          : '05b-fireworks-core.png';
    await page.screenshot({ path: `${out}${file}` });
    console.log('saved', file);
  }
}

await shot('#/weatherBackground', '06-weather.png', 4500);
await shot('#/rippleWater', '07-ripple-water.jpg', 3500);
await shot('#/inkBloom', '08-ink-bloom.jpg', 3200);
await shot('#/turntable', '09-turntable.png', 3200);
await shot('#/quickstart', '10-quickstart.png', 2000);

await browser.close();
