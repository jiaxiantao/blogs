export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  excerpt: string;
  content: string;
  filename: string;
}

const modules = import.meta.glob('../../blogs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function parsePost(filename: string, raw: string): BlogPost {
  const slug = filename.replace(/\.md$/, '');
  const lines = raw.split('\n');

  const titleLine = lines.find((line) => line.startsWith('# '));
  const title = titleLine?.replace(/^#\s+/, '').trim() ?? slug;

  const metaLine = lines.find((line) => line.includes('发布日期'));
  const dateMatch = metaLine?.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch?.[1] ?? '1970-01-01';

  const tagsLine = lines.find((line) => line.includes('标签'));
  const tags = tagsLine
    ?.split('标签')[1]
    ?.replace(/[:：]/, '')
    .split('/')
    .map((tag) => tag.trim())
    .filter(Boolean) ?? [];

  const bodyStart = lines.findIndex((line, index) => index > 0 && line.startsWith('## '));
  const excerptSource =
    bodyStart >= 0
      ? lines.slice(bodyStart).join('\n').replace(/[#>*`\[\]()!-]/g, ' ')
      : raw;
  const excerpt = excerptSource.replace(/\s+/g, ' ').trim().slice(0, 140);

  return {
    slug,
    title,
    date,
    tags,
    excerpt: excerpt ? `${excerpt}...` : '',
    content: raw,
    filename,
  };
}

export const posts: BlogPost[] = Object.entries(modules)
  .map(([path, raw]) => {
    const filename = path.split('/').pop() ?? '';
    return parsePost(filename, raw);
  })
  .sort((a, b) => b.date.localeCompare(a.date));

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((post) => post.slug === slug);
}
