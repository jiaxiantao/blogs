import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import type { BlogPost } from '../types/post';
import { getPostPath } from '../utils/postPath';
import { PostMeta } from './PostMeta';

interface PostCardProps {
  post: BlogPost;
  style?: CSSProperties;
}

export function PostCard({ post, style }: PostCardProps) {
  const postPath = getPostPath(post.id);

  return (
    <article className="post-card" style={style}>
      <PostMeta
        date={post.date}
        tags={post.tags}
        categoryLabel={post.categoryLabel}
        maxTags={3}
      />
      <h2>
        <Link to={postPath}>{post.title}</Link>
      </h2>
      <p>{post.excerpt}</p>
      <Link className="read-more" to={postPath}>
        阅读全文
        <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
