import { useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const html = useMemo(() => {
    const rendered = marked.parse(content) as string;
    return DOMPurify.sanitize(rendered, {
      ADD_ATTR: ['target', 'rel'],
    });
  }, [content]);

  useEffect(() => {
    document.querySelectorAll('.markdown-body a[href^="http"]').forEach((anchor) => {
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
    });
  }, [html]);

  return <article className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />;
}
