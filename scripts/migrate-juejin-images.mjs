#!/usr/bin/env node
/**
 * Download Juejin article images to public/images/ and rewrite markdown URLs.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'public/images');
const BASE_URL = 'https://jiaxiantao.github.io/blogs/images';
const JUEJIN_USER_ID = '3958672823687880';

/** Manual map: markdown basename -> Juejin article_id (when title match fails) */
const ARTICLE_OVERRIDES = {
  'cos-design-BubbleField-Canvas深海气泡场的技术实现': '7667105307928166452',
  'cos-design-PhotoAlbum-CSS-3D真实翻页相册的技术实现': '7668296872550318080',
  'cos-design-v3.0-从15个Demo到49个组件的视觉特效库': '7654142523153235995',
  'cos-design-RippleWater与SmokeFog-水面涟漪与烟雾雾气的技术实现': '7665698978482815028',
  'cos-design-WeatherBackground-Canvas天气引擎与Open-Meteo实况': '7665154606210023475',
  '3D快递仓储可视化技术博客': '7654641623330209802',
  '浏览器端3D看车-从GLB到可交互展厅的技术实践': '7653437401840189474',
  '前端工程师的AI副驾驶-Cursor一整年真实体验与避坑指南': '7656751882112565275',
  'Next.js搭建AI-Agent前端编排-从Plan到SSE-Trace完整实践': '7653686112276348962',
  'cos-design-v3.8.0-五个重磅背景特效从极光到熔岩的技术实现': '7680025405151084571',
  '别再左右滑了-我做了13种能摸的看图方式用户才愿意停下来': '7669711673101074482',
  'DeepSeek-Harness核心流程与基本使用': '7676304162051244047',
  'DFC-Data-Agent主流程-接口优先问数与LangGraph控制环': '7675731373189988367',
  'Knowledge-Studio本地开源版-对标百炼RAG控制台的架构与重难点': '7670439464020557824',
  'Knowledge-Studio第二天-从能演示到能给别人用': '7670712759411408906',
  'Knowledge-Studio第三天-检索改写重排与CI评测门禁': '7671897072309125135',
};

const MD_IMG_RE =
  /!\[([^\]]*)\]\((https:\/\/p0-xtjj-private\.juejin\.cn\/[^)]+)\)/g;
const HTML_IMG_RE =
  /<img([^>]*)\ssrc="(https:\/\/p0-xtjj-private\.juejin\.cn\/[^"]+)"([^>]*)>/g;

function slugify(text) {
  return text
    .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
    .toLowerCase();
}

function extractUuid(url) {
  return url.match(/\/([a-f0-9]{32})~/)?.[1] ?? null;
}

function imageFolder(relPath) {
  const base = path.basename(relPath, '.md');
  const category = relPath.split(/[/\\]/)[1] ?? 'misc';
  const folderMap = {
    'cos-design-v3.8.0-五个重磅背景特效从极光到熔岩的技术实现': 'cos-design-v380',
    '别再左右滑了-我做了13种能摸的看图方式用户才愿意停下来': 'photo-preview',
    'cos-design-BubbleField-Canvas深海气泡场的技术实现': 'cos-design-bubble-field',
    'cos-design-PhotoAlbum-CSS-3D真实翻页相册的技术实现': 'cos-design-photo-album',
    'cos-design-RippleWater与SmokeFog-水面涟漪与烟雾雾气的技术实现':
      'cos-design-ripple-smoke',
    'cos-design-WeatherBackground-Canvas天气引擎与Open-Meteo实况':
      'cos-design-weather',
    'cos-design-v3.0-从15个Demo到49个组件的视觉特效库': 'cos-design-v3',
    'cos-design-从视觉Demo到可发布组件库的完整实践': 'cos-design-journey',
    'DeepSeek-Harness核心流程与基本使用': 'deepseek-harness',
    'Knowledge-Studio本地开源版-对标百炼RAG控制台的架构与重难点': 'knowledge-studio',
    'Knowledge-Studio第二天-从能演示到能给别人用': 'knowledge-studio',
    'Knowledge-Studio第三天-检索改写重排与CI评测门禁': 'knowledge-studio',
    'DFC-Data-Agent主流程-接口优先问数与LangGraph控制环': 'dfc-data-agent',
    'Next.js搭建AI-Agent前端编排-从Plan到SSE-Trace完整实践': 'nextjs-agent',
    'AI生成代码之后前端Code-Review审什么': 'ai-code-review',
    '前端工程师的AI副驾驶-Cursor一整年真实体验与避坑指南': 'cursor-copilot',
    '从零到协同-构建类飞书在线文档系统的五个技术重难点': 'collab-doc',
    '3D快递仓储可视化技术博客': 'wms-3d',
    '3D快递仓储可视化重磅升级-从静态看板到可漫游的WMS演示场': 'wms-3d-v2',
    '浏览器端3D看车-从GLB到可交互展厅的技术实践': '3d-car-showroom',
  };
  return folderMap[base] ?? `${category}/${slugify(base)}`;
}

