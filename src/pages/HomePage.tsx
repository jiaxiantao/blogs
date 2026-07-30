import { useMemo, useState } from 'react';
import { PostCard } from '../components/PostCard';
import { SITE } from '../constants/site';
import { getUsedCategories, posts } from '../data/posts';

type FilterId = 'all' | string;

export function HomePage() {
  const categories = useMemo(() => getUsedCategories(), []);
  const [active, setActive] = useState<FilterId>('all');

  const visiblePosts = useMemo(() => {
    if (active === 'all') return posts;
    return posts.filter((post) => post.category === active);
  }, [active]);

  return (
    <section className="home">
      <div className="hero">
        <p className="eyebrow">Blog Archive</p>
        <h1>{SITE.description}</h1>
        <p className="hero-desc">
          共 {posts.length} 篇文章，按主题分类持续更新。
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
          const count = posts.filter((post) => post.category === category.id).length;
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

      <div className="post-grid">
        {visiblePosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
