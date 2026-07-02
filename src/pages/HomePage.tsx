import { PostCard } from '../components/PostCard';
import { SITE } from '../constants/site';
import { posts } from '../data/posts';

export function HomePage() {
  return (
    <section className="home">
      <div className="hero">
        <p className="eyebrow">Blog Archive</p>
        <h1>{SITE.description}</h1>
        <p className="hero-desc">共 {posts.length} 篇文章，持续更新中。</p>
      </div>

      <div className="post-grid">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </section>
  );
}
