import type { BlogPost } from '../types/post';
import { getCategoryLabel } from '../constants/categories';
import { extractPostId, stripPostIdMetadata } from './postId';

function extractTitle(lines: string[], fallback: string): string {
  const titleLine = lines.find((line) => line.startsWith('# '));
  return titleLine?.replace(/^#\s+/, '').trim() ?? fallback;
}

function extractDate(lines: string[]): string | null {
  const metaLine = lines.slice(0, 30).find((line) => /发布日期/.test(line));
  const dateMatch = metaLine?.match(/(\d{4}-\d{2}-\d{2})/);
  return dateMatch?.[1] ?? null;
}

function extractTags(lines: string[]): string[] {
  const tagsLine = lines.find((line) => line.includes('标签'));
  return (
    tagsLine
      ?.split('标签')[1]
      ?.replace(/[:：]/, '')
      .split('/')
      .map((tag) => tag.trim())
      .filter(Boolean) ?? []
  );
}

function extractExcerpt(lines: string[], raw: string): string {
  const bodyStart = lines.findIndex((line, index) => index > 0 && line.startsWith('## '));
  const excerptSource =
    bodyStart >= 0
      ? lines.slice(bodyStart).join('\n').replace(/[#>*`\[\]()!-]/g, ' ')
      : raw;

  const excerpt = excerptSource.replace(/\s+/g, ' ').trim().slice(0, 140);
  return excerpt ? `${excerpt}...` : '';
}

/** 文章页头已展示标题，正文不再重复渲染 Markdown 一级标题 */
function stripDocumentTitle(raw: string): string {
  return raw.replace(/^#\s+.+\r?\n(?:\r?\n)?/m, '');
}

export function parsePost(filename: string, raw: string, category = 'uncategorized'): BlogPost {
  const slug = filename.replace(/\.md$/, '');
  const lines = raw.split('\n');
  const id = extractPostId(raw) ?? slug;
  const content = stripDocumentTitle(stripPostIdMetadata(raw));

  return {
    id,
    slug,
    title: extractTitle(lines, slug),
    date: extractDate(lines) ?? '未标注',
    tags: extractTags(lines),
    excerpt: extractExcerpt(content.split('\n'), content),
    content,
    filename,
    category,
    categoryLabel: getCategoryLabel(category)
  };
}
