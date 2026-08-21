<!-- post-id: 11c00ceaee6446dc -->

# DeepSeek Harness 上手：一切皆插件的 Agent 运行时，核心流程怎么走

> 发布日期：2026-08-21\
> 标签：DeepSeek / Agent Harness / Cordis / 插件架构 / Tool Calling / 工程实践\
> 项目：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)

你已经会用 Cursor、Claude Code，也写过自己的 Tool Calling 循环。然后 DeepSeek 开源了一个叫 **Harness** 的东西。

第一反应通常是：这不就是又一个 Agent 框架吗？

clone 下来看一眼仓库，会改口。`packages/` 里不是「一个 loop + 一堆 utils」，而是上百个小包：session、tools、llm、sandbox、approval、subagent……**连 agent loop 本身也是插件。** 产品口号写得很硬：

> **Everything is a plugin.**

本篇跟着一次真实提问，把 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（CLI 名 `dsh`，当前开发者预览 **0.1.0-rc.8**）的**核心流程**和**基本使用**走通。不讲插件作者手册的全量细节，只讲：它到底在编排什么、你怎么把它跑起来。

全文约 14 分钟。读完你应该能讲清三件事：

1.  Harness 和「写一个 Agent 循环」差在哪
2.  用户发一句话之后，turn / step / session log / 工具流水线怎么接
3.  Web UI、headless、Python SDK 三条入门路径怎么选

***

## 开场：Harness 不是聊天框，是可拆的马具

![dsh-hero-plugin-tree.jpg](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/fc6f1badc38f48c08bb023d37431c115~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1787907524&x-orig-sign=PiZlGtb%2BADFwX%2BJ55l2AXPii6Fw%3D)

> 🎭 *左边：一根缠死的循环。右边：session / tools / llm / loop 各自是可拔插的插件卡。*

Agent 产品真正难的，往往不是「能不能调工具」，而是：

*   换模型、换沙箱、换审批策略时，要不要改循环内核
*   一次对话的事实，能不能从日志完整重放
*   插件卸载后，监听器和工具会不会泄漏

DeepSeek Harness 的答案是把运行时建在 [Cordis](https://github.com/cordiverse/cordis) 上：插件向共享 `ctx` 贡献**服务、类型化事件、可逆副作用**。模型适配器、工具注册表、会话日志、循环驱动器，全部挂在同一棵树上，**没有需要打补丁的特权内核**。

用他们自己的话说：扩展方式是把插件挂到旁边，而不是去改 loop。注册都走 `ctx.effect()` / `ctx.on()`，卸载时自动撤销。

这就是「harness」这个词的意思——马具：模型是马，工具和工作区是蹄铁，Harness 负责把缰绳、鞍具、闸门装成一套能换件的装备。

***

## 第一幕：先把它跑起来

最快的路径不 clone 源码：

```sh
npx @deepseek-ai/dsh web
```

默认在 `http://127.0.0.1:3080` 起 Web UI，本机还会自动打开浏览器。SSH 远程启动时只打印 URL（本地转发地址归 SSH 客户端管）。`--no-open` 则只起服务。

从你已经 clone 的仓库跑：

```sh
cd /path/to/deepseek-harness
pnpm install          # Node ^22.19 或 >=24，pnpm 11
pnpm run build
pnpm dsh web
```

`build` 负责产物；`pnpm dsh web` 直接用已构建产物，不会顺手再编一次。

然后三步就能发第一条任务：

1.  **设置 → 模型**：填 [DeepSeek API Key](https://platform.deepseek.com/)，保存即生效，不用重启
2.  **选择工作区**：把启动 `dsh` 时所在的项目目录加进去（不选工作区，输入框是灰的）
3.  开一个会话，发一句：

> Summarize this repository and identify its main packages.

Agent 可以读改文件、跑命令、委派子任务、维护计划。当前权限策略要求审批时，Web UI 会先问你。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/1951f72959c74ec7b3564b677a194090~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1787907524&x-orig-sign=ryBUDTh1uvoG%2FpLJzSXOIoGzswM%3D)

密钥是只写的，落在 `$DSH_HOME/.credentials.yaml`，设置页只保留凭据引用。Anthropic / OpenAI 以及公司网关，走「添加提供方 / 自定义提供方」；自定义要给永久 Provider ID、base URL、协议和至少一个模型。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/24b667a05ba04cf2ad0754a87cf66f0b~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1787907524&x-orig-sign=h0rUouvCEYESNXy53iFnTYUXi5g%3D)
不想开浏览器时，用 **headless**：跑一个全新持久化会话，打印最终答案就退出——

