export interface BlogCategory {
  id: string;
  label: string;
  description: string;
}

/** 目录名 → 展示信息；新增分类时在此登记，并在 blogs/<id>/ 下放文章 */
export const BLOG_CATEGORIES: BlogCategory[] = [
  {
    id: 'ai-agent',
    label: 'AI Agent',
    description: 'Tool Calling、MCP、Context Engineering 与 Cursor 实践'
  },
  {
    id: 'cos-design',
    label: 'cos-design',
    description: '视觉特效组件库设计与实现'
  },
  {
    id: '3d',
    label: '3D 可视化',
    description: '浏览器 3D、Canvas 与仓储可视化'
  },
  {
    id: 'frontend',
    label: '前端工程',
    description: '前端趋势、协作系统与工程实践'
  }
];

export const CATEGORY_BY_ID = Object.fromEntries(
  BLOG_CATEGORIES.map((category) => [category.id, category])
) as Record<string, BlogCategory>;

export function getCategoryLabel(categoryId: string): string {
  return CATEGORY_BY_ID[categoryId]?.label ?? categoryId;
}
