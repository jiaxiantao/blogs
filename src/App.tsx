import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SITE } from './constants/site';
import { HomePage } from './pages/HomePage';
import { PostPage } from './pages/PostPage';

export function App() {
  return (
    <BrowserRouter basename={SITE.basePath}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="post/:slug" element={<PostPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
