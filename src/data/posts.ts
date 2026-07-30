import { BLOG_CATEGORIES } from '../constants/categories';
import type { BlogPost } from '../types/post';
import { parsePost } from '../utils/parsePost';

const modules = import.meta.glob('../../blogs/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

/** 从 Vite glob 路径解析分类目录：blogs/<category>/<file>.md */
function extractCategory(modulePath: string): string {
  const marker = '/blogs/';
  const index = modulePath.lastIndexOf(marker);
  if (index < 0) return 'uncategorized';

  const relative = modulePath.slice(index + marker.length);
  const parts = relative.split('/');
  if (parts.length < 2) return 'uncategorized';
  return parts[0] || 'uncategorized';
}

const parsed = Object.entries(modules).map(([path, raw]) => {
  const filename = path.split('/').pop() ?? '';
  const category = extractCategory(path);
  return parsePost(filename, raw, category);
});

function warnDuplicates(label: string, values: string[]) {
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
  const duplicates = Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
  if (duplicates.length > 0) {
    console.warn(`[blogs] 发现重复 ${label}：${duplicates.join(', ')}`);
  }
}

warnDuplicates(
  'id',
  parsed.map((post) => post.id)
);
warnDuplicates(
  'slug（文件名需全局唯一）',
  parsed.map((post) => post.slug)
);

export const posts: BlogPost[] = [...parsed].sort((a, b) => b.date.localeCompare(a.date));

/** 优先按稳定 id 查找，其次兼容旧文件名 slug */
export function getPostByIdOrSlug(key: string): BlogPost | undefined {
  return posts.find((post) => post.id === key) ?? posts.find((post) => post.slug === key);
}

/** @deprecated 使用 getPostByIdOrSlug */
export function getPostBySlug(slug: string): BlogPost | undefined {
  return getPostByIdOrSlug(slug);
}

export function getPostsByCategory(categoryId: string): BlogPost[] {
  return posts.filter((post) => post.category === categoryId);
}

export function getUsedCategories() {
  const used = new Set(posts.map((post) => post.category));
  return BLOG_CATEGORIES.filter((category) => used.has(category.id));
}
