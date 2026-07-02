import { Link } from 'react-router-dom';
import type { BlogPost } from '../data/posts';

interface PostCardProps {
  post: BlogPost;
}

export function PostCard({ post }: PostCardProps) {
  return (
    <article className="post-card">
      <div className="post-card-meta">
        <time dateTime={post.date}>{post.date}</time>
        {post.tags.length > 0 && (
          <div className="tag-list">
            {post.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <h2>
        <Link to={`/post/${encodeURIComponent(post.slug)}`}>{post.title}</Link>
      </h2>
      <p>{post.excerpt}</p>
      <Link className="read-more" to={`/post/${encodeURIComponent(post.slug)}`}>
        阅读全文 →
      </Link>
    </article>
  );
}
