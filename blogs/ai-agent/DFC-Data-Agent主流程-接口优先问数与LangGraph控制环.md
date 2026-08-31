<!-- post-id: 44f7890eafa44872 -->

# LangGraph 实战：DFC Data Agent 如何用一张图跑通企业问数

> 发布日期：2026-08-20\
> 标签：LangGraph / AI Agent / API-First / HITL / NL2SQL / 大风车 / 工程实践\
> 项目：[dfc-ai/dfc-data-agent](https://git.souche-inc.com/dfc-ai/dfc-data-agent)\
> 相关阅读：[Knowledge Studio RAG 系列](https://jiaxiantao.github.io/blogs/post/f8e8e6dc62a84682)

分析师敲下一行字：

> 「客户手机号为 13166990795 的客户信息」

十秒后，屏幕上出现一张真表。中间不是一段「while + 调工具」的脚本在裸奔，而是一张 **LangGraph 编译出来的状态机**：预检索、规划、执行工具、人工确认、合成答案，各自是节点；分支、挂起、限步，各自是边。

这篇以 **LangGraph 怎么落地** 为主视角。不讲官方 Quickstart 复读，而是讲大风车数据智能体（DFC Data Agent）里这张图为什么长成这样、节点之间怎么路由、HITL 为什么**故意没用** `interrupt()`、以及成本和安全是怎样钉在边上的。

全文约 16 分钟。读完你应该能回答：

1.  企业问数为什么适合用 StateGraph，而不是手写循环
2.  五个节点各自解决什么实战问题
3.  跨 HTTP 的人在回路，在 LangGraph 里可以怎么取舍

![image.png](https://jiaxiantao.github.io/blogs/images/dfc-data-agent/01.webp)

***

## 开场：为什么是 LangGraph，而不是又一个 Agent while

![dfc-hero-api-first.jpg](https://jiaxiantao.github.io/blogs/images/dfc-data-agent/dfc-hero-api-first.jpg)

> 🎭 *左边：模型对着几十张表硬写 SQL。右边：LangGraph 编排「接口优先 → SQL 回退 → HITL」。*

做问数 Agent，产品铁律其实很短：

> **能调已有 Java HTTP，就不写 SQL；找不到接口或要做聚合时，才跨库提案 SQL——且 SQL 必须人点确认。**

难的是把这条铁律跑成**可控、可观测、可恢复**的运行时。企业问数天然多分支：

*   有时一轮 `call_backend_api` 就够
*   有时要 `search_api` 扩检、换 endpoint
*   有时拐进 42 库 SQL，还要挂起等人
*   有时模型想空转重复调同一个工具——每空转一步都是完整规划 LLM 账单

手写 `while (steps++)` 也能跑通 Demo。等到要加「预检索省一轮 LLM」「HITL 挂起不发 done」「失败 nextAction 切轨」「流式把每一步甩给前端」，嵌套 generator 会迅速变成意大利面。

LangGraph 在这里的价值不是「用了框架」，而是：**把控制环画成显式图**——节点职责清晰，条件边可测，SSE 事件可以从节点里 `writer` 出去。

| 图要管的事       | DFC 里怎么落                               |
| ----------- | -------------------------------------- |
| 确定性步骤别烧 LLM | `pre_retrieve` 节点本地跑 `route_api`       |
| 规划 ↔ 工具循环   | `agent` ⇄ `tools` → `post_tools`       |
| 人在回路        | `awaitingInput` → `__end__`，resume 新开图 |
| 合成与落库       | `finalize`                             |
| 防空转 / 限步    | LoopGuard + `AGENT_MAX_STEPS` 在边上收敛    |

***

## 第一幕：把控制环画出来

> 🎭 *一张图：预取 → 规划 → 工具 → 挂起或合成。*

![dfc-main-flow.jpg](https://jiaxiantao.github.io/blogs/images/dfc-data-agent/dfc-main-flow.jpg)

````

编译入口在 `compileDfcAgentGraph`（`src/lib/agent/langgraph/graph.ts`）：

```typescript
return new StateGraph(DfcAgentState)
  .addNode("pre_retrieve", preRetrieveNode)
  .addNode("agent", agentNode)
  .addNode("tools", toolsNode)
  .addNode("post_tools", postToolsNodeWithHitl)
  .addNode("finalize", finalizeNode)
  .addEdge(START, "pre_retrieve")
  .addEdge("pre_retrieve", "agent")
  .addConditionalEdges("agent", routeAfterAgent, {
    tools: "tools",
    finalize: "finalize",
    __end__: END,
  })
  .addEdge("tools", "post_tools")
  .addConditionalEdges("post_tools", routeAfterTools, {
    agent: "agent",
    finalize: "finalize",
    __end__: END,
  })
  .addEdge("finalize", END)
  .compile();
````

五个节点，各管一段故事：

| 节点             | 实战职责                             |
| -------------- | -------------------------------- |
| `pre_retrieve` | 进 LLM 前本地跑接口路由，省一整轮规划            |
| `agent`        | bindTools 规划；首步可强制调工具            |
| `tools`        | ToolNode 执行；LoopGuard 拦重复调用      |
| `post_tools`   | 发现 `propose_sql` → HITL 挂起；或步数耗尽 |
| `finalize`     | 表格 / 流式答案 / 落库先于 `answer` 事件     |

条件边是整张图的「剧情转折」：

```typescript
/** 规划失败与 HITL 挂起直接收敛；有工具调用去执行；否则进合成 */
export function routeAfterAgent(state): "tools" | "finalize" | "__end__" {
  if (state.terminalError || state.awaitingInput) return "__end__";
  return shouldUseTools(state) === "tools" ? "tools" : "finalize";
}

/** HITL 挂起时本次运行到此为止，恢复是一次全新的图运行 */
export function routeAfterTools(state): "agent" | "finalize" | "__end__" {
  if (state.awaitingInput || state.terminalError) return "__end__";
  return afterToolsRoute(state) === "agent" ? "agent" : "finalize";
}
```

读到这里你会发现：LangGraph 实战的第一课，往往不是「怎么调 LLM」，而是 **把「继续 / 结束 / 换轨」写成可单测的路由函数**。

***

## 第二幕：State 比 Prompt 更像合同

图的状态用 `Annotation.Root` 声明（`state.ts`）。这不是装饰——它决定 resume、审计、前端步骤条能读到什么。

| 字段                             | 为什么需要                                                                |
| ------------------------------ | -------------------------------------------------------------------- |
| `messages`                     | LangChain 消息链（含 tool\_calls / ToolMessage），`messagesStateReducer` 追加 |
| `priorToolResults`             | 累积工具摘要；HITL 恢复时整包带进新图                                                |
| `stepCount` / `toolCallCount`  | 限步与 `done` 统计（一步可并行多工具）                                              |
| `pendingSql` / `awaitingInput` | 人在回路挂起标志                                                             |
| `terminalError`                | 规划失败直接 `__end__`，不再进 finalize                                        |
| `finalAnswer`                  | 合成结果                                                                 |

设计上有个小原则：**业务事实进 state，展示文案尽量走 SSE。** 前端靠 `config.writer` 推 `trace` / `tool_result` / `a2ui` / `awaiting_input`，图本身保持瘦。

HTTP 入口很薄——鉴权、限流、然后把消息交给 `runDfcAgentLoop`，由它 `compile` 后 `stream`：

```typescript
for await (const trace of runDfcAgentLoop(message, { resume, threadId, sso, ... })) {
  send(trace.type, trace);
}
```

LangGraph 在这里是**运行时心脏**；Next.js route 只是门卫。

***

## 第三幕：`pre_retrieve`——把确定性步骤挪出 LLM 循环

提示词铁律写着「任何问数先 `route_api`」。若交给模型第一轮自己调，**每个问题都多烧一整轮规划**——而路由本质是本地打分器。

所以 `pre_retrieve` 节点在进 `agent` 前直接跑掉：

```typescript
/**
 * 提示词的「铁律 1」要求任何问数都先调 route_api…
 * 这里在进入循环前直接把 route_api 跑掉，模型第一轮就能直接选 call_backend_api 或 propose_sql。
 * 失败一律降级为 null：预检索是加速手段，不能成为新的故障点。
 */
export async function preRetrieveApiRoute(question: string) {
  // 4s 超时；纯元数据问题（「有哪些表」）跳过
  const result = await withTimeout(runAgentTool("route_api", { question }), 4000);
  // 注入 HumanMessage：「不要再调 route_api，请直接推进…」
}
```

这是 LangGraph 实战里很典型的一招：

> **不是所有事都该进 ReAct 环。** 能本地算完的，做成图的前置节点；超时静默降级，别让加速手段变成新故障点。

纯 schema 探索（「有哪些表」）直接跳过预检索——否则白花时间。结果注入上下文后，手机号那类问题，模型第一轮就能 `call_backend_api`。

![image.png](https://jiaxiantao.github.io/blogs/images/dfc-data-agent/01.webp)

***

## 第四幕：`agent` ⇄ `tools`——循环怎么防空转

`agent` 节点做的事，和教程差不多：OpenAI 兼容模型 + `bindTools`。差别在企业约束：

*   **首步可强制调工具**（`tool_choice: "any"`），避免模型空口答「我猜客户在某某表」
*   工具结果经 MCP 调 Java HTTP——SSO / 门店 / serviceChain 在中间件注入，**禁止默认绕过**
*   `tools` 节点挂 **LoopGuard**：同参重复调用直接返回引导性 ToolMessage，不真执行

有个很现实的账：**每空转一步，都是一次完整规划 LLM 费用。** `maxSteps` 只兜最坏情况；LoopGuard 在「同参再调一次」时提前掐断。

图编排的业务工具大致是：

| 阶段     | 工具                                                    | 图上的位置             |
| ------ | ----------------------------------------------------- | ----------------- |
| 预检索    | `route_api`（系统代跑）                                     | `pre_retrieve`    |
| 接口     | `search_api` / `call_backend_api`                     | `agent`→`tools` 环 |
| SQL 探索 | `route_question` / `search_schema` / `describe_table` | 同上                |
| HITL   | `propose_sql`（禁止 planner 直接 `execute_sql`）            | `post_tools` 检测挂起 |
| 呈现     | `build_chart` + A2UI                                  | `finalize` 或确认后支线 |

接口失败时，工具 output 带结构化 `nextAction`（`propose_sql` / `search_api` / `retry_other_endpoint` / `sync_sso`）。**下一跳仍由 `agent` 读结果再规划**——图不硬编码业务 if-else，但通过 prompt + 工具契约把「失败该怎么拐」说清楚。

这是 ReAct 在企业里的正确姿势：图管控制流，工具契约管业务语义。

***

## 第五幕：HITL——故意不用 `interrupt()` 的那一章

当 HTTP 不可用（Dubbo-only、聚合统计、接口失败），Agent 会 `propose_sql`。`post_tools` 检测到后调用 `pauseForSqlConfirmation`：

*   写入 Redis `PendingSqlRun`（TTL 30 分钟 + 用户归属）
*   SSE 推确认卡 + `awaiting_input`
*   **不发 `done`**——前端攥着 `pendingRunId`
*   状态位置 `awaitingInput = true`，`routeAfterTools` 返回 `__end__`

源码注释写得很直白：

```typescript
/**
 * 这里不用 LangGraph 的 interrupt()：确认动作跨 HTTP 请求，interrupt 需要
 * 一个分布式 checkpointer 才能在多实例下恢复，而现有的 Redis pending-run
 * 已经提供了持久化、TTL 和 assertPendingOwnership 的归属校验。
 * 图在这里正常收敛到 END，恢复时以 prior 结果重新进图。
 */
```

这是整篇最值得带走的实战判断：

| 方案                                     | 适合              | DFC 为何没选 / 选了    |
| -------------------------------------- | --------------- | ---------------- |
| LangGraph `interrupt()` + checkpointer | 同进程 / 有官方持久化方案  | 跨请求 + K8s 多副本成本高 |
| Redis pending + 图正常 END + resume 新跑    | HTTP SSE 断连、多实例 | **当前选择**         |

用户 resume（`confirm_sql` / `cancel_sql` / `explain_sql` / `regenerate_sql`）时，不是「唤醒旧 checkpoint」，而是 **带着 `priorToolResults` 再 `createGraphInput` 编译跑一次**。`execute_sql` 仍不进 planner 工具集——只在确认分支里由运行时调用。

SQL 还要过只读 guard、表白名单、LIMIT、PII 脱敏。执行失败时有 `fixSqlFromExecutionError()`——常见事故是接口参数（如 `objCode`）被误写进 SQL。

![image.png](https://jiaxiantao.github.io/blogs/images/dfc-data-agent/02.webp)

***

## 第六幕：`finalize`、流式，以及图外的 resume 支线

`finalize` 负责收场：

1.  成功的 `call_backend_api` → 推 A2UI 表格
2.  结果无歧义时 **tryDirectAnswer** 跳过 LLM 合成（再省一笔）
3.  否则 `streamFinalAnswerFromState`
4.  **落库先于 `answer` 事件**——否则用户一刷新，这轮对话蒸发

```typescript
await options.onFinalAnswer?.({ text, mock, followUps });
emit(config, answerEvent({ text, mock, followUps }));
```

节点通过 `config.writer` 写自定义 SSE 事件（`stream-adapter`）。LangGraph 的 stream 模式在这里被接成前端熟悉的协议：`plan_stream`、`tool_call`、`a2ui`、`awaiting_input`、`answer_stream`、`done`。

还有一层常被忽略：Prompt **静态 / 动态分离**（长系统提示 vs 本轮问题上下文），方便兼容服务的 prefix caching——这不是图拓扑，但和「控制环省钱」是同一条产品线。

![image.png](https://jiaxiantao.github.io/blogs/images/dfc-data-agent/03.webp)

***

## 插曲：图在编排什么业务（接口优先）

LangGraph 是骨架；肉是大风车的接口目录与 42 库。

手机号理想路径：

    pre_retrieve(route_api) → agent → call_backend_api(MCP) → finalize

拐进 SQL 时：

    agent → route_question / search_schema → propose_sql → END(awaiting)
           →（用户确认）新图 / 运行时 execute_sql → 答案

实体消歧（「用户」是车牛还是 CRM）靠 glossary 注入 planner 上下文——**错表比错 SQL 语法更伤信任**。这和 Knowledge Studio 的文档 RAG 不同：那边管切片引用，这边管接口 / 库表选型；keyword-index RAG 只做轻量增强，不上向量库。

MCP 不是装饰：CRM 依赖登录态与门店上下文。图里的 tool 调用默认走 MCP，生产关闭本地 fallback。

***

## 和文档问答怎么分工

|      | Knowledge Studio | **DFC（LangGraph 问数）**        |
| ---- | ---------------- | ---------------------------- |
| 问题类型 | 非结构化文档           | 结构化数据 + 已有 HTTP              |
| 控制形态 | 单次检索 + chat      | **多节点状态机 + HITL**            |
| 第一动作 | 向量召回             | `pre_retrieve` → `route_api` |
| 核心风险 | 幻觉引用             | 错接口 / 空转烧钱 / 绕过 MCP / 错实体    |

前者几乎是管道；后者必须是图——因为有挂起、有回环、有多真相源。

***

## 快速上手

```bash
pnpm install && cp .env.example .env
# ANALYTICS_MYSQL_* + DFC_API_* + SSO
pnpm dev   # http://localhost:3000/agents
```

关键代码：

| 主题    | 路径                                 |
| ----- | ---------------------------------- |
| 编译图   | `src/lib/agent/langgraph/graph.ts` |
| State | `src/lib/agent/langgraph/state.ts` |
| 主循环入口 | `src/lib/agent/langgraph/index.ts` |
| 预检索   | `nodes/pre-retrieve.ts`            |
| HITL  | `nodes/hitl.ts`                    |
| 规划节点  | `nodes/plan-or-act.ts`             |

文档：[architecture.md](https://git.souche-inc.com/dfc-ai/dfc-data-agent/-/blob/master/docs/architecture.md) · [mcp-dfc-api.md](https://git.souche-inc.com/dfc-ai/dfc-data-agent/-/blob/master/docs/mcp-dfc-api.md)

***

## 收场：LangGraph 实战 checklist

故事压成一句：

> **用 StateGraph 把问数控制环画清楚；确定性步骤做成前置节点；跨请求 HITL 可以 END + Redis resume，不必强上 interrupt。**

若你也在用 LangGraph 做垂直 Agent，建议对照：

*   [ ] 节点是否按「可测路由」拆开，而不是一个巨石 node？
*   [ ] 有没有把本地可算步骤挪出 LLM 环（类似 `pre_retrieve`）？
*   [ ] 空转是否在 tool 层被 Guard，而不只靠 maxSteps？
*   [ ] HITL 是 interrupt + checkpointer，还是 END + 外部 pending？理由写进注释了吗？
*   [ ] 流式事件是否从节点 `writer` 出去，方便前端逐步条？
*   [ ] resume 是唤醒旧 state，还是 prior 结果进新图？多实例下哪种更简单？

下次有人问「LangGraph 在业务里到底干什么」，你可以把手机号那条路径画给他看——**图画完，实战也就讲完了。**

仓库：[git.souche-inc.com/dfc-ai/dfc-data-agent](https://git.souche-inc.com/dfc-ai/dfc-data-agent)

***
