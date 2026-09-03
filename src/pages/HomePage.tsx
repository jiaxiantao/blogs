import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PostCard } from '../components/PostCard';
import { SITE } from '../constants/site';
import { getUsedCategories, posts } from '../data/posts';
import { usePageTitle } from '../hooks/usePageTitle';
import { getPostPath } from '../utils/postPath';

type FilterId = 'all' | string;

export function HomePage() {
  const categories = useMemo(() => getUsedCategories(), []);
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const post of posts) {
      counts[post.category] = (counts[post.category] ?? 0) + 1;
    }
    return counts;
  }, []);
  const [active, setActive] = useState<FilterId>('all');

  const visiblePosts = useMemo(() => {
    if (active === 'all') return posts;
    return posts.filter((post) => post.category === active);
  }, [active]);

  const [featured, ...rest] = visiblePosts;
  const activeLabel =
    active === 'all'
      ? '全部'
      : categories.find((category) => category.id === active)?.label ?? active;

  usePageTitle();

  return (
    <section className="home">
      <header className="hero">
        <p className="hero-kicker">{SITE.subtitle}</p>
        <h1 className="hero-brand">{SITE.title}</h1>
        <p className="hero-desc">{SITE.description}</p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#posts">
            浏览文章
          </a>
          <a
            className="btn btn-ghost"
            href={SITE.links.juejin}
            target="_blank"
            rel="noopener noreferrer"
          >
            掘金主页
          </a>
        </div>
      </header>

      <div id="posts" className="posts-toolbar">
        <div className="posts-heading">
          <h2>文章列表</h2>
          <p>
            {active === 'all'
              ? `共 ${posts.length} 篇，按时间倒序`
              : `「${activeLabel}」· ${visiblePosts.length} 篇`}
          </p>
        </div>

        <div className="category-filter" role="tablist" aria-label="文章分类">
          <button
            type="button"
            role="tab"
            aria-selected={active === 'all'}
            className={active === 'all' ? 'category-tab is-active' : 'category-tab'}
            onClick={() => setActive('all')}
          >
            全部
            <span>{posts.length}</span>
          </button>
          {categories.map((category) => {
            const count = categoryCounts[category.id] ?? 0;
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={active === category.id}
                className={active === category.id ? 'category-tab is-active' : 'category-tab'}
                onClick={() => setActive(category.id)}
                title={category.description}
              >
                {category.label}
                <span>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {visiblePosts.length === 0 ? (
        <p className="empty-state" role="status">
          该分类下暂无文章。
        </p>
      ) : (
        <div className="post-feed">
          {featured && (
            <article className="featured-post">
              <div className="featured-post-meta">
                <span className="category-badge">{featured.categoryLabel}</span>
                <time dateTime={featured.date}>{featured.date}</time>
                <span className="featured-label">最新</span>
              </div>
              <h3>
                <Link to={getPostPath(featured.id)}>{featured.title}</Link>
              </h3>
              <p>{featured.excerpt}</p>
              <Link className="read-more" to={getPostPath(featured.id)}>
                阅读全文
                <span aria-hidden="true">→</span>
              </Link>
            </article>
          )}

          {rest.length > 0 && (
            <div className="post-grid">
              {rest.map((post, index) => (
                <PostCard
                  key={post.id}
                  post={post}
                  style={{ '--i': index } as CSSProperties}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
