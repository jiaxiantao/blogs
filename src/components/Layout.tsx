import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { posts } from '../data/posts';
import { SITE } from '../constants/site';

export function Layout() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="site">
      <div className="site-atmosphere" aria-hidden="true" />

      <header className={scrolled ? 'site-header is-scrolled' : 'site-header'}>
        <div className="container header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden="true">
              牧
            </span>
            <span className="brand-text">
              <strong>{SITE.title}</strong>
              <small>{SITE.subtitle}</small>
            </span>
          </Link>
          <nav className="header-nav" aria-label="站外链接">
            <a href={SITE.links.juejin} target="_blank" rel="noopener noreferrer">
              掘金
            </a>
            <a href={SITE.links.github} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="site-main container">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-brand">
            <strong>{SITE.author}</strong>
            <span>{SITE.subtitle}</span>
          </div>
          <p className="footer-meta">
            © {new Date().getFullYear()} · 已收录 {posts.length} 篇 ·{' '}
            <a href={SITE.links.repo} target="_blank" rel="noopener noreferrer">
              GitHub Pages
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
