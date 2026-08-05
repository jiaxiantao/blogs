import { useMemo, useState } from 'react';
import { PostCard } from '../components/PostCard';
import { SITE } from '../constants/site';
import { getUsedCategories, posts } from '../data/posts';
import { usePageTitle } from '../hooks/usePageTitle';

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

  const activeLabel =
    active === 'all'
      ? '全部'
      : categories.find((category) => category.id === active)?.label ?? active;

  usePageTitle();

  return (
    <section className="home">
      <div className="hero">
        <p className="eyebrow">Blog Archive</p>
        <h1>{SITE.description}</h1>
        <p className="hero-desc">
          {active === 'all'
            ? `共 ${posts.length} 篇文章，按主题分类持续更新。`
            : `「${activeLabel}」分类下共 ${visiblePosts.length} 篇。`}
        </p>
      </div>

      <div className="category-filter" role="tablist" aria-label="文章分类">
        <button
          type="button"
          role="tab"
          aria-selected={active === 'all'}
          className={active === 'all' ? 'category-chip is-active' : 'category-chip'}
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
              className={active === category.id ? 'category-chip is-active' : 'category-chip'}
              onClick={() => setActive(category.id)}
              title={category.description}
            >
              {category.label}
              <span>{count}</span>
            </button>
          );
        })}
      </div>

      {visiblePosts.length === 0 ? (
        <p className="empty-state" role="status">
          该分类下暂无文章。
        </p>
      ) : (
        <div className="post-grid">
          {visiblePosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </section>
  );
}