```sh
export DEEPSEEK_API_KEY=sk-...
pnpm dsh --profile headless "Summarize this repository and list main packages."
```

启动时所在目录就是默认 workspace 根。`web` / `headless` 首次使用会从模板自动初始化；其他 profile 要用 `dsh plugin` 创建。

***

## 第二幕：启动时到底组装了什么

`dsh` 不是「启动一个 Node 服务」那么简单。每次运行，都是把一棵 **插件树** 按层叠起来：

```text
空配置
  → profile 列出的 bundles（按顺序）
  → 该 profile 的 cordis.patch.yml
  → home 级 $DSH_HOME/cordis.patch.yml
  → 命令行 --patch 覆盖层
```

两个关键词：

| 词           | 是什么                                                                  |
| ----------- | -------------------------------------------------------------------- |
| **profile** | 放在 Harness home 里的具名组装。列出叠哪些 bundle，还能装树外插件。发行版带 `web`、`headless` 模板 |
| **bundle**  | Cordis 配置行 + 它挂载的代码。插入的内容永远能被上层 patch 掉                              |

每个 bundle / profile 在自己的 `package.json` 里用 `dsh` 字段声明。几乎所有 profile 的第一层都是 **`dsh-base`**：模型适配器、工具、持久化、沙箱与审批、设置、凭据、遥测。`dsh-web-app` 再叠浏览器应用；`dsh-headless` 叠一次性运行器、不带 HTTP 服务。

想看自己机器实际会启动什么，不必真的跑 Agent：

```sh
pnpm dsh --profile web --dump-config
```

打印出来的每一行，都可以被你自己的 patch 整段替换。这是后面「写第一个插件」能直接 `--patch` 进去的原因。

核心服务挂在 `ctx` 上，插件按 key 找，不 import 具体实现：

| 包                    | 管什么                       | `ctx` 键            |
| -------------------- | ------------------------- | ------------------ |
| `core/session`       | 只追加的 `SessionEvent` 日志    | `ctx.sessions`     |
| `core/system-prompt` | 提示词片段 + 工具 schema 组装      | `ctx.systemPrompt` |
| `core/tools`         | 作用域化工具注册与带闸门的执行           | `ctx.tools`        |
| `core/agent`         | Agent 接口、注册表、`agent/*` 事件 | `ctx.agents`       |
| `core/agent-loop`    | 默认循环驱动器                   | `ctx.agentLoop`    |
| `llm/llm`            | 流式词汇表 + 适配器 seam          | `ctx.llm`          |

文档里反复强调：**仓库里只有 `agent-loop` 装着具体循环逻辑。** 新能力往插件上挂，不要去改这段驱动器。

***

## 第三幕：一句话进去之后——turn 与 step

![dsh-turn-step-loop.jpg](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/5cbdfcee9bc54c988626ddaac243694f~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1787907524&x-orig-sign=SsTVze1h5Lbe1TJ61zkmsI%2BmvI8%3D)

> 🎭 *TURN → CLAIM → PRE-STEP → LLM → TOOLS → TURN END；旁边那卷纸是只追加的 session log。*

这是全文最该记住的主流程。

一个 **step** = 一次模型请求 + 它调用的工具。\
一个 **turn** = 零个或多个 step：领到第一条输入之前打开，不再欠任何工作时关闭。

官方把控制流写成：

