# 牧艺的技术博客

个人技术博客站点，聚合我在掘金发布的文章，涵盖前端工程、3D 可视化、AI Agent 等主题。

**在线访问**：[https://jiaxiantao.github.io/blogs/](https://jiaxiantao.github.io/blogs/)  
**掘金主页**：[juejin.cn/user/3958672823687880](https://juejin.cn/user/3958672823687880)

## 技术栈

- [Vite](https://vite.dev/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [React Router](https://reactrouter.com/) — 客户端路由
- [marked](https://marked.js.org/) + [DOMPurify](https://github.com/cure53/DOMPurify) — Markdown 渲染与安全过滤
- [pnpm](https://pnpm.io/) — 包管理
- [GitHub Actions](https://github.com/features/actions) + [GitHub Pages](https://pages.github.com/) — 自动构建与部署

## 快速开始

```bash
# 安装依赖
pnpm install

# 本地开发（默认 http://localhost:5173/blogs/）
pnpm dev

# 生产构建
pnpm build

# 预览构建产物
pnpm preview
```

## 项目结构

```text
blogs/                    # Markdown 文章（构建时自动加载）
src/
  components/               # 布局、文章卡片、Markdown 渲染
  constants/site.ts         # 站点名称、链接等配置
  data/posts.ts             # 文章索引
  lib/markdown.ts           # Markdown 解析与消毒
  pages/                    # 首页、文章详情页
  types/                    # 类型定义
  utils/                    # 文章解析、路由工具
.github/workflows/          # GitHub Actions 部署配置
```

## 如何发布新文章

1. 在 `blogs/` 目录新建 `.md` 文件（文件名即 URL slug）
2. 文章开头建议包含标题与元信息：

```markdown
# 文章标题

> 发布日期：2026-07-02  
> 标签：前端 / Cursor / AI 编程

## 正文从这里开始
```

3. 提交并推送到 `main` 分支，GitHub Actions 会自动构建并部署

```bash
git add blogs/你的新文章.md
git commit -m "新增文章：xxx"
git push origin main
```

部署进度可在 [Actions](https://github.com/jiaxiantao/blogs/actions) 查看。

## 部署说明

本项目通过 **GitHub Actions** 部署到 GitHub Pages，不使用「从分支部署」。

仓库 Settings → Pages → **Source** 需设置为 **GitHub Actions**。推送 `main` 分支后，工作流 `Deploy to GitHub Pages` 会自动执行：

```text
pnpm install → pnpm build → 上传 dist/ → 发布到 GitHub Pages
```

## 文章系列

| 主题 | 代表文章 |
|------|---------|
| AI 工程实践 | Cursor 使用复盘、MCP 工作流、Code Review 指南 |
| 职业成长 | 不可替代竞争力、转型 AI Agent 工程师 |
| 3D 可视化 | 快递仓储可视化、浏览器端 3D 看车 |
| 开源项目 | cos-design 组件库、Home Agent 前端编排 |

## License

MIT
