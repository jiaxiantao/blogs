<!-- post-id: f8e8e6dc62a84682 -->

# Knowledge Studio 本地开源版：对标百炼 RAG 控制台的架构、重难点与差异

> 发布日期：2026-08-06\
> 标签：RAG / Knowledge Studio / pgvector / Ollama / Next.js / 工程实践\
> 项目：[jiaxiantao/knowledge-studio](https://github.com/jiaxiantao/knowledge-studio) · 静态预览：[jiaxiantao.xyz/knowledge-studio](https://jiaxiantao.xyz/knowledge-studio/)

阿里云百炼把 Knowledge Studio 做成了企业级「知识管理 → 知识检索 → 知识问答」闭环。用起来很顺：上传、切片、召回、引用，控制台一眼就能演示。

但顺的代价是：**链路被托管了，你看不见 OCR 为什么挂、分数怎么算、弱召回时 Prompt 该怎么写。**

我做了一个本地开源版 [Knowledge Studio](https://github.com/jiaxiantao/knowledge-studio)：同一套产品形态，技术栈换成 Next.js + PostgreSQL/pgvector + 本机 Ollama。目标不是替代云产品，而是把 RAG 控制台的**最小可运行切片**拆开——前端工程师也能读懂、改得动、讲得清。

![ks-hero-cloud-vs-local.jpg](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/9955ed96e83043e3be2bb92824e30a20~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786601839&x-orig-sign=hzSiKjqLw0zPZEUcy9VNjaDlGTA%3D)

> 🎭 *左边：云端把链路收进按钮。右边：本地把解析、向量、问答全部摊开——这篇讲的就是右边那条白盒。*

全文约 18 分钟。读完你应该能回答三件事：

1.  本地版整条链路怎么串起来的
2.  真正卡住工程的是哪几块（不是「调个 embedding」那么简单）
3.  和百炼 Knowledge Studio 比，云端买走了什么、本地逼你直面了什么

***

## 一句话定位

| 维度    | 说明                                                                                              |
| ----- | ----------------------------------------------------------------------------------------------- |
| 定位    | 轻量 **RAG 知识库控制台**（学习 / 本机 / 内网）                                                                 |
| 对标    | 百炼 Knowledge Studio 的核心产品环，不是完整企业版                                                              |
| 技术栈   | Next.js 16 · React 19 · Prisma · Postgres + **pgvector** · Ollama（`qwen3` + `nomic-embed-text`） |
| 安全默认值 | **无鉴权**——面向本机/可信内网；公网前请自己加门禁                                                                    |

产品上三根柱子对齐云端 IA：

| 页面           | 对应百炼能力 | 本地实现要点                                    |
| ------------ | ------ | ----------------------------------------- |
| `/knowledge` | 知识管理   | 多知识库、类目、异步上传、切片 CRUD / 启停检索               |
| `/retrieval` | 知识检索   | 多库联合向量试跑，暴露 latency / minScore / hitCount |
| `/assistant` | 知识问答   | 多库联合召回 + SSE 流式（思维链 → 结论）+ 引用与置信度         |

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/550cd740074045458b8f9baa253488a0~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786601839&x-orig-sign=PD%2BuMBxnEBbcMrp1Vod4Uos7X2w%3D)

***

## 总架构：一条进程里跑完 RAG

本地版刻意做成「可拆开看的单体」：UI、API、解析、向量写入、问答编排都在同一个 Next.js 进程里。

![ks-architecture-pipeline.jpg](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/79522e2b1b0e4689a77069fd3252a33c~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786601839&x-orig-sign=fZfED%2Bm2aDvk3gEaQG7yfkkOHs8%3D)

> 🎭 *Console → API 再分叉到入库 / 检索 / 问答；底下一层是 Postgres+pgvector 与本机 Ollama。*

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/a8707cef1c54432696261cf391db6020~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786601839&x-orig-sign=5uwlVLLUlg0rGSf%2BqMxo%2BhB%2Fe20%3D)

