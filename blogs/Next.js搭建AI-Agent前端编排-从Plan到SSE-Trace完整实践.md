# 用 Next.js 搭建 AI Agent 前端编排：从 Plan 到 SSE Trace 的完整实践

> 基于 [Home Agent](https://github.com/jiaxiantao/home-agent) 项目的技术博客。\
> 本文介绍如何用 Next.js 实现一条最小可用的 **Plan → Tool → Answer** Agent 循环，并通过 SSE 把每一步实时推送给前端，驱动编排 UI。

***

## 前言：为什么需要「前端编排」视角的 Agent 项目？

过去两年，AI Agent 的讨论大多集中在后端：LangChain、AutoGPT、Function Calling……但当你真正做一个面向用户的 Agent 产品时，**前端才是用户感知 Agent「在思考、在行动」的地方**。

用户并不关心你的 Planner 用了哪个模型，他们关心的是：

*   Agent 现在在干什么？（规划中？调工具？生成答案？）
*   调了哪些工具？参数是什么？返回了什么？
*   整个过程花了多少步、多少毫秒？

Home Agent 就是一个专门回答这些问题的 **学习型 Next.js 项目**。它不追求生产级 Agent 框架的完备性，而是把 **Agent 循环设计、SSE 流式协议、编排 UI 状态机** 三件事拆得足够清晰，方便阅读和二次扩展。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/b09fbd1f98ed43a6a221ac5397de539b~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1783563762&x-orig-sign=nNLVx8M5Rn364Ly3CHP3q4O%2FkbI%3D)

***

## 项目概览

| 维度     | 说明                                                                        |
| ------ | ------------------------------------------------------------------------- |
| 定位     | AI Agent **前端编排**学习项目                                                     |
| 核心页面   | `/agents`（`/` 自动跳转）                                                       |
| 核心 API | `POST /api/agent`（SSE trace 流）                                            |
| 内置工具   | `search_notes` · `calculate` · `current_time`                             |
| 技术栈    | Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Prisma · PostgreSQL |

### 能力一览

| 工具             | 说明                                              |
| -------------- | ----------------------------------------------- |
| `search_notes` | 检索知识库笔记（PostgreSQL + `pg_trgm` 模糊搜索，无 DB 时内存回退） |
| `calculate`    | 安全数学表达式求值                                       |
| `current_time` | 返回服务器本地时间                                       |

一句话总结数据流：**用户输入 → Agent 循环规划 → 按需调用工具 → 每步产出 trace 事件 → SSE 推流 → 前端 Hook 解析 → 编排 UI 实时更新**。

***

## 快速上手

### 环境要求

*   Node.js 22（见 `.nvmrc`）
*   pnpm 9
*   Docker（用于 PostgreSQL）

### 启动步骤

```bash
pnpm install
cp .env.example .env
docker compose up -d db
pnpm db:setup
pnpm dev
```

浏览器访问 <http://localhost:3000/agents>。

### 可选：接入 Ollama

```bash
ollama pull llama3.2
ollama serve
```

`.env` 默认已配置 Ollama 的 OpenAI 兼容接口。若未配置 LLM 或设置 `LLM_DISABLED=1`，系统会自动回退到**规则规划器**——这在 CI 和离线学习场景下非常实用。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/81a8c7917f4c46b6a35f1bfb9b099fcd~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1783563762&x-orig-sign=9s597ZbPquqqm5LREaYEP69vdsE%3D)

***

## 核心设计：Agent 主循环

Agent 的心脏在 `src/lib/agent/run-loop.ts`。它实现了一个 **async generator**，每推进一步就 `yield` 一个 trace 事件：

```ts
export async function* runAgentLoop(
  message: string,
  options: { signal?: AbortSignal } = {},
): AsyncGenerator<AgentTraceEvent> {
  // ...
  while (steps < maxSteps) {
    const { plan, mock } = await planAgentStep(message, prior);
    yield { type: "plan", plan };

    if (plan.action === "answer") {
      yield { type: "answer", text: plan.answer, mock };
      yield { type: "done", steps, toolCalls, totalMs };
      return;
    }

    yield { type: "tool_call", tool: plan.tool, args: plan.args };
    const result = await executeAgentTool(plan.tool, plan.args);
    yield { type: "tool_result", tool: plan.tool, output: result.output };
  }
}
```

