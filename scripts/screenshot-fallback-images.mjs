#!/usr/bin/env node
/** Screenshot live demos for articles not published on Juejin. */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE_URL = 'https://jiaxiantao.github.io/blogs/images';

const JUEJIN_RE =
  /https:\/\/p0-xtjj-private\.juejin\.cn\/tos-cn-i-73owjymdk6\/[^)\s"'<>]+/g;

async function replaceUrlsInMd(mdRel, folder, filenames) {
  const mdPath = path.join(ROOT, mdRel);
  let text = fs.readFileSync(mdPath, 'utf-8');
  const urls = [...text.matchAll(JUEJIN_RE)].map((m) => m[0]);
  if (urls.length !== filenames.length) {
    console.warn(`  URL count ${urls.length} != filenames ${filenames.length} for ${mdRel}`);
  }
  urls.forEach((url, i) => {
    if (filenames[i]) {
      text = text.replace(url, `${BASE_URL}/${folder}/${filenames[i]}`);
    }
  });
  fs.writeFileSync(mdPath, text);
  console.log(`  updated ${mdRel}`);
}

async function shot(page, url, dest, { waitMs = 4000, selector = 'canvas' } = {}) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(waitMs);
  if (selector) {
    await page.waitForSelector(selector, { timeout: 30000 }).catch(() => {});
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const el = selector ? page.locator(selector).first() : page;
  if (selector && (await el.count()) > 0) {
    await el.screenshot({ path: dest });
  } else {
    await page.screenshot({ path: dest });
  }
  console.log(`  saved ${path.basename(dest)}`);
}

async function cosDesignJourney(page) {
  const folder = 'cos-design-journey';
  const out = path.join(ROOT, 'public/images', folder);
  const routes = [
    ['01-playground-home.webp', 'https://jiaxiantao.xyz/cos-design/#/', 'main'],
    ['02-canvas-clock.webp', 'https://jiaxiantao.xyz/cos-design/#/canvasClock', 'canvas'],
    ['03-charge.webp', 'https://jiaxiantao.xyz/cos-design/#/charge', 'canvas'],
    ['04-return-city.webp', 'https://jiaxiantao.xyz/cos-design/#/returnCity', 'canvas'],
    ['05-turntable.webp', 'https://jiaxiantao.xyz/cos-design/#/turntable', 'canvas'],
    ['06-fireworks.webp', 'https://jiaxiantao.xyz/cos-design/#/fireworks', 'canvas'],
    ['07-matrix-rain.webp', 'https://jiaxiantao.xyz/cos-design/#/matrixRain', 'canvas'],
    ['08-particle-network.webp', 'https://jiaxiantao.xyz/cos-design/#/particleNetwork', 'canvas'],
    ['09-typewriter.webp', 'https://jiaxiantao.xyz/cos-design/#/typewriter', 'canvas'],
    ['10-neon-text.webp', 'https://jiaxiantao.xyz/cos-design/#/neonText', 'canvas'],
    ['11-wave-button.webp', 'https://jiaxiantao.xyz/cos-design/#/waveButton', 'canvas'],
  ];
  for (const [file, url, sel] of routes) {
    await shot(page, url, path.join(out, file), {
      waitMs: sel === 'main' ? 2500 : 3500,
      selector: sel === 'main' ? 'main' : 'canvas',
    });
  }
  await replaceUrlsInMd(
    'blogs/cos-design/cos-design-从视觉Demo到可发布组件库的完整实践.md',
    folder,
    routes.map((r) => r[0]),
  );
}

async function wmsV2(page) {
  const folder = 'wms-3d-v2';
  const out = path.join(ROOT, 'public/images', folder);
  const base = 'https://jiaxiantao.github.io/3d-express-warehouse/warehouse';
  const shots = [
    ['01-hero-god-view.webp', `${base}?view=god`, 12000],
    ['02-upgrade-table-context.webp', `${base}?view=god`, 8000],
    ['03-robot-third-person.webp', `${base}?view=third`, 15000],
    ['04-god-view.webp', `${base}?view=god`, 10000],
    ['05-third-person.webp', `${base}?view=third`, 12000],
    ['06-first-person.webp', `${base}?view=robot`, 12000],
    ['07-category-labels.webp', `${base}?view=god`, 10000],
    ['08-scan-locate.webp', `${base}?view=god&sku=FB-1001`, 10000],
  ];
  for (const [file, url, waitMs] of shots) {
    await shot(page, url, path.join(out, file), { waitMs, selector: 'canvas' });
  }
  await replaceUrlsInMd(
    'blogs/3d/3D快递仓储可视化重磅升级-从静态看板到可漫游的WMS演示场.md',
    folder,
    shots.map((s) => s[0]),
  );
}

