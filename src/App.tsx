import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ScrollToTop } from './components/ScrollToTop';
import { SITE } from './constants/site';
import { HomePage } from './pages/HomePage';
import { PostPage } from './pages/PostPage';

export function App() {
  return (
    <BrowserRouter basename={SITE.basePath}>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="post/:slug" element={<PostPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
