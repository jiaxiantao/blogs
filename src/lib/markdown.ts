import DOMPurify from 'dompurify';
import { marked } from 'marked';

const renderer = new marked.Renderer();

renderer.link = ({ href, title, text }) => {
  const isExternal = href?.startsWith('http');
  const titleAttr = title ? ` title="${title}"` : '';
  const relAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';

  return `<a href="${href}"${titleAttr}${relAttr}>${text}</a>`;
};

renderer.image = ({ href, title, text }) => {
  const alt = text || title || '';
  const titleAttr = title ? ` title="${title}"` : '';

  return `<img src="${href}" alt="${alt}" loading="lazy" decoding="async"${titleAttr} />`;
};

marked.use({
  gfm: true,
  breaks: true,
  renderer,
});

export function renderMarkdown(content: string): string {
  const html = marked.parse(content) as string;

  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel', 'loading', 'decoding'],
  });
}