function pickFilename(alt, index) {
  if (alt && alt !== 'image.png' && /\.(jpe?g|png|webp|gif)$/i.test(alt)) {
    return alt.replace(/\.(jpe?g|png|gif)$/i, '.webp');
  }
  if (alt && alt !== 'image.png') {
    const slug = slugify(alt);
    if (slug.length > 3) return `${String(index + 1).padStart(2, '0')}-${slug}.webp`;
  }
  return `${String(index + 1).padStart(2, '0')}.webp`;
}

function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

function findLocalByAlt(alt) {
  if (!alt || alt === 'image.png') return null;
  for (const rel of walkFiles(path.join(ROOT, 'public/images'))) {
    const base = path.basename(rel);
    if (base === alt || base === alt.replace(/\.(jpe?g|png|gif)$/i, '.webp')) {
      return path.relative(path.join(ROOT, 'public/images'), rel).replace(/\\/g, '/');
    }
  }
  return null;
}

function normalizeTitle(title) {
  return title
    .replace(/[「」『』""''：:，,！!？?（）()]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function matchArticle(mdTitle, articles) {
  const norm = normalizeTitle(mdTitle);
  for (const a of articles) {
    if (normalizeTitle(a.title) === norm) return a;
  }
  let best = null;
  let bestScore = 0;
  for (const a of articles) {
    const an = normalizeTitle(a.title);
    const prefix = norm.slice(0, Math.min(24, norm.length));
    if (an.includes(prefix) || norm.includes(an.slice(0, 24))) {
      const score = Math.min(an.length, norm.length);
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
  }
  return best;
}

function collectMarkdownFiles() {
  const files = [];
  for (const rel of walkFiles(path.join(ROOT, 'blogs'))) {
    if (!rel.endsWith('.md')) continue;
    const text = fs.readFileSync(rel, 'utf-8');
    if (!text.includes('p0-xtjj-private.juejin.cn')) continue;

    const basename = path.basename(rel, '.md');
    const title = text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? basename;
    const refs = [];
    let m;
    const mdRe = new RegExp(MD_IMG_RE.source, 'g');
    while ((m = mdRe.exec(text))) {
      refs.push({ alt: m[1], url: m[2], uuid: extractUuid(m[2]) });
    }
    const htmlRe = new RegExp(HTML_IMG_RE.source, 'g');
    while ((m = htmlRe.exec(text))) {
      refs.push({ alt: '', url: m[2], uuid: extractUuid(m[2]) });
    }

    files.push({
      mdPath: rel,
      relPath: path.relative(ROOT, rel),
      basename,
      title,
      refs,
    });
  }
  return files;
}

async function fetchAllAuthorArticles(page) {
  const articles = [];
  let cursor = '0';
  for (let i = 0; i < 30; i++) {
    const resp = await page.request.post(
      'https://api.juejin.cn/content_api/v1/article/query_list',
      { data: { user_id: JUEJIN_USER_ID, sort_type: 2, cursor } },
    );
    const batch = (await resp.json()).data ?? [];
    if (!batch.length) break;
    for (const item of batch) {
      const info = item.article_info;
      if (info?.title) {
        articles.push({ id: String(info.article_id), title: info.title.trim() });
      }
    }
    if (batch.length < 20) break;
    cursor = String(batch[batch.length - 1].article_id);
  }
  return articles;
}

async function scrollArticle(page) {
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.scrollBy(0, 900));
    await page.waitForTimeout(350);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  await page
    .waitForFunction(
      () => {
        const imgs = [...document.querySelectorAll('.markdown-body img')];
        return imgs.length === 0 || imgs.every((img) => img.complete && img.naturalWidth > 0);
      },
      { timeout: 15000 },
    )
    .catch(() => {});
}

async function fetchArticleImages(page, articleId) {
  await page.goto(`https://juejin.cn/post/${articleId}`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  });
  await scrollArticle(page);

  const imgs = await page.evaluate(() => {
    const article =
      document.querySelector('.markdown-body') ||
      document.querySelector('#article-root') ||
      document.body;
    return [...article.querySelectorAll('img')].map((img) => ({
      src: img.src,
      alt: img.alt || '',
    }));
  });

  const byUuid = new Map();
  for (const img of imgs) {
    const uuid = extractUuid(img.src);
    if (uuid) byUuid.set(uuid, img);
  }
  return byUuid;
}

async function downloadImage(page, src, referer, destPath) {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
    return { skipped: true };
  }
  const resp = await page.request.get(src, { headers: { Referer: referer } });
  if (resp.status() !== 200) return { error: `HTTP ${resp.status()}` };
  const buf = await resp.body();
  if (buf.length < 500) return { error: `too small (${buf.length}b)` };
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
  return { ok: true, size: buf.length };
}

