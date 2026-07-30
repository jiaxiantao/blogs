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
blogs/                      # Markdown 文章（按主题分子目录）
  ai-agent/                 # AI Agent / Cursor / MCP
  cos-design/               # cos-design 组件库
  3d/                       # 浏览器 3D / Canvas
  frontend/                 # 前端工程与趋势
src/
  components/               # 布局、文章卡片、Markdown 渲染
  constants/
    site.ts                 # 站点名称、链接等配置
    categories.ts           # 分类目录登记
  data/posts.ts             # 文章索引（递归加载 blogs/**/*.md）
  lib/markdown.ts           # Markdown 解析与消毒
  pages/                    # 首页、文章详情页
  types/                    # 类型定义
  utils/                    # 文章解析、路由工具
.github/workflows/          # GitHub Actions 部署配置
```

## 文章分类

| 目录 | 展示名 | 说明 |
|------|--------|------|
| `blogs/ai-agent/` | AI Agent | Tool Calling、MCP、Context Engineering、Cursor |
| `blogs/cos-design/` | cos-design | 视觉特效组件库实践 |
| `blogs/3d/` | 3D 可视化 | 浏览器 3D、Canvas、仓储可视化 |
| `blogs/frontend/` | 前端工程 | 前端趋势与工程实践 |

- 新增分类：创建目录 `blogs/<category-id>/`，并在 `src/constants/categories.ts` 登记
- **文件名仍需全局唯一**（用于旧链接兼容）

## 文章编号与 URL

每篇文章有稳定唯一的 ID（UUID v4 去掉连字符后截取前 16 位），站点内链接一律使用它。  
ID 写在 Markdown **HTML 注释**中，页面不会展示：

```markdown
<!-- post-id: 577666966ba346cb -->

# 文章标题

> 发布日期：2026-07-02
> 标签：前端 / Cursor / AI 编程

## 正文从这里开始
```

| 类型 | 示例 | 行为 |
|------|------|------|
| 规范链接 | `/post/577666966ba346cb` | 首页、站内跳转默认使用 |
| 旧链接兼容 | `/post/Context-Engineering-从Prompt到Agent上下文系统` | 仍可打开，并自动跳到规范 ID |

规则：

- 格式固定为 16 位小写十六进制
- **全局唯一**，且不要随文件名改动而变更
- 若缺少 ID，系统会临时回退到文件名（不推荐上线）

可运行以下命令为所有缺少编号的文章自动补齐，并把旧的 `> 文章编号：` 迁移为注释：

```bash
pnpm posts:assign-ids
```

该命令不会修改已有合法注释 ID。

## 如何发布新文章

1. 在对应分类目录新建 `.md` 文件
2. 填写 `文章编号`、发布日期与标签（见上）
3. 提交并推送到 `main` 分支，GitHub Actions 会自动构建并部署

```bash
git add blogs/ai-agent/你的新文章.md
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

## License

MIT