### 循环的关键设计决策

1.  **步数上限**：通过 `AGENT_MAX_STEPS` 控制（默认 4，上限 12），防止无限循环。
2.  **AbortSignal 支持**：请求中断时立刻抛出，前端「停止」按钮可生效。
3.  **步数耗尽兜底**：达到上限时，基于已有工具结果合成最终回答，而不是直接报错。
4.  **性能埋点**：每步产出 `step_metric` 事件，记录 `planMs`、`toolMs`、`totalMs`。

这种 **generator + yield 事件** 的模式，比「先跑完再返回 JSON」更适合流式 UI——后端每推进一步，前端就能更新一次。

***

## 规划器：LLM 与规则回退的双轨设计

`src/lib/agent/planner.ts` 负责「这一步该调工具还是直接回答」。

### LLM 规划路径

当 Ollama 或 OpenAI 兼容 API 可用时，规划器要求模型输出结构化 JSON：

```ts
const response = await client.chat.completions.create({
  model,
  temperature: 0.1,
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content: getPlannerSystem() },
    { role: "user", content: JSON.stringify(userPayload) },
  ],
});
```

System Prompt 明确约束输出格式——要么 `{ action: "tool", tool, args, reasoning }`，要么 `{ action: "answer", answer, reasoning }`。LLM 返回的 JSON 还会经过 Zod 校验（`planner-schema.ts`），无效则回退。

### 规则规划器（Mock Planner）

`src/lib/agent/planner-mock.ts` 用关键词匹配实现零依赖规划：

*   含「笔记 / 搜索 / 架构」→ 调 `search_notes`
*   含算式 → 调 `calculate`
*   含「几点 / 时间」→ 调 `current_time`
*   已有工具结果 → 合成最终回答

```ts
if (wantsSearch && !hasTool("search_notes")) {
  return {
    action: "tool",
    tool: "search_notes",
    args: { query: "..." },
    reasoning: "问题涉及知识库，先检索笔记",
  };
}
```

**为什么需要双轨？**

*   本地学习时不必装 LLM，打开页面就能跑通全流程
*   CI 流水线不依赖外部 API，测试稳定可重复
*   对比 LLM 规划与规则规划的行为差异，是学习 Agent 设计的捷径

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/01124c568d0449b4a389cff7aa1c9cb3~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1783563762&x-orig-sign=9VlVrcZrXHG6LMzybqmTeza4M7Q%3D)

***

## SSE 流式协议：前后端的契约

`POST /api/agent` 返回 `Content-Type: text/event-stream`。每个事件块格式：

```
event: plan
data: {"type":"plan","plan":{"action":"tool","tool":"search_notes",...}}

```

### 事件类型

| type          | 说明                                 |
| ------------- | ---------------------------------- |
| `trace`       | 循环阶段日志（`start` / `plan` / `limit`） |
| `plan`        | 规划器输出                              |
| `tool_call`   | 即将执行的工具及参数                         |
| `tool_result` | 工具返回文本                             |
| `step_metric` | 单步耗时（planMs / toolMs / totalMs）    |
| `answer`      | 最终回答（`mock: true` 表示规则回退）          |
| `done`        | 循环结束统计                             |
| `error`       | 错误信息                               |

### API Route 实现

`src/app/api/agent/route.ts` 把 async generator 桥接到 Web Streams API：

```ts
const stream = new ReadableStream({
  async start(controller) {
    for await (const trace of runAgentLoop(body.message, {
      signal: request.signal,
    })) {
      controller.enqueue(encoder.encode(encodeSseEvent(trace.type, trace)));
    }
    controller.close();
  },
});

return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  },
});
```

SSE 编码/解码被抽成独立模块 `src/lib/sse.ts`，前后端共用同一套解析逻辑，避免协议漂移。

### curl 调试

无需打开浏览器，直接用 curl 观察事件流：