```text
turn/start
  领取 next-step 输入 + 一条排队消息
  组装 prompt sections + tool schemas
  -> agent/pre-step          reject | enter(messages)
     拒绝，或第一次 enter 被改成空 -> 关掉这个没有 step 的 turn
     step/start
     把 enter 的消息追加为 user/message
     从日志派生模型历史
     agent/request -> llm/stream -> assistant/chunk* -> assistant/message
     tool/call* -> tools/pre-execute -> tools/execute -> tools/post-execute -> tool/result*
     step/end
     工具还欠一次请求，或又来了 next-step 输入 -> 再领 -> 下一 step
  -> agent/turn-stopping
turn/end
```

可以把它想成一条有闸门的流水线：

1.  **Inbox 叫醒驱动器。** `followup()` 进下一轮队列并唤醒；`steer()` 进 next-step 并唤醒；`inject()` 同样进 next-step，但**不唤醒**——上下文先躺着，等真正的用户消息来了再一起进模型。
2.  **`agent/pre-step` 决定模型看见什么。** 这是 waterfall：监听器必须 `next()` 才能交给下游，也可以改写或直接拒绝。拒绝不等于「没发生」——日志仍会留下一个没花 step 的 turn。
3.  **请求走 `agent/request` → `llm/stream`。** 流式 chunk 先落成 `assistant/chunk`，完整回复再落 `assistant/message`。UI 回放靠 chunk，模型下一轮历史靠从日志派生。
4.  **工具不直连循环。** 先记 `tool/call`，再过权限 / 沙箱 / 审批，执行，最后只给模型看一条 `tool/result`。
5.  **自然停止时发 `agent/turn-stopping`**（serial，没有 `next()`），然后 `turn/end`，状态回到 idle。

事件分三域，选错域是改代码时最常见的第一步错误：

| 域        | 例子                                                          | 何时用                        |
| -------- | ----------------------------------------------------------- | -------------------------- |
| 会话事件     | `turn/start`、`user/message`、`assistant/chunk`、`tool/result` | 必须能重放、刷新后还在                |
| Agent 事件 | `agent/pre-step`、`agent/request`、`agent/status`             | 拦截进行中的工作                   |
| 能力事件     | `fs/*`、`tools/*`                                            | 给文件系统、工具闸门加策略，不必 import 循环 |

有一条不变量写进架构文档，也写进测试：

> **Model-visible ⟺ logged。** 凡是进了模型请求的内容，必须能从 session log 重建。

所以你不能偷偷往 prompt 里塞一段「只有内存知道」的话。新的模型可见输入，就要新增一种 session 事件。Fork、resume、transcript、遥测，全部从同一条只追加日志投影出来。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/0cf8e921c24a413096c59c6465125c34~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1787907524&x-orig-sign=xwP%2FRE9CmngAeYp%2FSDeCmp5Ljb8%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/489300a196784edaaf21567b67bd78f1~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1787907524&x-orig-sign=GXgohXqGKR51uYYLeP56fSC1BfQ%3D)

***

## 第四幕：工具调用不是 `execute()` 一句完事

模型吐出 tool-call 之后，Harness 走的是一条**故意很长**的流水线——这样审批、沙箱、超时、结果改写都不必改 loop。

简化后是：

```text
assistant 消息里的 tool-call
  → 先记 tool/call（执行前就落日志，UI 能出 pending 卡）
  → tools/pre-execute（hooks、权限、沙箱；可 deny / 问人）
  → 单调 guards（拒绝或弃权）
  → tools/execute（超时、重试包住真正的 execute()）
  → 写文件还要过 fs/write-intent
  → tools/post-execute（接受、拦截、替换、补上下文）
  → finalizeContent → tools/result → 记 tool/result
```

需要人点头时，走 `ctx.approval`；无人应答或取消，当作拒绝，**不会默默执行**。Code Mode 里的 `run_code` 子调用也走同一条管道，拒绝会变成绑定失败，而不是绕过闸门。

这和「在 loop 里 if 一下危险工具」是两种工程品味：前者把策略做成可叠加的 waterfall，后者改一次循环就要回归全部工具。

***

## 第五幕：三条入门路径，怎么选

