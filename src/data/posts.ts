import type { BlogPost } from '../types/post';
import { parsePost } from '../utils/parsePost';

const modules = import.meta.glob('../../blogs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const posts: BlogPost[] = Object.entries(modules)
  .map(([path, raw]) => {
    const filename = path.split('/').pop() ?? '';
    return parsePost(filename, raw);
  })
  .sort((a, b) => b.date.localeCompare(a.date));

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((post) => post.slug === slug);
}
