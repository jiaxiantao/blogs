import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { MarkdownContent } from '../components/MarkdownContent';
import { PostMeta } from '../components/PostMeta';
import { SITE } from '../constants/site';
import { getPostByIdOrSlug } from '../data/posts';
import { usePageTitle } from '../hooks/usePageTitle';
import { getPostPath } from '../utils/postPath';

export function PostPage() {
  const { slug: key } = useParams();
  const decoded = key ? decodeURIComponent(key) : undefined;
  const post = decoded ? getPostByIdOrSlug(decoded) : undefined;
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(0);

  usePageTitle(post?.title, post?.excerpt);

  useEffect(() => {
    if (!post) return;

    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [post]);

  const copyLink = useCallback(async () => {
    if (!post) return;
    const url = `${window.location.origin}${SITE.basePath}${getPostPath(post.id)}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [post]);

  if (!post) {
    return (
      <section className="not-found">
        <p className="eyebrow">404</p>
        <h1>文章不存在</h1>
        <p>请返回首页查看全部文章。</p>
        <Link className="btn btn-primary" to="/">
          返回首页
        </Link>
      </section>
    );
  }

  // 旧链接 /post/<文件名> → 301 风格跳到 /post/<id>
  if (decoded !== post.id) {
    return <Navigate to={getPostPath(post.id)} replace />;
  }

  return (
    <section className="post-page">
      <div
        className="reading-progress"
        style={{ transform: `scaleX(${progress / 100})` }}
        aria-hidden="true"
      />

      <div className="post-toolbar">
        <Link className="back-link" to="/">
          ← 返回列表
        </Link>
        <button type="button" className="copy-link-btn" onClick={copyLink}>
          {copied ? '已复制' : '复制链接'}
        </button>
      </div>

      <header className="post-header">
        <PostMeta date={post.date} tags={post.tags} categoryLabel={post.categoryLabel} />
        <h1>{post.title}</h1>
        {post.excerpt && <p className="post-lead">{post.excerpt}</p>}
      </header>

      <MarkdownContent content={post.content} />
    </section>
  );
}
