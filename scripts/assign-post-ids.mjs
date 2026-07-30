#!/usr/bin/env node
/**
 * 为 blogs 下所有 Markdown 补齐 / 迁移文章 ID。
 *
 * - ID 来自 UUID v4：移除连字符后截取前 16 位
 * - 写入 HTML 注释：<!-- post-id: xxxxxxxxxxxxxxxx -->（页面不展示）
 * - 若仍是旧写法 `> 文章编号：...`，会迁移为注释并保留原 ID
 * - 已有合法注释 ID 的文件保持不变
 */
import { randomUUID } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BLOGS_DIR = join(ROOT, 'blogs');
const COMMENT_ID_PATTERN = /<!--\s*post-id:\s*([a-f0-9]{16})\s*-->/;
const LEGACY_ID_PATTERN = /^>[ \t]*文章编号[ \t]*[:：][ \t]*([a-f0-9]{16})[ \t]*(?:\\)?\r?\n?/m;

async function collectMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function generateId(used) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = randomUUID().replaceAll('-', '').slice(0, 16);
    if (!used.has(id)) return id;
  }
  throw new Error('无法生成唯一 ID，请重试');
}

function withCommentId(raw, id) {
  const source = raw.replace(/^\uFEFF/, '').replace(LEGACY_ID_PATTERN, '');
  if (COMMENT_ID_PATTERN.test(source)) {
    return source.replace(COMMENT_ID_PATTERN, `<!-- post-id: ${id} -->`);
  }
  return `<!-- post-id: ${id} -->\n\n${source}`;
}

const files = await collectMarkdownFiles(BLOGS_DIR);
const contents = new Map();
const used = new Set();

for (const file of files) {
  const raw = await readFile(file, 'utf8');
  contents.set(file, raw);
  const existing = raw.match(COMMENT_ID_PATTERN)?.[1] ?? raw.match(LEGACY_ID_PATTERN)?.[1];
  if (existing) {
    if (used.has(existing)) {
      throw new Error(`ID 冲突：${existing} 已被其他文章占用（${relative(ROOT, file)}）`);
    }
    used.add(existing);
  }
}

let assigned = 0;
let migrated = 0;

for (const file of files) {
  const raw = contents.get(file);
  const label = relative(ROOT, file);
  const commentId = raw.match(COMMENT_ID_PATTERN)?.[1];
  const legacyId = raw.match(LEGACY_ID_PATTERN)?.[1];

  if (commentId && !legacyId) {
    console.log(`保持 ${commentId}  ${label}`);
    continue;
  }

  if (legacyId) {
    await writeFile(file, withCommentId(raw, legacyId), 'utf8');
    migrated += 1;
    console.log(`迁移 ${legacyId}  ${label}`);
    continue;
  }

  const id = generateId(used);
  used.add(id);
  await writeFile(file, withCommentId(raw, id), 'utf8');
  assigned += 1;
  console.log(`新增 ${id}  ${label}`);
}

console.log(`\n共 ${files.length} 篇，迁移 ${migrated}，新增 ${assigned}。`);