和云端对照一下数据流就更清楚：

| 环节      | 百炼 Knowledge Studio / 知识存储      | 本地开源版                         |
| ------- | ------------------------------- | ----------------------------- |
| 原始文件    | OSS                             | `data/uploads/`               |
| 解析 / 切片 | 托管流水线（如 DocMind）                | 进程内解析器 + 可选 OCR               |
| 向量      | Tablestore + 托管索引               | `Chunk.embedding vector(768)` |
| 检索      | 向量 + 全文混合，RRF / WEIGHT / Rerank | **纯向量** + `minScore` 门槛       |
| 生成      | 云端大模型 / 应用编排                    | 本机 Ollama，OpenAI 兼容也可换        |
| 运维      | Serverless、按量计费                 | Docker Compose 或 `pnpm dev`   |

数据模型几乎是同一套名词，方便对照文档：

    KnowledgeBase
      ├── DocumentCategory
      ├── Document (pending → parsing → ready | failed)
      │     └── Chunk (content + enabled + embedding?)
      └── ChatSession (branches JSON)

Prisma 里向量类型走 `Unsupported("vector(768)")`，读写用 raw SQL——这是后面第一个工程坑。

***

## 主链路：上传 → 切片 → 召回 → 有依据地答

### 1. 上传要「立刻返回」，解析不能堵在请求里

`POST /api/documents` 落盘并创建 `pending` 文档后，用 Next.js `after()` 把重活甩到响应之后：

```typescript
after(() => {
  void processDocumentIngest(document.id);
});
return NextResponse.json({ document }, { status: 201 });
```

进度条按阶段推进：文字/OCR 约 12–28%，切片与向量化 30–96%，完成 100%。另有 `INGEST_STUCK_MINUTES`（默认 15 分钟）把卡死任务标出来，支持强制重试。

这和云端「异步建索引」产品体验一致，但实现差一个量级：本地是**进程内内存去重**（`ingestInFlight` Set），不是 durable job queue。单机够用；多副本 / 重启中途会丢任务——这是诚实边界，不是「也算生产级调度」。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/2bb23888bbe54e91bdc0e15a0f7d7069~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786601839&x-orig-sign=4T5Js2R%2BaWp4NW6e46yp4Yg%2BEqY%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/041c75bc031c4cdebb67c09b9c84d106~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786601839&x-orig-sign=NoTpRTSV7yDdWBIQXM1xqWRAXbo%3D)

### 2. 多格式解析：对标上传矩阵，而不是只做 ChatPDF

早期只支持 md/txt/pdf。对齐百炼演示后，上传规则按类型收紧：

| 类型  | 格式                            | 默认限制（节选）           |
| --- | ----------------------------- | ------------------ |
| 文档  | pdf / doc / docx / ppt / pptx | ≤150MB；PDF ≤1000 页 |
| 表格  | xls / xlsx                    | ≤10MB；≤10 万行       |
| 图片  | png / jpg / …                 | ≤20MB + 尺寸/长宽比     |
| 纯文本 | md / txt / html               | ≤10MB              |

解析路由大致是：docx→mammoth，表格→xlsx，老式 office→officeparser，html 去标签，图片直接 OCR。PDF 先走 `pdf-parse` 抽文字层。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/35cebff99866463f9e0fe701a86552e1~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786601839&x-orig-sign=uAPo9pf1cp8CM72VIM7urczTw6A%3D)

### 3. 扫描件 PDF：文字层为空时才上 OCR

这是 changelog 里写过的真实翻车：思维导图类 PDF 显示 24 页，文本长度却是 0——不是文件坏了，是**图片型 PDF**。

回退路径：

    pdf-parse 无文本
      → PDFium 按页渲染 bitmap
      → @napi-rs/canvas 转 PNG
      → Tesseract（默认 chi_sim）识别
      → 再切片、向量化

OCR 有页数上限、渲染倍率、语言包配置（`PDF_OCR_*`）。识别会有错字，但多数场景检索仍可用；大文件耗时长，所以进度回调必须接进 UI。

