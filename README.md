# 牧艺的技术博客

基于 Vite + React 构建的个人技术博客站点，文章源码存放在 `blogs/` 目录，部署在 GitHub Pages。

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
npm run preview
```

## 目录结构

```text
blogs/          # Markdown 文章
src/            # 前端站点源码
.github/        # GitHub Actions 自动部署
```

## 在线地址

部署完成后访问：

https://jiaxiantao.github.io/blogs/

## 发布流程

1. 将新文章放入 `blogs/` 目录
2. 提交并推送到 `main` 分支
3. GitHub Actions 自动构建并发布到 GitHub Pages
