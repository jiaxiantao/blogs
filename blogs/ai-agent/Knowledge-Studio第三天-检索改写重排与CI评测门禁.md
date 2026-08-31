<!-- post-id: 4c2b2bbb42d945c7 -->

# Knowledge Studio 第三天：检索改写 / 重排、入库自愈与 CI 评测门禁

> 发布日期：2026-08-10\
> 标签：RAG / Knowledge Studio / Query Rewrite / Rerank / Eval / 内网部署 / 工程实践\
> 项目：[jiaxiantao/knowledge-studio](https://github.com/jiaxiantao/knowledge-studio)\
> 系列：[架构篇](https://jiaxiantao.github.io/blogs/post/f8e8e6dc62a84682) · [第二天（鉴权 / API / Docker）](https://jiaxiantao.github.io/blogs/post/67cc5d58a1b444ab)

前两篇把 Knowledge Studio 做成了「能跑的 RAG 控制台」和「能给同事用的内网交付物」。

第三天要回答的问题更硬：

> **改了切分、融合、Prompt 之后，你怎么证明没回退？内网给真人用，还缺哪些不丢人的安全底线？**

今天两件事绑在一起写：

1.  **检索质量链路**：查询改写 → 混合融合 → 可选重排；入库并发 + 开机自愈；`pnpm eval:ci` 进 GitHub Actions
2.  **内网产品化加固**：注册门禁、httpOnly Cookie、分享 HMAC、migrate、限流

全文约 14 分钟。建议先看过 [第二天](https://jiaxiantao.github.io/blogs/post/67cc5d58a1b444ab)，再读这篇「守住质量 + 守住边界」。

***

## 系列到哪一步了

![ks-day3-quality-gate.jpg](https://jiaxiantao.github.io/blogs/images/knowledge-studio/ks-day3-quality-gate.jpg)

> 🎭 *Day1 摊开链路；Day2 能登录、能调 API、能整包部署；Day3 用评测门禁和内网加固，把「感觉更好」变成「可回归、可给真人用」。*

| 天        | 证明什么            | 关键词                                             |
| -------- | --------------- | ----------------------------------------------- |
| Day1     | RAG 控制台主路径是真的   | 上传 / OCR / pgvector / SSE                       |
| Day2     | 能交给别人用          | JWT / API Key / Docker full                     |
| **Day3** | **改动能回归；内网不裸奔** | **改写 / 重排 / eval:ci / 邀请码 / Cookie / 分享 token** |

这也呼应我在 [Agent Eval 篇](https://jiaxiantao.github.io/blogs/post/03f4e19f50af4b55) 写过的那句：

> 单元测试管确定性代码；Agent / RAG 管的是概率系统。没有评测集，每次「优化」都是开盲盒。

***

## 一、检索链路：从「一次向量 topK」到「可讲清的四步」

混合检索在 8 月 6 日就上了。今天补的是**前后两头**：入口的查询改写，出口的可选重排。

![ks-retrieval-pipeline.jpg](https://jiaxiantao.github.io/blogs/images/knowledge-studio/ks-retrieval-pipeline.jpg)

> 🎭 *问答与检索工作台走完整管线；评测故意走原始 `searchChunks`，避免改写把 Hit\@K「化妆」好看。*

产品里固定成六步说明（`RETRIEVAL_FUSION_STEPS`）：

| 步骤      | 做什么                                                      |
| ------- | -------------------------------------------------------- |
| 1. 查询改写 | LLM 把闲聊式短问改成检索向短查询（默认开，`RAG_QUERY_REWRITE`）              |
| 2. 两路召回 | 向量（pgvector）+ 关键词（pg\_trgm）                              |
| 3. 阈值过滤 | 向量 ≥ `RAG_MIN_SCORE` **或** 关键词 ≥ `RAG_KEYWORD_MIN_SCORE` |
| 4. 融合打分 | `score = w·vector + (1−w)·keyword`（默认 w=0.6）             |
| 5. 可选重排 | LLM listwise 打分（默认关，`RAG_RERANK`）                        |
| 6. 统一排序 | 按最终分截断 topK；父子切片命中子块后展开父块                                |

核心入口是 `searchChunksWithPipeline`：

```typescript
// 伪代码结构
const rewritten = await rewriteQueryForRetrieval(originalQuery, { history });
const { results } = await searchChunks(rewritten.query, retrieveK, kbIds);
const reranked = await maybeRerankChunks(originalQuery, results, { topK });
// meta 带回 rewriteApplied / rewrittenQuery / rerankApplied
```

注意两个细节：

1.  **改写用「检索向」查询，重排仍对照「用户原问」**——改写是为了召回，重排是为了相关性，别混成一个目标。
2.  **开重排时先多召一批**（约 `topK * 3`，上限 40），再截断——否则 listwise 没有池子可排。

![image.png](https://jiaxiantao.github.io/blogs/images/knowledge-studio/03.webp)

### 为什么默认开改写、默认关重排？

| 开关                  | 默认    | 原因                                   |
| ------------------- | ----- | ------------------------------------ |
| `RAG_QUERY_REWRITE` | **开** | 短问、指代、口语追问对向量很伤；一次小 LLM 调用换召回面，延迟可接受 |
| `RAG_RERANK`        | **关** | listwise 对候选再调一次模型，延迟与稳定性都更贵；需要质量时再开 |

改写失败或 LLM 不可用时**静默回退原问**——检索链路不能因为「帮忙优化」而整条挂掉。

***

## 二、CI 评测门禁：无 Ollama 也能证明「没回退」

Day2 之后最大的工程焦虑是：切分、融合权重、门槛一改，手感可能更好，也可能悄悄漏召。

控制台已有 `/retrieval/eval`（真实语料 Hit\@K / MRR / 拒答率）。今天补的是 **CI 可跑的硬门禁**：

```bash
RAG_EVAL_EMBED_STUB=1 pnpm eval:ci
```

做法：

1.  **Stub embedding** —— CI 不拉 Ollama，用确定性伪向量，保证同输入同输出
2.  **合成语料** —— 临时建知识库 + 固定 chunk，测完删掉
3.  **断言** —— `passRate === 1` 且 `hitAtK === 1`，否则 workflow 红
4.  **纯函数守卫** —— 顺带断言 `fuseRetrievalScore` 的加权公式（无 DB）

更关键的产品决策：

> **评测走原始 `searchChunks`，不走改写管线。**

否则改写可能把「本该失败的短问」洗成好查的句子，门禁虚高。线上问答可以智能；回归基线必须诚实。

![image.png](https://jiaxiantao.github.io/blogs/images/knowledge-studio/04.webp)

![image.png](https://jiaxiantao.github.io/blogs/images/knowledge-studio/05.webp)

这也和 Agent Eval 篇的最小闭环对齐：**case → 断言 → 门禁 → 失败回流**。RAG 这边至少先把「召回契约」钉死。

***

## 三、入库并发与开机自愈：`after()` 的诚实补丁

Day1 就坦白过：进程内 `after()` + 内存 Set **不是** durable job queue。今天没有假装换成 Kafka，而是把单机场景补到「不容易丢人」：

| 能力   | 做法                                                                                                   |
| ---- | ---------------------------------------------------------------------------------------------------- |
| 并发上限 | `INGEST_CONCURRENCY`（默认 2）信号量，避免多份大 PDF OCR 打满进程                                                     |
| 排队心跳 | 等待中的文档持续刷新 `updatedAt`，别被误判卡住                                                                        |
| 开机回收 | `instrumentation.ts` 启动时 `recoverAndResumeStuckDocuments`：超时 pending/parsing 强制重排队 + 拉起仍 pending 的任务 |

```typescript
// Next.js instrumentation（nodejs runtime）
assertProductionAuthSecret();
void recoverAndResumeStuckDocuments(20);
```

这和 Docker 全栈重启天然配套：web 容器起来，未完成入库有机会自己接着跑，而不是永远停在 12%。

仍不是生产调度——多副本抢同一文档、跨机器队列，以后再说。但\*\*「重启就丢任务」这条最扎心的坑，先堵上。\*\*

![image.png](https://jiaxiantao.github.io/blogs/images/knowledge-studio/01.webp)

***

## 四、内网产品化：Day2「能登录」不够，还要「不裸奔」

Day2 上了 JWT + API Key，内网给同事用时仍偏演示：

*   谁都能自注册
*   token 塞 `localStorage` / 甚至 SSE URL，XSS 与日志泄露面大
*   分享会话公开可读
*   `db push --accept-data-loss` 升级吓人
*   登录 / 问答无限流

今天按「可信局域网」补了一轮：

### 1. 注册门禁

优先级写死在 `assertCanCreateAccount`：

1.  **空库首账号** —— 永远允许（引导创建管理员）
2.  **正确的 `AUTH_INVITE_CODE`**
3.  **`AUTH_ALLOW_REGISTER=1`**（默认开，方便开源 Demo；内网建议关）

```env
AUTH_ALLOW_REGISTER=0
AUTH_INVITE_CODE=your-team-invite
```

### 2. httpOnly Cookie 会话

会话改走 `ks_session`（HttpOnly、SameSite=Lax；HTTPS 下 Secure），**仍兼容 Bearer**，方便 API / 脚本。

SSE 问答不再把 token 拼进 URL——EventSource 不能自定义 Header，以前是常见脏招；现在靠 Cookie 携带，链路更干净。

### 3. 分享链接 HMAC

默认关闭公开分享（`CHAT_SHARE_PUBLIC` 不为真）。分享 URL 带 HMAC `t`：

```typescript
createHmac("sha256", AUTH_JWT_SECRET)
  .update(`chat-share:${sessionId}`)
  .digest("base64url")
  .slice(0, 32);
```

无 DB 额外字段、校验用 `timingSafeEqual`。Demo 需要裸链时再显式打开公开模式。

### 4. 升级走迁移，不走危险 push

`db:setup` / Compose `migrate` 改为 **`prisma migrate deploy` + baseline**，告别「接受数据丢失」的升级路径。

### 5. 限流 + 安全头 + Caddy

登录 / 问答加基础限流；Next 补安全响应头；部署文档给 Caddy HTTPS 反代示例——内网也尽量别明文漂。

![image.png](https://jiaxiantao.github.io/blogs/images/knowledge-studio/02.webp)

<http://localhost:3000/assistant/share?id=session-0819ee04-7a96-477c-97b6-690100109c95&t=C4NTm9Whm4ak3x981TXpW4d-kZg1z6f5>

***

## 五、和百炼 / 和自己的对照

| 能力 | 百炼 Knowledge Studio       | 本地版（截至 Day3）                       |
| -- | ------------------------- | ---------------------------------- |
| 检索 | 混合 + RRF/WEIGHT/Rerank 模型 | 混合加权 + LLM 改写 + 可选 LLM listwise 重排 |
| 评测 | 平台侧观测 / 应用评测              | 控制台评测台 + **CI stub 门禁**            |
| 入库 | 托管异步流水线                   | 并发上限 + 开机回收（仍非分布式队列）               |
| 账号 | 云账号 / RAM                 | 邀请码 + Cookie 会话                    |
| 分享 | 平台权限体系                    | HMAC 分享 token                      |
| 升级 | 托管无感                      | `migrate deploy`                   |

一句话：

> Day2 对齐的是「控制台 → 发布 API」的产品节奏；\
> Day3 对齐的是「改动能证明、内网能控边界」的工程节奏。

***

## 六、若再排一期

1.  **真正的 Rerank 模型**（或至少 cross-encoder），替代贵且不稳的 listwise LLM
2.  **评测回流**：线上低分 trace → 离线 case（Eval 篇那套）
3.  **按 Key 绑知识库 ACL** + 审计日志
4.  **MCP Server** —— 让 Cursor / Claude Code 直接调库
5.  **队列化 ingest**（BullMQ / 独立 worker），彻底告别 `after()`

***

## 快速自测清单

部署或改检索配置后，建议按这个顺序点一遍：

```bash
# 1) 质量门禁（CI 同款）
RAG_EVAL_EMBED_STUB=1 pnpm eval:ci

# 2) 全栈拉起（内网）
cp .env.docker.example .env
# AUTH_ALLOW_REGISTER=0 + AUTH_INVITE_CODE=…
# CHAT_SHARE_PUBLIC=0
docker compose --profile full up --build -d
```

*   [ ] 空库能建首账号；之后无邀请码不能注册
*   [ ] 问答 SSE 不依赖 URL 里的 token
*   [ ] 分享链接无 `t` 打不开（公开模式关时）
*   [ ] 检索工作台能看到改写后的 query
*   [ ] 连续上传多文档不会把 CPU/内存打爆
*   [ ] 重启 web 后 pending 文档会继续解析
*   [ ] `pnpm eval:ci` 绿

***

## 小结

Knowledge Studio 第三天没有追新功能清单，而是钉了两根钉子：

1.  **检索**：改写扩召回面，重排（可选）抠相关性；评测与线上管线刻意拆开，CI 用 stub 也能守 Hit\@K
2.  **内网**：邀请码、Cookie、分享 HMAC、migrate、限流——把「能给别人用」升级成「给真人用也不慌」

如果你也在做本地 RAG，Day3 的教训可以压成一句：

> **手感优化必须可回归；交付形态必须可关闸。**

仓库：[github.com/jiaxiantao/knowledge-studio](https://github.com/jiaxiantao/knowledge-studio)

***
