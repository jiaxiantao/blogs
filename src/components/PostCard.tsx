import { Link } from 'react-router-dom';
import type { BlogPost } from '../types/post';
import { getPostPath } from '../utils/postPath';
import { PostMeta } from './PostMeta';

interface PostCardProps {
  post: BlogPost;
}

export function PostCard({ post }: PostCardProps) {
  const postPath = getPostPath(post.slug);

  return (
    <article className="post-card">
      <PostMeta date={post.date} tags={post.tags} maxTags={3} />
      <h2>
        <Link to={postPath}>{post.title}</Link>
      </h2>
      <p>{post.excerpt}</p>
      <Link className="read-more" to={postPath}>
        阅读全文 →
      </Link>
    </article>
  );
}
