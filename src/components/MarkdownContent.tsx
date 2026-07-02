import { useMemo } from 'react';
import { renderMarkdown } from '../lib/markdown';

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  return <article className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />;
}
