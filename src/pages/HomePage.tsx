import { posts } from '../data/posts';
import { PostCard } from '../components/PostCard';

export function HomePage() {
  return (
    <section className="home">
      <div className="hero">
        <p className="eyebrow">Blog Archive</p>
        <h1>记录前端工程、3D 可视化与 AI Agent 的实践</h1>
        <p className="hero-desc">
          共 {posts.length} 篇文章，涵盖 Cursor 工作流、MCP 集成、Three.js 项目与组件库建设。
        </p>
      </div>

      <div className="post-grid">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </section>
  );
}