```bash
curl -N -X POST http://localhost:3000/api/agent \
  -H "Content-Type: application/json" \
  -d '{"message":"计算 1+2"}'
```

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/35c026db72c94d8cb2b2c0c47ad0905b~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1783563762&x-orig-sign=siTatymYis3DDeV7uGq%2FJwVo3bA%3D)

***

## 前端编排 UI：Hook + 状态机

### useAgentStream Hook

`src/hooks/use-agent-sse.ts` 是前端消费 SSE 的核心。它用 `fetch` + `ReadableStream` 按 `\n\n` 分块解析，维护以下状态：

| 状态            | 用途                                                       |
| ------------- | -------------------------------------------------------- |
| `lines`       | Trace 面板的事件行                                             |
| `phase`       | 工作流阶段（idle / planning / tool / answering / done / error） |
| `finalAnswer` | 最终回答文本                                                   |
| `stepMetrics` | 每步耗时数据                                                   |
| `stats`       | 总结（步数、工具调用次数、总耗时）                                        |
| `isMock`      | 是否使用了规则规划器                                               |

```ts
const { run, stop, running, lines, finalAnswer, stats, stepMetrics } =
  useAgentStream({
    onEvent: (event) => console.log(event),
  });

await run("现在几点？");
```

Hook 内部把原始 SSE 事件映射为人类可读的 Trace 行，例如：

*   `plan` → `调用 search_notes · 问题涉及知识库，先检索笔记`
*   `tool_call` → `→ calculate({"expression":"1+2"})`
*   `tool_result` → 工具输出（检索结果还会标注命中条数）

### 编排 UI 组件

`src/components/agent-orchestrator.tsx` 把 Hook 状态组装成完整的编排界面：

| 组件                          | 职责                   |
| --------------------------- | -------------------- |
| `AgentWorkflowBar`          | 工作流进度条（规划 → 工具 → 回答） |
| `AgentTracePanel`           | 逐步展开的 trace 日志       |
| `AgentStepMetrics`          | 每步耗时可视化              |
| `AgentFinalAnswer`          | 最终回答展示（含 mock 标记）    |
| `IntelligenceLearningPanel` | 进阶：编排偏好与学习面板         |

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/b87ac56cdb964525aa80bbe76216c1ff~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1783563762&x-orig-sign=QxgpQ7J4a2DTkDE%2FUk7M5DIC1ec%3D)

### 快捷 Prompt 与工具目录

页面内置快捷按钮（`agent-quick-prompts.ts`）和工具目录展示（`tool-catalog.ts`），降低首次体验门槛。用户点一下「计算 100 \* 0.15 + 20」或「现在几点？」，就能立刻看到 Agent 循环的完整 trace。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/d3ad0ea5b1ce4046aeae680ed90d3eef~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1783563762&x-orig-sign=%2Bsddfxfkgvf0kuE3rxWFM%2BEwqgM%3D)

***

## 工具层：从声明到实现

每个 Agent 工具需要保持四处一致（详见 [docs/add-a-tool.md](https://github.com/jiaxiantao/home-agent/blob/main/docs/add-a-tool.md)）：

1.  `types.ts` — 工具名类型
2.  `tool-catalog.ts` — UI 展示文档
3.  `tools.ts` — 执行逻辑
4.  `planner.ts` + `planner-schema.ts` — 告诉规划器工具存在

以 `search_notes` 为例，底层调用 `src/lib/note-search.ts`：

*   有 PostgreSQL 时，使用 `pg_trgm` 扩展做模糊搜索
*   无 DB 连接时，回退到内存中的种子数据

`calculate` 工具则通过字符白名单 + `new Function` 做受限求值——**学习项目可以这么写，生产环境需要沙箱方案**。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/dfbbc12d9eb44cfb9ed7dc35f49f641e~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1783563762&x-orig-sign=AzdWt4lqRkgfUlYtCW4HEfz05Bw%3D)

***

## 进阶模块：编排偏好与学习面板

`src/lib/front-intelligence-preferences.ts` 演示如何把用户偏好注入 prompt，并通过 `localStorage` 持久化：