云端用 DocMind 一类托管解析，你几乎感觉不到这一刀。本地做一遍，才知道「支持 PDF」四个字后面有多少分支。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/4960df87730d44ddbdc03cb505579565~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786601839&x-orig-sign=2nKGH9p7W9kPEZwpmnFqhKR5slA%3D)

### 4. 切片：段落优先，固定窗口 + 重叠

`splitIntoChunks` 默认约 **700 字窗口、80 字重叠**：先按空行攒段落，超长段落再滑窗切开。标题取第一行有意义内容。Token 用 `ceil(len/1.5)` 粗估中英混合——够排进度、不够当精确计费。

百炼侧切片策略偏托管/智能切；本地刻意保持**可读、可调、可解释**的规则切片，方便演示「改 chunk 大小会怎样」。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/ca40ec1ef51045caa6afdbfcc80a25ef~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786601839&x-orig-sign=oJ42SvSRpLfM6eqVXyT6MsslwVA%3D)

### 5. Embedding：聊天走 `/v1`，向量走原生 API

对话用 OpenAI SDK 打 Ollama 的 OpenAI 兼容口；向量走原生 `/api/embeddings`，维度写死 **768**（`nomic-embed-text`）。两个 base URL 容易配错——`OLLAMA_NATIVE_BASE_URL` 就是为这个拆开的。

写入：

```sql
UPDATE "Chunk" SET embedding = $1::vector WHERE id = $2
```

换 embedding 模型若维度变了，要改 schema / 重建索引。百炼文档也强调：**Embedding 配置创建后不可改，换模型等于重建知识库**——本地版用硬编码维度把同一约束提前暴露给你。

### 6. 检索：多知识库联合 + minScore 门槛

```sql
ORDER BY c.embedding <=> $1::vector
-- score = 1 / (1 + distance)
```

过滤条件：`embedding IS NOT NULL`、`enabled = true`、文档 `ready`，并可按一个或多个 `knowledgeBaseId` 过滤。问答侧还会按库数量放大 topK（约 `ids.length * 4`，夹在 5–20）。

弱命中用 `RAG_MIN_SCORE`（默认 **0.42**）丢掉，避免「随便召回两段无关文字 → 模型硬编文档事实」。

检索工作台刻意**只保留真参数**（query / topK / minScore / 多库），假开关（路由模式、假权重等）已拆掉——演示产品最忌 UI 假装有能力。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/2e847f6151e246a0a7fe9a3e4a91c8f9~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786601839&x-orig-sign=HhH5i%2F4BpcIZBo1AkCNTh3IlfKY%3D)

### 7. 问答：先引用、再流式、真多轮

`POST /api/chat` 的 SSE 顺序：

1.  `references` — 过门槛的切片
2.  `meta` — 置信度、searchMs、hitCount、minScore
3.  `chunk*` — 模型增量文本
4.  `done` / `error`

置信度不来自模型自评，而来自**召回分均值**（高/中/低标签）。多轮历史最多带约 6 轮；助手历史只保留 `<conclusion>`，避免把上一轮思维链再次喂回去污染上下文。

System Prompt 有一条产品级决策，和很多「没召回就拒答」的 Demo 相反：

> 有切片 → 优先依据切片，不编造文档事实；\
> 无切片或明显无关 → **用模型自身知识正常回答**，禁止「知识库没有」式甩锅；\
> 只有用户明确在问「我上传的文档里写了什么」且确实没有材料时，才可以说库里没有。

输出强制 `<thinking>` / `<conclusion>` 标签，前端边流边拆「推理 / 结论」两栏。解析器容忍半截标签和纯文本回退。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/4579620cefb54345b6110c21aacd2acc~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786601839&x-orig-sign=0yK6s1Q6jlKBlSEamnyOtC3kb5k%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/da4d644b4ad04a749e8dbc7e6fd9699a~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786601839&x-orig-sign=aDyXuEhpFvhctQVXIiiLrAB6Fbo%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/6a33df765c0a43c895e0cda2370917aa~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786601839&x-orig-sign=wmBY4rJAxQs5hcCIlxTMHNH3f1Y%3D)

