import type { BlogPost } from '../types/post';

function extractTitle(lines: string[], fallback: string): string {
  const titleLine = lines.find((line) => line.startsWith('# '));
  return titleLine?.replace(/^#\s+/, '').trim() ?? fallback;
}

function extractDate(lines: string[]): string {
  const metaLine = lines.find((line) => line.includes('发布日期'));
  const dateMatch = metaLine?.match(/(\d{4}-\d{2}-\d{2})/);
  return dateMatch?.[1] ?? '1970-01-01';
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

export function parsePost(filename: string, raw: string): BlogPost {
  const slug = filename.replace(/\.md$/, '');
  const lines = raw.split('\n');

  return {
    slug,
    title: extractTitle(lines, slug),
    date: extractDate(lines),
    tags: extractTags(lines),
    excerpt: extractExcerpt(lines, raw),
    content: raw,
    filename,
  };
}
