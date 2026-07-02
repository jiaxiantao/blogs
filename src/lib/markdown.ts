import DOMPurify from 'dompurify';
import { marked } from 'marked';

const renderer = new marked.Renderer();

renderer.link = ({ href, title, text }) => {
  const isExternal = href?.startsWith('http');
  const titleAttr = title ? ` title="${title}"` : '';
  const relAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';

  return `<a href="${href}"${titleAttr}${relAttr}>${text}</a>`;
};

marked.use({
  gfm: true,
  breaks: true,
  renderer,
});

export function renderMarkdown(content: string): string {
  const html = marked.parse(content) as string;

  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel'],
  });
}