function publicUrlForLocal(localRel) {
  return `${BASE_URL}/${localRel.replace(/\\/g, '/')}`;
}

async function main() {
  const files = collectMarkdownFiles();
  console.log(
    `Found ${files.length} files, ${files.reduce((n, f) => n + f.refs.length, 0)} remaining Juejin URLs`,
  );

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const articles = await fetchAllAuthorArticles(page);
  console.log(`Author articles: ${articles.length}`);

  const imageCache = new Map();
  const stats = { downloaded: 0, skipped: 0, wired: 0, failed: 0, updated: 0 };

  for (const file of files) {
    const folder = imageFolder(file.relPath);
    const outDir = path.join(IMAGES_DIR, folder);
    const overrideId = ARTICLE_OVERRIDES[file.basename];
    const matched = matchArticle(file.title, articles);
    const articleId = overrideId ?? matched?.id;

    console.log(`\n=== ${file.relPath}`);
    console.log(`  folder: ${folder}, refs: ${file.refs.length}, article: ${articleId ?? 'NONE'}`);

    let uuidToImg = new Map();
    if (articleId) {
      if (!imageCache.has(articleId)) {
        uuidToImg = await fetchArticleImages(page, articleId);
        imageCache.set(articleId, uuidToImg);
        console.log(`  fetched ${uuidToImg.size} images`);
      } else {
        uuidToImg = imageCache.get(articleId);
      }
    }

    let text = fs.readFileSync(file.mdPath, 'utf-8');
    const urlMap = new Map();

    for (let i = 0; i < file.refs.length; i++) {
      const ref = file.refs[i];
      const localRel = findLocalByAlt(ref.alt);

      if (localRel) {
        urlMap.set(ref.url, publicUrlForLocal(localRel));
        stats.wired++;
        console.log(`  [${i + 1}] local ${localRel}`);
        continue;
      }

      const filename = pickFilename(ref.alt, i);
      const destPath = path.join(outDir, filename);
      const publicUrl = `${BASE_URL}/${folder}/${filename}`;

      const img = ref.uuid ? uuidToImg.get(ref.uuid) : null;
      if (!img?.src || !articleId) {
        stats.failed++;
        console.warn(`  [${i + 1}] FAIL uuid=${ref.uuid?.slice(0, 8)} alt=${ref.alt.slice(0, 25)}`);
        continue;
      }

      const result = await downloadImage(
        page,
        img.src,
        `https://juejin.cn/post/${articleId}`,
        destPath,
      );
      if (result.skipped) {
        stats.skipped++;
        console.log(`  [${i + 1}] skip ${filename}`);
      } else if (result.error) {
        stats.failed++;
        console.warn(`  [${i + 1}] FAIL ${filename}: ${result.error}`);
        continue;
      } else {
        stats.downloaded++;
        console.log(`  [${i + 1}] ok ${filename} (${result.size}b)`);
      }

      urlMap.set(ref.url, publicUrl);
    }

    for (const [oldUrl, newUrl] of urlMap) {
      text = text.split(oldUrl).join(newUrl);
    }

    if (text !== fs.readFileSync(file.mdPath, 'utf-8')) {
      fs.writeFileSync(file.mdPath, text);
      stats.updated++;
      console.log('  markdown updated');
    }
  }

  await browser.close();
  console.log('\n=== Done ===', stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
