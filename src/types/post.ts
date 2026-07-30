export interface BlogPost {
  /** 稳定唯一 ID，用于 /post/<id> */
  id: string;
  /** 历史兼容：文件名（无 .md），旧链接 /post/<slug> 仍可用 */
  slug: string;
  title: string;
  date: string;
  tags: string[];
  excerpt: string;
  content: string;
  filename: string;
  /** 对应 blogs/<category>/ 目录名 */
  category: string;
  categoryLabel: string;
}