***

## 五个重难点（比写个 Chat 框难）

### 难点 1：Prisma × pgvector

ORM 不认 `vector`。方案是 schema 标 `Unsupported`，业务层 raw SQL 读写。优点是依赖少、和 Postgres 同库运维；缺点是查询难抽象、维度绑死、类型安全靠约定。

云端把向量表、全文索引、融合排序都藏在 Retrieve API 后面——你调接口，它出结果。本地你必须自己写 `<=>` 和 score 公式。

### 难点 2：异步入库不是「加个 await」

`after()` + 内存 Set 能扛演示和单机。扛不住的是：进程重启、多实例抢同一文档、OCR 跑半小时把请求线程拖死。配套能力是进度字段、卡住判定、批量强制重试——**产品补救**，不是调度系统。

若要上生产，这一步几乎一定要换成队列（BullMQ / SQS / 云端异步任务）+ 可观测。

### 难点 3：OCR 是解析的「最后一公里」

文字层 PDF 很快；扫描件是另一条产品。本地用 PDFium + Canvas + Tesseract，还要处理：

*   CJK 语言包（多语 `a+b` 在 tesseract.js WASM 上不稳，默认只用主语言）
*   页数 / 清晰度 / 耗时三角
*   失败可重试、列表按上传时间排序（避免解析刷新把文档顶到最前）

百炼侧解析质量通常更高、也更贵；本地版换来的是**可调试**和**数据不出机器**。

### 难点 4：检索质量 = 分数门槛 + Prompt 契约 + UI 诚实

三件事绑在一起：

| 杠杆 | 本地做法                     |
| -- | ------------------------ |
| 召回 | 纯向量 topK + `minScore`    |
| 生成 | 有据引用 / 无据通识，禁止假拒答        |
| 体验 | 展示引用、置信度、latency；去掉假能力开关 |

百炼默认是**向量 + 全文混合**，融合可用 WEIGHT（如 0.7/0.3）、RRF 或 Rerank 模型。本地版目前没有全文通道和 Rerank——专有名词、编号类 query 会弱一截。这是有意砍掉的复杂度，也是和云端差距最大的检索能力点之一。

### 难点 5：多知识库联合问答的产品细节

技术上只是 `WHERE knowledgeBaseId IN (...)`。产品上要处理：

*   聊天顶栏多选，选择进 `sessionStorage`
*   引用上展示来源知识库名
*   会话仍归属入口主库（权限/列表语义简单）
*   客户端路由 `?kb=` 必须用 `useSearchParams`，不能首屏读一次 `window.location`

云端 RAG 4.0 叙事里还有 Agentic Search（多轮搜）、NL2SQL、MCP/CLI 发布等；本地版停在「多库一次向量召回 + grounded 生成」。对标的是**控制台主路径**，不是 Agentic 全家桶。

***

## 和阿里云 Knowledge Studio 怎么比

先对齐「比的是谁」：百炼 **Knowledge Studio** 是 SaaS 化知识库 / RAG 控制台（管理、检索、问答、对外 API/MCP 等）；底层知识存储常见组合是 **OSS + 解析流水线 + Tablestore 向量/全文索引**。PAI **LangStudio** 是另一条线（Agent 工作流编排），别混成一个产品。

![ks-tradeoffs-board.jpg](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/c03101eb8d2847778874d4939845dcf6~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786601839&x-orig-sign=83tvN4hkc3UKaQjMJjZVzYJulrw%3D)

> 🎭 *云端买的是运维、混合检索与规模；本地买的是白盒、可控成本与工程判断力。*

### 对照表