*   **风格**：风险优先 / 代码优先 / 步骤优先
*   **深度**：简短 / 完整
*   **指标**：是否在回答中补充量化指标

这是**可选进阶模块**，不影响 Agent 核心循环。但它展示了真实产品中常见的模式——**前端偏好 → prompt 增强 → Agent 行为微调**。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/991aa43c2795457ba22d2416ec030f8b~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1783563762&x-orig-sign=icUbuu2ftnvYHLupAGXseIx87yc%3D)

***

## 数据层：Prisma + PostgreSQL

项目使用 Prisma 管理数据模型，Docker Compose 一键启动 PostgreSQL 16：

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: home_agent
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
```

`pnpm db:setup` 会执行 `prisma db push` + `prisma db seed`，写入示例笔记供 `search_notes` 检索。

健康检查端点 `GET /api/health` 会报告 DB 连接、LLM 配置、`pg_trgm` 扩展是否可用——前端 Header 的 Badge 就是消费这个接口。

***

## 测试与 CI：无 LLM 也能跑通

Home Agent 的测试策略值得借鉴：

| 层级     | 工具           | 说明                              |
| ------ | ------------ | ------------------------------- |
| 单元测试   | Vitest       | 规划器 schema、SSE 解析、工具逻辑、run-loop |
| API 冒烟 | `pnpm smoke` | 对运行中的 dev server 发 SSE 请求       |
| E2E    | Playwright   | 完整页面交互流程                        |

CI 中设置 `LLM_DISABLED=1`，确保流水线不依赖外部 LLM 服务。规则规划器让「Agent 循环 → SSE → 前端 UI」这条链路在每次 PR 中都被验证。

***

## 扩展指南：添加你自己的 Tool

假设要添加一个 `echo` 工具（回显用户输入），按以下清单操作：

*   [ ] `types.ts` — 加入 `"echo"` 工具名
*   [ ] `tool-catalog.ts` — 注册 UI 文档
*   [ ] `tools.ts` — 实现 `case "echo"`
*   [ ] `planner-schema.ts` — Zod 枚举加入 `"echo"`
*   [ ] `planner.ts` — system prompt 描述新工具
*   [ ] （可选）`planner-mock.ts` — 关键词规则
*   [ ] （可选）`agent-quick-prompts.ts` — 快捷按钮

验证：

```bash
pnpm typecheck && pnpm test
pnpm dev   # 另一终端
pnpm smoke
```

在 `/agents` 输入「请 echo 你好」，观察 trace 是否出现 `tool_call → echo → tool_result`。

***

## 安全说明（学习项目 vs 生产环境）

Home Agent 刻意保持简单，以下限制请在生产使用前知晓：

| 项目           | 现状                  | 生产建议                             |
| ------------ | ------------------- | -------------------------------- |
| API 鉴权       | `/api/agent` 无鉴权    | 加 API Key / Session / Rate Limit |
| calculate 工具 | `new Function` 受限求值 | 独立沙箱（VM / WASM）                  |
| LLM 输出       | Zod 校验 + 回退         | 加重试、超时、内容过滤                      |
| SSE 连接       | 无心跳                 | 加 keep-alive / reconnect 策略      |

***

## 推荐阅读顺序

如果你想深入源码，建议按此顺序阅读：

1.  `src/lib/agent/types.ts` — 事件与规划类型定义
2.  `src/lib/agent/run-loop.ts` — Agent 主循环
3.  `src/lib/agent/planner.ts` + `planner-mock.ts` — LLM / 规则双轨规划
4.  `src/app/api/agent/route.ts` — SSE 出口
5.  `src/hooks/use-agent-sse.ts` — 前端消费 Hook
6.  `src/components/agent-orchestrator.tsx` — 编排 UI 组装

配套文档：

*   [架构说明](https://github.com/jiaxiantao/home-agent/blob/main/docs/architecture.md)
*   [SSE 协议](https://github.com/jiaxiantao/home-agent/blob/main/docs/sse-protocol.md)
*   [如何新增 Tool](https://github.com/jiaxiantao/home-agent/blob/main/docs/add-a-tool.md)

***

## 总结

Home Agent 用约 80 个源文件，演示了 AI Agent 前端编排的核心链路：

几个值得带走的实践：

1.  **Async Generator 驱动 SSE** — 后端每推进一步，前端就能更新 UI，用户体验远好于「等全部跑完」。
2.  **LLM + 规则双轨规划** — 开发、测试、演示不绑死外部 API，降低学习和 CI 成本。
3.  **Hook 封装 SSE 消费** — 把协议解析、状态映射、Abort 控制集中在一处，UI 组件只关心展示。
4.  **类型 + Zod 双保险** — 规划器输出、SSE 事件、API 入参全链路类型安全。

如果你正在学习 Agent 或准备做一个带编排 UI 的 AI 产品，不妨 clone 这个项目，从添加一个新 Tool 开始动手。

```bash
git clone https://github.com/jiaxiantao/home-agent.git
cd home-agent
pnpm install && cp .env.example .env
docker compose up -d db && pnpm db:setup && pnpm dev
```

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/9b921387a9784c7980ef44d17aadc5e1~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1783563762&x-orig-sign=ABrDlBYVss%2BLgbot96%2BKp%2Bb1N%2B0%3D)

***

***

## 项目地址

| 项目         | 链接                                                 |
| ---------- | -------------------------------------------------- |
| GitHub 仓库  | <https://github.com/jiaxiantao/home-agent>         |
| Issue / 讨论 | <https://github.com/jiaxiantao/home-agent/issues>  |
| CI 状态      | <https://github.com/jiaxiantao/home-agent/actions> |

```bash
git clone https://github.com/jiaxiantao/home-agent.git
```

***

## 参考文章

### AI Agent 与工具调用

*   [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) — Agent「推理 + 行动」循环的经典论文，Plan → Tool → Answer 的思想来源之一
*   [OpenAI — Function calling](https://platform.openai.com/docs/guides/function-calling) — 结构化工具调用的官方指南，与项目中 Planner 输出 JSON 的模式一脉相承
*   [Anthropic — Tool use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) — Claude 工具调用文档，对比不同厂商的 Function Calling 设计
*   [LangChain — Agents](https://python.langchain.com/docs/concepts/agents/) — Agent 抽象与 Tool Loop 的概念说明（Python 生态，但循环模型通用）

### 流式输出与 SSE

*   [MDN — Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) — SSE 标准与浏览器 `EventSource` API 说明
*   [MDN — Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) — SSE 事件格式、重连与实战要点
*   [Next.js — Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) — App Router 下的 API Route 与 `Response` 流式返回
*   [Next.js — Streaming](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming) — Next.js 流式渲染与 Suspense 概念（与 SSE trace 推送互补）

### 前端与工程实践

*   [React — useEffect](https://react.dev/reference/react/useEffect) — Hook 副作用与清理（AbortController 模式参考）
*   [Prisma — Getting started](https://www.prisma.io/docs/getting-started) — 本项目 ORM 与数据库迁移
*   [PostgreSQL — pg\_trgm](https://www.postgresql.org/docs/current/pgtrgm.html) — `search_notes` 模糊检索依赖的扩展文档

***

## 参考书籍

| 书名                                      | 作者               | 与本项目的关联                                              |
| --------------------------------------- | ---------------- | ---------------------------------------------------- |
| *AI Engineering*                        | Chip Huyen       | LLM 应用架构、RAG、Agent 编排与工程化落地                          |
| *Building LLM Apps*                     | Valentina Alto   | 从零构建 LLM 应用，涵盖 Tool Calling 与对话流程设计                  |
| *Designing Data-Intensive Applications* | Martin Kleppmann | 流式传输、事件驱动、数据一致性——理解 SSE 推送的底层视角                      |
| *Designing Machine Learning Systems*    | Chip Huyen       | ML 系统工程思维，对 Agent 监控、回退策略有启发                         |
| *JavaScript: The Definitive Guide*      | David Flanagan   | Async Generator、`ReadableStream` 等 JavaScript 异步机制参考 |

***
