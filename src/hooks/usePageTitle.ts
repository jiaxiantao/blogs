import { useEffect } from 'react';
import { SITE } from '../constants/site';

const DEFAULT_DESCRIPTION =
  '牧艺的技术博客 — 前端工程、3D 可视化、AI Agent 实践';

function setMetaDescription(content: string) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'description';
    document.head.appendChild(meta);
  }
  meta.content = content;
}

/** 设置页面标题与 description，卸载时恢复站点默认 */
export function usePageTitle(title?: string, description?: string) {
  useEffect(() => {
    const previousTitle = document.title;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = meta?.content ?? DEFAULT_DESCRIPTION;

    if (title) {
      document.title = `${title} · ${SITE.title}`;
      setMetaDescription(description ?? `${title} — ${SITE.description}`);
    } else {
      document.title = SITE.title;
      setMetaDescription(DEFAULT_DESCRIPTION);
    }

    return () => {
      document.title = previousTitle;
      setMetaDescription(previousDescription);
    };
  }, [title, description]);
}
