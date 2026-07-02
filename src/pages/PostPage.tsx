import { Link, useParams } from 'react-router-dom';
import { MarkdownContent } from '../components/MarkdownContent';
import { getPostBySlug } from '../data/posts';

export function PostPage() {
  const { slug } = useParams();
  const post = slug ? getPostBySlug(decodeURIComponent(slug)) : undefined;

  if (!post) {
    return (
      <section className="not-found">
        <h1>文章不存在</h1>
        <p>请返回首页查看全部文章。</p>
        <Link to="/">← 返回首页</Link>
      </section>
    );
  }

  return (
    <section className="post-page">
      <Link className="back-link" to="/">
        ← 返回列表
      </Link>
      <header className="post-header">
        <div className="post-header-meta">
          <time dateTime={post.date}>{post.date}</time>
          {post.tags.length > 0 && (
            <div className="tag-list">
              {post.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <h1>{post.title}</h1>
      </header>
      <MarkdownContent content={post.content} />
    </section>
  );
}
