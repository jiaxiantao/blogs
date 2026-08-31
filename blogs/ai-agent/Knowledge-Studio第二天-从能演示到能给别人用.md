<!-- post-id: 67cc5d58a1b444ab -->

# Knowledge Studio 第二天：从「能演示」到「能给别人用」

> 发布日期：2026-08-07\
> 标签：RAG / Knowledge Studio / 鉴权 / API Key / Docker / 工程实践\
> 项目：[jiaxiantao/knowledge-studio](https://github.com/jiaxiantao/knowledge-studio)\
> 前情：[Knowledge Studio 本地开源版：架构、重难点与差异](https://jiaxiantao.github.io/blogs/post/f8e8e6dc62a84682)

昨天那篇把 [Knowledge Studio](https://github.com/jiaxiantao/knowledge-studio) 的 RAG 主链路拆开了：上传、切片、pgvector 召回、SSE 问答。

跑通之后，下一个问题立刻冒出来——

> **这套东西只能我自己本机玩，还是真的能交给同事 / 内网 / 外部系统用？**

今天这篇就是「第二天」的答案：补上**多用户隔离**、**对外 API Key**、**Docker 全栈一键部署**，以及一个差点把流式体验毁掉的 **Qwen3 reasoning 字段**坑。

全文约 12 分钟。建议先看过 [架构篇](https://jiaxiantao.github.io/blogs/post/f8e8e6dc62a84682)，再读这篇「产品化补丁」。

***

## 先建立直觉：Demo 和控制台之间差什么

![ks-day2-demo-to-deploy.jpg](https://jiaxiantao.github.io/blogs/images/knowledge-studio/ks-day2-demo-to-deploy.jpg)

> 🎭 *左边：一个人本机跑通。右边：同事能登录、系统能调 API、机房能整包搬走。*

| 昨天（架构篇）的状态                         | 今天补上的能力                              |
| ---------------------------------- | ------------------------------------ |
| 无登录，数据全局共享                         | JWT 登录 + 按用户隔离知识库/文档/会话              |
| 只有浏览器里点问答                          | `POST /api/v1/apps/chat` + API Key   |
| `docker compose` 只起 DB，Ollama 绑宿主机 | `profile: full` 一键 db + ollama + web |
| 检索/meta 先出来，正文空等数秒                 | 兼容 `delta.reasoning`，思考过程立刻流式        |

中间还夹了一轮「检索质量升级」（混合检索、父子切片、评测集）——那是 **8 月 6 日下午到晚间** 的事；**8 月 7 日** 的重点是：**把控制台从个人玩具变成可交付形态**。

***

## 一、多用户鉴权：不是加了个登录页那么简单

### 问题

原先任何人打开 `localhost:3000` 都能看到全部知识库。演示还行，一旦：

*   两个同事各建各的库 → 互相覆盖、误删
*   想在内网给团队用 → 没有「谁的数据归谁」

就没法继续。

### 方案

1.  **`User` 模型** + 知识库 / 会话挂 `userId`
2.  **自建 JWT**（`AUTH_JWT_SECRET`），客户端 `localStorage` 存 token，请求带 `Authorization: Bearer`
3.  **登录即注册**：账号不存在就创建，降低内网首次使用门槛
4.  **业务 API 统一按归属过滤**：list / upload / chat / delete 都走同一套 ownership 校验
5.  **无主旧数据**：首个登录用户自动认领（迁移友好）

未登录仍可浏览壳层；登录后只见本人数据。分享页 `/assistant/share?id=` 保持只读公开——这是刻意的「链接分享」例外。


![image.png](https://jiaxiantao.github.io/blogs/images/knowledge-studio/02.webp)

### 生产校验

Docker 全栈模式下，若 `AUTH_JWT_SECRET` 仍是 `change-me` 或太短，**启动直接拒绝**——Demo 可以偷懒，内网部署不行。

***

## 二、对外 API：控制台问答抽成 `runChatAnswer`

### 问题

百炼 Knowledge Studio 卖点之一是「发布后 API / MCP / CLI 都能调」。本地版若只有 JWT 控制台，外部 Agent、脚本、别的服务都接不进来。

### 方案：双入口，一条核心

![ks-dual-entry-api.jpg](https://jiaxiantao.github.io/blogs/images/knowledge-studio/ks-dual-entry-api.jpg)

> 🎭 *浏览器走 JWT，外部系统走 API Key；底下是同一套 `runChatAnswer`。*

把原先散落在 `POST /api/chat` 里的检索 + 生成逻辑抽到 `runChatAnswer()`：

| 入口    | 鉴权      | 路径                       |
| ----- | ------- | ------------------------ |
| 控制台问答 | JWT     | `POST /api/chat`         |
| 外部应用  | API Key | `POST /api/v1/apps/chat` |

外部接口形态（对齐百炼「应用 + agent\_id」心智）：

```bash
curl -X POST 'http://localhost:3000/api/v1/apps/chat' \
  -H 'Authorization: Bearer sk-ks-xxxxxxxx' \
  -H 'Content-Type: application/json' \
  -d '{
    "input": {
      "agent_id": ["kb_id_1", "kb_id_2"],
      "messages": [
        { "role": "user", "content": "混合检索和纯向量各适合什么场景？" }
      ]
    },
    "parameters": { "stream": true }
  }'
```

要点：

*   **`agent_id`** = 知识库 ID（字符串或数组，最多 15 个）——多库联合问答与控制台一致
*   **Key 只存 SHA-256 哈希**，明文仅在创建/重置时展示一次
*   **限流**：默认每 Key **30 次/分钟**（`API_CHAT_RATE_LIMIT_RPM`），超限 `429` + `Retry-After`
*   **归属校验**：Key 只能访问该用户名下的知识库
*   **CORS**：内网跨域时配 `CORS_ORIGINS`

开发者页面：

*   `/developer/keys` — Key CRUD / 启用禁用 / 重置
*   `/developer/playground` — 填 Key + 多选知识库，JSON / SSE 调试


![image.png](https://jiaxiantao.github.io/blogs/images/knowledge-studio/04.webp)


![image.png](https://jiaxiantao.github.io/blogs/images/knowledge-studio/05.webp)

这和百炼「控制台配置问答服务 → 发布 → API 集成」是同一产品节奏；差别是本地版第一版就给了 **Bearer Key + 限流 + 归属**，没有假装有 MCP/CLI（后续可加）。

***

## 三、Docker 全栈：本机跑通，`.env` 拷走就能上内网

### 问题

昨天的开发姿势是：

```bash
docker compose up -d db    # 只起库
pnpm dev                   # 宿主机 Next
ollama serve               # 宿主机模型
```

对新同事意味着：**Node 版本、Ollama、pgvector、环境变量** 四套依赖要对齐。搬到公司小机房更麻烦——Ollama 绑宿主机，Compose 文件不完整。

### 方案：`profile: full`

| 服务            | 作用                                    |
| ------------- | ------------------------------------- |
| `db`          | PostgreSQL + pgvector，端口仅 `127.0.0.1` |
| `ollama`      | 容器内跑对话 + embedding                    |
| `ollama-init` | 首次拉 `qwen3` / `nomic-embed-text`      |
| `migrate`     | `prisma db push` + seed               |
| `web`         | Next.js standalone                    |

```bash
cp .env.docker.example .env
# 改 AUTH_JWT_SECRET、POSTGRES_PASSWORD、NEXT_PUBLIC_SITE_URL …
docker compose --profile full up --build -d
```

**macOS 提示**：不必买 Docker Desktop，[Colima](https://github.com/abiosoft/colima) 免费够用（项目里有 `scripts/setup-colima.sh`）。

内网给同事用，核心就改一行：

```env
NEXT_PUBLIC_SITE_URL=http://192.168.1.23:3000
```

防火墙只放行 `WEB_PORT`，**不要把 5432 暴露到局域网**（compose 已绑回环）。

迁移清单（文档 `docs/deploy-local-intranet.md`）：

| Volume          | 内容                |
| --------------- | ----------------- |
| `postgres-data` | 业务库 + 用户 + Key 哈希 |
| `ollama-data`   | 已拉模型              |
| `uploads-data`  | 上传原文件             |


![image.png](https://jiaxiantao.github.io/blogs/images/knowledge-studio/01.webp)

健康检查：`GET /api/health` — `ok` 表示库可用，`ready` 表示库 + Ollama 都可达。

***

## 四、重难点：Qwen3 流式「检索立刻有、正文空等数秒」

这是今天最「前端能感知」的 bug，也最值得写进博客。

### 现象

SSE 顺序设计没问题：先 `references` / `meta`，再 `chunk*`。但实际体验是——**引用和置信度秒出，正文气泡空白 3～8 秒**，用户以为卡死了。

### 原因

Ollama 上的 **Qwen3 等思考模型**，OpenAI 兼容流里经常把推理写在：

```typescript
delta.reasoning        // 或
delta.reasoning_content  // 而不是 delta.content
```

旧逻辑只读 `delta.content`。思考阶段全部被丢弃，直到模型开始输出结论，`content` 才有字——于是出现「空窗」。

### 方案：`normalizeLlmStream`

在 `ai-service.ts` 里统一做字段映射：

```typescript
/**
 * Ollama qwen3 等思考模型常把推理写在 delta.reasoning，content 延后才有字。
 * 将其映射为项目已有的 <thinking>/<conclusion> 标签，避免流式「空等数秒」。
 */
async function* normalizeLlmStream(stream) {
  // reasoning → 包进 <thinking>
  // 首个 content → 关 thinking、开 <conclusion>
  // 后续 content → 直接 yield
}
```

检索完成后额外发 `status: generating`，UI 在等第一个 chunk 时显示「正在生成…」，空窗感再降一档。

### 教训

**Agent / RAG 产品的流式协议，不能假设所有模型都走 `delta.content`。**

同一套 `<thinking>/<conclusion>` UI，底层可能要适配：

| 来源             | 思考字段                | 结论字段                 |
| -------------- | ------------------- | -------------------- |
| Prompt 约束的标签输出 | 模型自己吐 `<thinking>`  | 模型自己吐 `<conclusion>` |
| Qwen3 @ Ollama | `delta.reasoning`   | `delta.content`      |
| 部分 OpenAI 兼容   | `reasoning_content` | `content`            |

前端解析器（`parseAssistantAnswer`）负责「展示层容错」；**服务层还要做「协议层归一」**，否则 UI 再漂亮也会被空流坑。


![image.png](https://jiaxiantao.github.io/blogs/images/knowledge-studio/02.webp)

***

## 五、和昨天相比，产品形态变了吗？

| 能力   | 架构篇（8/6）    | 今天（8/7）                               |
| ---- | ----------- | ------------------------------------- |
| 检索   | 纯向量为主       | 混合检索 + 父子切片（6 日已上）                    |
| 评测   | 无           | `/retrieval/eval` Hit\@K / MRR（6 日已上） |
| 鉴权   | 无           | JWT 多用户                               |
| 对外集成 | 无           | API Key + v1 chat                     |
| 部署   | 开发态 Compose | 全栈 profile + 内网文档                     |
| 流式体验 | 有空窗 bug     | reasoning 字段归一                        |

一句话：**昨天证明「RAG 控制台能跑」；今天证明「能交给别人用」。**

和百炼 Knowledge Studio 的对照也更有意思了——

| 百炼                         | 本地版（截至 8/7）                    |
| -------------------------- | ------------------------------ |
| 平台 IAM + 业务空间              | JWT + 用户级数据隔离                  |
| 发布问答服务 → API Key           | `/api/v1/apps/chat` + `sk-ks-` |
| 托管 Serverless              | Docker full profile 自运维        |
| MCP / CLI / Agentic Search | 尚未实现（API 第一期已通）                |

本地版仍不是企业替代品，但**产品节奏**已经对齐：控制台配库 → 检索试跑 → 问答验证 → **Key 发布给外部**。

***

## 六、我若再排一期，会先做什么

1.  **MCP Server** — 让 Cursor / Claude Code 直接调知识库（百炼 RAG 4.0 的主打集成方式）
2.  **队列化 ingest** — 把 `after()` 换成持久任务，OCR 长跑不绑 web 进程
3.  **API Key 按库授权** — 现在 Key 是用户级，细粒度到「只能调某几个 KB」
4.  **评测进 CI** — 改 Prompt / 融合权重前先跑 `/retrieval/eval` 门禁（呼应 [Agent Eval 篇](https://jiaxiantao.github.io/blogs/post/03f4e19f50af4b55)）

***

## 快速上手（全栈模式）

```bash
git clone https://github.com/jiaxiantao/knowledge-studio.git
cd knowledge-studio
cp .env.docker.example .env
# 编辑 JWT 密钥与 SITE_URL

docker compose --profile full up --build -d
docker compose --profile full logs -f ollama-init   # 等模型拉完

open http://localhost:3000    # 注册 → 建库 → 上传 → 问答
# 开发者 → API Keys → Playground 试外部调用
```

部署细节见仓库 [`docs/deploy-local-intranet.md`](https://github.com/jiaxiantao/knowledge-studio/blob/main/docs/deploy-local-intranet.md)。

***

## 小结

Knowledge Studio 的「第二天」没有加花哨功能，而是补了三个**交付级**缺口：

1.  **谁能看到哪些数据**（JWT + 隔离）
2.  **谁能从外部调问答**（API Key + 限流 + 双入口复用）
3.  **谁能一键跑起来**（Docker full + 内网迁移文档）

再加一个隐蔽但关键的流式修复：**别假设模型只往 `content` 里写字。**

如果你也在做本地 RAG 控制台，建议用这张 checklist 自测：

*   [ ] 未登录 / 登录 / 跨用户访问，数据是否隔离
*   [ ] 控制台与 API 是否共用同一套检索+生成逻辑
*   [ ] Key 泄露面：哈希存储、重置、限流、归属
*   [ ] 换思考模型后，SSE 是否仍「秒有反馈」
*   [ ] 本机 Compose 能否在不改代码的情况下迁到内网 IP

云端 Knowledge Studio 卖的是「省运维」；本地版卖的是**把交付链路走一遍**。两者叠在一起读，你会更清楚 SaaS 按钮背后到底藏了什么。

仓库：[github.com/jiaxiantao/knowledge-studio](https://github.com/jiaxiantao/knowledge-studio)

***