| 你想做什么            | 用哪条                                   |
| ---------------- | ------------------------------------- |
| 先看看长什么样          | `npx @deepseek-ai/dsh web`            |
| 改源码、跟文档做插件教程     | clone + `pnpm build` + `pnpm dsh web` |
| CI / 脚本里跑完就退出    | `dsh --profile headless "任务"`         |
| 从 Python 调同一套运行时 | `pip install deepseek-harness-sdk`    |

Python SDK 通过 JSON-RPC stdio 拉起内置运行时，**常规安装不需要本机再备一份 Node**。最小例子：

```python
from deepseek_harness import DeepSeekHarness

with DeepSeekHarness() as harness:
    result = harness.run("Say hi.")
print(result.final_response)
```

指定工作区、会话目录和模型（仓库 `examples/jsonrpc-agent/minimal.py` 是完整包装）：

```python
from pathlib import Path
from deepseek_harness import DeepSeekHarness

with DeepSeekHarness(
    provider="deepseek-official",
    model="deepseek-v4-flash",
    cwd="/absolute/path/to/workspace",
    session_root="/absolute/path/to/sessions",
) as harness:
    result = harness.run(
        "Inspect the repository and fix the failing tests.",
        session_id="example-001",
    )
print(result.final_response)
```

会话目录会落下 JSONL：组装后的模型请求和工具调用都在里面——又一次呼应「模型看见的，必须能从日志重建」。

环境变量：`DEEPSEEK_API_KEY` 必填；走 OpenAI 兼容代理时再设 `DEEPSEEK_BASE_URL`。可选 `DSH_MODEL`、`DSH_SYSTEM_PROMPT`。

CLI 有个容易踩的点：**启动器自己的 flag 必须写在最前面**，它不认识的第一个 token 开始算应用参数——

```sh
dsh --profile web --port 8080          # --port 属于 web 应用
dsh --profile headless "run the tests"
dsh --help                             # 启动器帮助
dsh --profile web --help               # web 应用帮助
```

***

## 插曲：最小插件长什么样

官方教程的「Hello」已经能说明扩展模型。插件就是导出 `apply(ctx)` 的模块：

```ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'hello-plugin'

export function apply(ctx: Context) {
  console.log('[hello-plugin] plugin loaded!')
}
```

用 overlay 插进 web profile，路径必须是绝对路径：

```yaml
# scratch-plugin/cordis.yml
- insert:
    - id: hello
      name: '/absolute/path/to/deepseek-harness/scratch-plugin/src/my-plugin.ts'
```

```sh
pnpm dsh web --patch ./scratch-plugin/cordis.yml
```

终端会打出 loaded。注册工具时声明 `inject = ['tools']`，等注册表就绪再 `ctx.tools.register(defineTool({...}))`。通过 `ctx` 挂上的监听和工具，卸载时自动清掉；自己 new 出来的连接，用 `ctx.effect()` 告诉框架怎么拆。

这就是「一切皆插件」落到手指上的触感：你几乎从不 fork loop，只往树上再插一张卡。

***

## 收场：一张图，和一张对照表

把核心流程压成一句：

> **Profile 叠出一棵 Cordis 插件树；agent-loop 按 turn/step 驱动；凡进模型的内容都先写进只追加的 session log；工具则走独立的 pre/execute/post 闸门。**

对照自己有没有「Harness 思维」：

*   [ ] 换模型 / 换沙箱，是改配置还是改循环？
*   [ ] 一次对话能否只靠日志重放，而不靠内存里的隐藏 prompt？
*   [ ] 工具审批、超时、结果改写，是否不必碰 loop？
*   [ ] 新能力是 `apply(ctx)` 一张插件卡，还是往巨石文件里加 if？

仓库还在开发者预览，**会有破坏性变更**。适合现在读的，不是把 API 背下来，而是把这条控制流装进脑子——后面无论他们怎么拆包，turn、log、waterfall 这三件事大概率还在。

项目：[github.com/deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)\
架构：[docs/architecture.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md) · Web 指南：[docs/user/guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/index.md)

***
