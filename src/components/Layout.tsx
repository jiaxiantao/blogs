import { Link, Outlet } from 'react-router-dom';
import { SITE } from '../constants/site';

export function Layout() {
  return (
    <div className="site">
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">M</span>
            <span>
              <strong>{SITE.title}</strong>
              <small>{SITE.subtitle}</small>
            </span>
          </Link>
          <nav className="header-nav">
            <a href={SITE.links.juejin} target="_blank" rel="noreferrer">
              掘金
            </a>
            <a href={SITE.links.github} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="site-main container">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container">
          <p>
            © {new Date().getFullYear()} {SITE.author} · 基于 Vite 构建 ·{' '}
            <a href={SITE.links.repo} target="_blank" rel="noreferrer">
              GitHub Pages
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
