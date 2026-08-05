import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** 路由切换时滚回顶部，避免从长文返回列表仍停在页面中部 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
