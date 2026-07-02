import { Link, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div className="site">
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">M</span>
            <span>
              <strong>牧艺的技术博客</strong>
              <small>前端 · 3D · AI Agent</small>
            </span>
          </Link>
          <nav className="header-nav">
            <a href="https://juejin.cn/user/3958672823687880" target="_blank" rel="noreferrer">
              掘金
            </a>
            <a href="https://github.com/jiaxiantao" target="_blank" rel="noreferrer">
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
          <p>© {new Date().getFullYear()} 牧艺 · 基于 Vite 构建 · 部署于 GitHub Pages</p>
        </div>
      </footer>
    </div>
  );
}
