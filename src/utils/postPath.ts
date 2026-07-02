export function getPostPath(slug: string): string {
  return `/post/${encodeURIComponent(slug)}`;
}
