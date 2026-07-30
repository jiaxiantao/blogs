/** 站内文章路径一律使用稳定 id */
export function getPostPath(id: string): string {
  return `/post/${encodeURIComponent(id)}`;
}