| 维度     | 百炼 Knowledge Studio        | 本地开源版                  |
| ------ | -------------------------- | ---------------------- |
| 定位     | 企业托管、开箱即用                  | 学习 / 本机 / 内网可改         |
| 部署     | SaaS，难私有化离线                | Docker / 本机；MIT        |
| 鉴权与多租户 | 平台账号、业务空间；存储侧还有 Subspace 等 | 默认无鉴权                  |
| 文件与解析  | OSS + 托管解析                 | 本地盘 + 自研解析/OCR         |
| 向量与检索  | 混合检索 + 多种融合/Rerank         | pgvector 单路 + minScore |
| 模型     | 云端 Embedding / LLM，按量      | Ollama 本地，可换兼容 API     |
| 规模     | 文档量级可到很大（平台 SLA）           | 单机；入库非持久队列             |
| 可观测    | 控制台与云监控                    | 检索 meta + health；链路自建  |
| 对外集成   | API / MCP / CLI / 应用发布     | 同源 REST + SSE；分享只读页    |
| 你买到的   | 运维、解析质量、混合检索、合规与规模         | 白盒、可控成本、可二次开发          |

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/2c0b0520775044109564b9781a260bd8~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786601839&x-orig-sign=9892Rlo04jjzw7Fg4GpyvzkREpg%3D)

### 什么时候用云，什么时候用本地

*   **要上业务、要混合检索、要 IAM/审计、要少运维** → 直接百炼 Knowledge Studio（或同类托管）。
*   **要讲清楚 RAG、要内网数据、要改切片/门槛/Prompt、要前端同学能贡献代码** → 本地版更合适。
*   **最佳学习路径**：先用云产品建立「正确产品形态」的直觉，再用本地版把同一形态拆成可改代码——两边对照，进步最快。

一句话：

> 云端 Knowledge Studio 把难处抽象成按钮；本地重建同一闭环，是为了把难处变成**你自己的工程判断力**。

***

## 工程上还有几处「故意诚实」的设计

1.  **静态预览与全栈双模式**：GitHub Pages 导出时把 `api/` 挪开再 `output: "export"`，线上只读壳；真上传/检索必须本地或 Docker。
2.  **健康检查**：`/api/health` 报 DB、vector 扩展、LLM 是否可用；DB 挂了服务层尽量返回空而不是整站白屏。
3.  **切片可关检索**：`enabled=false` 清 embedding，内容还在——运营向能力，不只是 Demo。
4.  **会话分支 JSON 落库**：分叉、分享链接、侧栏会话，接近「能演示的产品」而不是一次性 Chat。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/c1c543f56c0b4f0d85d28211bbd46e05~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786601839&x-orig-sign=RvtCkBjr1hfVCRwLZ%2FJjUvUnPv0%3D)

***

## 快速上手（本地）

```bash
pnpm i
cp .env.example .env
docker compose up -d db
pnpm db:setup

ollama pull qwen3
ollama pull nomic-embed-text

pnpm dev
# http://localhost:3000/knowledge
```

关键环境变量：`DATABASE_URL`、`OLLAMA_*`、`RAG_MIN_SCORE`、`PDF_OCR_*`、`LLM_DISABLED`（CI/演示可关真模型）。

***

## 小结

本地 Knowledge Studio 证明一件事：**对标云产品，不必复刻全部企业能力，但要把主路径做「真」。**

真异步入库、真多格式与 OCR 回退、真向量分数与门槛、真多库联合、真引用与置信度、真去掉假开关——这些比换一个更炫的聊天皮肤更有教学和生产迁移价值。

若你接下来要演进，优先级我会这样排：

1.  全文检索（或至少 BM25）+ 简单融合，补专有名词短板
2.  把 `after()` 换成持久化任务队列
3.  鉴权与按知识库的 ACL
4.  离线评测集守住召回与拒答策略（改 Prompt 前先回归）

云端已经帮你验证了产品形态；本地版帮你验证的是：**你是否真的理解这条形态背后的工程代价。**

仓库：[github.com/jiaxiantao/knowledge-studio](https://github.com/jiaxiantao/knowledge-studio)

***
