import { Link, Navigate, useParams } from 'react-router-dom';
import { MarkdownContent } from '../components/MarkdownContent';
import { PostMeta } from '../components/PostMeta';
import { getPostByIdOrSlug } from '../data/posts';
import { getPostPath } from '../utils/postPath';

export function PostPage() {
  const { slug: key } = useParams();
  const decoded = key ? decodeURIComponent(key) : undefined;
  const post = decoded ? getPostByIdOrSlug(decoded) : undefined;

  if (!post) {
    return (
      <section className="not-found">
        <h1>文章不存在</h1>
        <p>请返回首页查看全部文章。</p>
        <Link to="/">← 返回首页</Link>
      </section>
    );
  }

  // 旧链接 /post/<文件名> → 301 风格跳到 /post/<id>
  if (decoded !== post.id) {
    return <Navigate to={getPostPath(post.id)} replace />;
  }

  return (
    <section className="post-page">
      <Link className="back-link" to="/">
        ← 返回列表
      </Link>
      <header className="post-header">
        <PostMeta date={post.date} tags={post.tags} categoryLabel={post.categoryLabel} />
        <h1>{post.title}</h1>
      </header>
      <MarkdownContent content={post.content} />
    </section>
  );
}
