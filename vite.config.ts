import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Vite base 带尾斜杠时，访问 /blogs 会提示配置页；开发态自动跳到 /blogs/ */
function redirectBaseWithoutSlash(): Plugin {
  return {
    name: 'redirect-base-without-slash',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/blogs') {
          res.statusCode = 302;
          res.setHeader('Location', '/blogs/');
          res.end();
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  base: '/blogs/',
  plugins: [react(), redirectBaseWithoutSlash()]
});
