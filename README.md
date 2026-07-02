# 牧艺的技术博客

基于 Vite + React 构建的个人技术博客站点，文章源码存放在 `blogs/` 目录，部署在 GitHub Pages。

## 本地开发

```bash
pnpm install
pnpm dev
```

## 构建

```bash
pnpm build
pnpm preview
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

## GitHub Pages 配置（重要）

本项目使用 **GitHub Actions** 部署，不要用「从分支部署」。

请在仓库设置中确认：

1. 打开 [Settings → Pages](https://github.com/jiaxiantao/blogs/settings/pages)
2. **Build and deployment → Source** 选择 **GitHub Actions**（不是 Deploy from a branch）
3. 保存后，到 [Actions](https://github.com/jiaxiantao/blogs/actions) 重新运行 `Deploy to GitHub Pages` 工作流

如果 Source 误设为 `main` 分支的 `/docs` 目录，会出现两类错误：

- Actions 部署报 `404 Failed to create deployment`
- Jekyll 构建报 `No such file or directory - /github/workspace/docs`