async function collabDoc(page) {
  const folder = 'collab-doc';
  const out = path.join(ROOT, 'public/images', folder);
  await shot(page, 'https://jiaxiantao.github.io/team-docs/', path.join(out, '01-landing.webp'), {
    waitMs: 2000,
    selector: 'main, body',
  });
  // Architecture SVG placeholders for diagrams not on Juejin
  const svgDiagrams = [
    ['02-architecture.svg', 'Team Docs 三进程架构', 'Web (Next.js) · Collab (Hocuspocus) · PostgreSQL'],
    ['03-crdt-flow.svg', 'CRDT 协同数据流', 'Tiptap ↔ Y.Doc ↔ Hocuspocus ↔ PostgreSQL'],
    ['04-auth-flow.svg', '双服务鉴权', 'Auth.js Session → Web API → Collab Token'],
    ['05-persistence.svg', 'Yjs 持久化', 'Y.State → encodeStateAsUpdate → DocumentState'],
    ['06-attachments.svg', '附件与图片', 'Upload → S3/OSS → Editor Image Node'],
    ['07-editor-ui.svg', '编辑器界面', 'Toolbar · Caret · Online Users'],
    ['08-version-history.svg', '版本快照', 'Snapshot → Restore → Page Reload'],
    ['09-docker-topology.svg', 'Docker 部署', 'web · collab · postgres · redis'],
  ];
  for (const [file, title, subtitle] of svgDiagrams) {
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="40" y="40" width="1120" height="550" rx="24" fill="#111827" stroke="#334155" stroke-width="2"/>
  <text x="600" y="260" fill="#f8fafc" font-size="42" font-family="system-ui,sans-serif" text-anchor="middle" font-weight="700">${title}</text>
  <text x="600" y="340" fill="#94a3b8" font-size="28" font-family="system-ui,sans-serif" text-anchor="middle">${subtitle}</text>
  <text x="600" y="500" fill="#64748b" font-size="20" font-family="system-ui,sans-serif" text-anchor="middle">team-docs · 架构示意图</text>
</svg>`;
    fs.writeFileSync(path.join(out, file), svg);
    console.log(`  saved ${file}`);
  }
  await replaceUrlsInMd(
    'blogs/frontend/从零到协同-构建类飞书在线文档系统的五个技术重难点.md',
    folder,
    ['01-landing.webp', ...svgDiagrams.map((d) => d[0])],
  );
}

async function aiCodeReview() {
  const folder = 'ai-code-review';
  const out = path.join(ROOT, 'public/images', folder);
  fs.mkdirSync(out, { recursive: true });
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">
  <rect width="1200" height="400" fill="#0b1220"/>
  <rect x="48" y="48" width="1104" height="304" rx="20" fill="#111827" stroke="#38bdf8" stroke-width="3"/>
  <text x="600" y="170" fill="#e2e8f0" font-size="34" font-family="system-ui,sans-serif" text-anchor="middle">机器负责产出，人负责后果。</text>
  <text x="600" y="240" fill="#94a3b8" font-size="24" font-family="system-ui,sans-serif" text-anchor="middle">格式 / Lint → CI · 业务 / 权限 / 安全 → 人审</text>
</svg>`;
  fs.writeFileSync(path.join(out, '01-principle.svg'), svg);
  console.log('  saved 01-principle.svg');
  await replaceUrlsInMd('blogs/ai-agent/AI生成代码之后前端Code-Review审什么.md', folder, [
    '01-principle.svg',
  ]);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });

  console.log('\n=== cos-design-journey ===');
  await cosDesignJourney(page);

  console.log('\n=== wms-3d-v2 ===');
  await wmsV2(page);

  console.log('\n=== collab-doc ===');
  await collabDoc(page);

  await browser.close();

  console.log('\n=== ai-code-review ===');
  await aiCodeReview();

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
