# AI 生成代码之后，前端 Code Review 审什么？

> 发布日期：2026-07-02\
> 标签：前端 / Code Review / AI 编程 / Cursor / 工程质量 / 工程实践

团队里 Cursor 普及之后，MR 数量涨了，diff 行数也涨了——但大家花在 Review 上的时间并没有等比例下降。

原因很简单：**AI 写的代码，看起来更像「正经代码」了**。

命名规范、类型齐全、注释像模像样，Lint 和单测还能绿灯。Reviewer 扫一眼 diff，容易下意识觉得「这活儿干得挺利索」——直到上线后才发现：权限漏了、竞态埋了、空列表炸了、设计稿差了 8px。

我在 [Cursor 一年复盘](https://juejin.cn/post/7656751882112565275) 里写过：**不信任任何未读 diff 的提交**。AI 时代，这句话要从个人习惯变成团队纪律。但「读 diff」之后审什么？哪些可以放权给机器，哪些必须人盯？

这篇文章给你一份 **前端视角的 AI Code Review 指南**：一张分层审查表、一份可直接贴进 MR 模板的 Checklist，以及三类「能跑但不该合并」的真实案例。

***

## 一、先摆正心态：Review 不是找茬，是最后一道责任门

AI 生成代码之后，Code Review 的角色变了，但没有消失。

    以前：Review = 查逻辑 bug + 统一风格 + 传授经验
    现在：Review = 查 AI 系统性盲区 + 验证业务边界 + 对结果负责

三件事同时成立：

1.  **部分审查可以自动化**——格式、命名、基础类型、Lint 规则，CI 比人更稳定。
2.  **人的审查重心上移**——从「这行代码怎么写」转向「这段代码该不该存在、会不会伤人」。
3.  **Reviewer 仍然是责任人**——合并按钮按下去的人，对线上结果负责，不管代码是谁写的。

这和 [不可替代竞争力](https://juejin.cn/post/7656751882112630811) 里说的「判断力」是同一回事：**AI 什么都敢写，人来决定什么能进主分支。**

***

## 二、一张分层审查表：什么可以少审，什么必须严审

| 审查维度            | AI 通常做得不错 | 建议                | 审查强度  |
| --------------- | --------- | ----------------- | ----- |
| 代码格式 / 缩进       | ✅         | 交给 Prettier + CI  | ⬜ 可忽略 |
| 命名规范 / 文件位置     | ✅         | ESLint + Rules 约束 | ⬜ 低   |
| 标准组件骨架          | ✅         | 对照团队模板扫一眼         | ⬜ 低   |
| TypeScript 基础类型 | ✅         | `tsc` 绿灯 ≠ 类型正确   | 🟨 中  |
| 按文档写 API 请求层    | 🟡        | 核对文档版本和真实响应       | 🟨 中  |
| 单元测试骨架          | 🟡        | 看测的是行为还是实现        | 🟨 中  |
| **权限与鉴权**       | ❌         | 前端隐藏 ≠ 安全         | 🟥 高  |
| **异步竞态 / 时序**   | ❌         | AI 高频翻车区          | 🟥 高  |
| **边界态 / 异常态**   | ❌         | 常只覆盖 happy path   | 🟥 高  |
| **性能与渲染**       | ❌         | 多余重渲染、大列表         | 🟥 高  |
| **无障碍 (a11y)**  | ❌         | 几乎每次都要补           | 🟥 高  |
| **安全与隐私**       | ❌         | XSS、敏感信息泄露        | 🟥 高  |
| **架构一致性**       | ❌         | 发明新范式             | 🟥 高  |
| **业务规则**        | ❌         | 缺少组织上下文           | 🟥 高  |

记住一个原则：

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/d81171489f4a4c9d8f809603c349b5bf~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1783563517&x-orig-sign=NVN6z8hqTk0UthjkWQt5SpQWSlA%3D)

***

## 三、必须严审的八个维度（附审查要点）

### 1. 权限与鉴权：前端隐藏不是安全

AI 最常见的模式：`if (!hasPermission) return null`——按钮不显示，看起来没问题。

**必须追问**：

*   路由层面有没有守卫？直接输 URL 能进吗？
*   接口层有没有独立校验？绕过 UI 调 API 会怎样？
*   「无权限」是隐藏还是展示禁用态？产品要求一致吗？
*   权限变更后（登出、切换账号），状态有没有清干净？

```tsx
// ❌ AI 常生成：只藏 UI
if (!canExport) return null;
return <ExportButton onClick={handleExport} />;

// ✅ 应该审：UI + 操作双重守卫
if (!canExport) {
  return <Tooltip title="暂无导出权限"><ExportButton disabled /></Tooltip>;
}
const handleExport = async () => {
  if (!canExport) return; // 操作层再拦一次
  await exportOrders(selectedIds);
};
```

### 2. 异步竞态：AI 的「隐形杀手」

[Cursor 复盘](https://juejin.cn/post/7656751882112565275) 里提过：生产白屏、偶现错乱，十有八九出在时序。

**审查信号**：

*   `useEffect` 里直接 `fetch`，没有 cleanup / abort
*   快速切换 Tab、路由、筛选条件时，旧请求覆盖新结果
*   弹窗关闭后 setState，控制台 warning
*   依赖数组不完整或过度依赖

```tsx
// ❌ 典型 AI 输出
useEffect(() => {
  fetchOrders(filters).then(setOrders);
}, [filters]);

// ✅ Review 时应要求
useEffect(() => {
  const controller = new AbortController();
  fetchOrders(filters, { signal: controller.signal })
    .then(setOrders)
    .catch(err => {
      if (err.name !== 'AbortError') setError(err);
    });
  return () => controller.abort();
}, [filters]);
```

**审查动作**：手动快速切换筛选条件 3 次，看列表数据是否错乱。

### 3. 边界态：happy path 之外的 80%

AI 生成的 UI，逻辑上「能演示」，但边界态经常缺失。

**每个功能至少审这 7 种状态**：

| 状态      | 审查问题                     |
| ------- | ------------------------ |
| 空数据     | 空列表有没有引导？骨架屏还是白屏？        |
| 加载中     | 首次加载 vs 刷新加载是否区分？        |
| 加载失败    | 有重试吗？错误信息对用户友好吗？         |
| 权限不足    | 隐藏、禁用、还是跳转？              |
| 部分成功    | 批量操作失败 3 条成功 7 条怎么展示？    |
| 超长文本    | 用户名 50 字、标题 200 字会撑破布局吗？ |
| 弱网 / 超时 | 30s 无响应用户看到什么？           |

**快捷法**：让 Author 附一张 **状态矩阵截图**，Reviewer 对照审，比干读 diff 高效得多。

### 4. 类型与接口：「编译过了」不等于「类型对了」

AI 按语雀文档生成类型，常见问题：

*   文档过期，字段名差一个字母
*   后端多套了一层 `data` / `result`
*   枚举值不全，用了 `string` 糊弄
*   可选字段实际上必传，或反过来

**审查动作**：

*   对照最新接口文档（或用 [MCP 拉语雀](https://juejin.cn/post/7657074612481261603) 核对）
*   看 Network 面板真实响应，不只看 TypeScript
*   对关键 DTO **要求 Author 贴一条真实响应样例** 在 MR 描述里

### 5. 性能与渲染：能跑 ≠ 流畅

**高频问题**：

*   列表页没有虚拟滚动，AI 直接 `items.map`
*   在 render 里创建新对象 / 新函数，导致子组件无意义重渲染
*   大依赖库整包引入（如图表、编辑器）
*   `useEffect` 触发链过长，形成级联请求
*   图片没有懒加载、没有尺寸占位

**审查信号**：

```tsx
// ❌ 每次 render 新建 columns，表格必重渲染
const columns = [
  { title: '名称', render: (_, row) => <NameCell row={row} /> },
];

// ✅ 应抽到组件外或用 useMemo，并审 render 是否必要
const columns = useMemo(() => [...], [deps]);
```

**审查动作**：Chrome Performance 录 5 秒滚动列表；React DevTools 看 Highlight Updates。

### 6. 无障碍：不是锦上添花

AI 生成的交互组件，a11y 遗漏率极高。

**必审项**：

*   图标按钮有没有 `aria-label`
*   表单错误是否关联到字段（`aria-describedby`）
*   弹窗焦点是否 trap、关闭后焦点是否回归
*   颜色对比度是否达标（尤其 disabled、placeholder）
*   键盘能否完成全流程（Tab / Enter / Esc）

**审查动作**：不开鼠标，纯键盘走一遍主流程；iOS VoiceOver 或 Mac VoiceOver 读一遍。

### 7. 安全：XSS 与敏感信息

**必审项**：

*   `dangerouslySetInnerHTML` 有没有消毒
*   URL 参数直接插入 DOM / `eval` / `innerHTML`
*   日志、报错上报有没有带 token、手机号、身份证
*   第三方脚本加载有没有 SRI / CSP 意识
*   `target="_blank"` 有没有 `rel="noopener noreferrer"`

AI 为了「快速实现富文本」很爱用 `dangerouslySetInnerHTML`——这是 Review 红线。

### 8. 架构一致性：不要发明新范式

Agent 改太多文件时，容易 **在项目里引入第四套数据请求方式**。

**审查信号**：

*   项目用 TanStack Query，MR 里突然出现手写 `useEffect + fetch`
*   已有 `useOrderList` Hook，又新建 `useFetchOrders`
*   样式突然混用 CSS Modules + Tailwind + 行内 style
*   状态管理：该用 URL 的放进了全局 store

**审查原则**：**新代码 follow 旧模式**。不是新模式不好，而是 AI 随意引入的「更好」往往没有迁移计划。

***

## 四、可以放权给机器的审查（配好 CI 就行）

以下项不必人肉逐行审，但 **CI 必须挡住**：

| 自动化项 | 工具                       | 说明                                  |
| ---- | ------------------------ | ----------------------------------- |
| 格式   | Prettier                 | `format:check` 进 CI                 |
| 静态检查 | ESLint                   | 含 a11y 插件（`eslint-plugin-jsx-a11y`） |
| 类型   | `tsc --noEmit`           | 绿灯是必要条件，非充分条件                       |
| 单元测试 | Vitest / Jest            | 看覆盖率趋势，不迷信 100%                     |
| 包体积  | bundlewatch / size-limit | 防 AI 整包引入大库                         |
| 依赖安全 | `npm audit` / Snyk       | 防供应链风险                              |

**团队约定**：CI 红灯的 MR 不进入人工 Review，节省双方时间。

***

## 五、三类「能跑但不该合并」的真实案例

### 案例 A：「导出功能」——权限只藏了按钮

**背景**：订单列表加批量导出，AI 生成完整流程，演示顺利。

**问题**：

*   无 `order:export` 权限的用户看不到按钮——但 DevTools 直接调 `exportOrders` 接口，仍然成功
*   后端其实有鉴权，但前端把 `orderIds` 明文打在日志里

**Review 应抓住**：操作层守卫 + 日志脱敏。合并前要求补权限测试用例。

**教训**：**UI 层权限是体验，不是安全边界**——但前端 Review 要推动两端一致，并避免泄露敏感数据。

### 案例 B：「搜索联想」——竞态让结果张冠李戴

**背景**：搜索框加联想，输入「北京」再快速删成「上」，最终显示「上海」的联想结果。

**问题**：AI 生成的 debounce + fetch 没有 abort，后发先至。

**Review 应抓住**：要求录屏演示快速输入场景；补 abort 或 requestId 比对。

**教训**：**所有异步搜索、筛选、分页，默认按有竞态审**，不要等 QA 提 bug。

### 案例 C：「活动页」——测试绿灯但测的是幻觉

**背景**：Agent 写了 12 个测试全绿，Reviewer 看到绿灯放行了。

**问题**：

*   mock 了整个 API 层，断言的是 mock 被调用，不是用户看到的结果
*   空列表 case 断言 `container.innerHTML` 包含某个 class——实现改了就挂，但行为没人测
*   关键路径「领取失败」没有 case

**Review 应抓住**：读测试文件，不只看 CI 图标。问一句：**「删掉实现代码，测试能红吗？」**

**教训**：AI 时代的测试 Review，核心是 **验证测试是否约束了行为，而不是陪跑**。

***

## 六、一份可直接用的 MR Review Checklist

复制进 MR 模板或 GitLab Description：

```markdown
## AI 辅助生成代码 Review Checklist

### 自动化（CI 必须通过）
- [ ] lint / typecheck / test 绿灯
- [ ] 无超量 bundle 增长

### 逻辑与边界
- [ ] 空 / 加载 / 错误 / 权限 / 部分成功 已覆盖
- [ ] 异步请求有 abort 或竞态处理
- [ ] 接口类型与最新文档 / 真实响应一致

### 权限与安全
- [ ] 敏感操作有 UI + 逻辑双重守卫
- [ ] 无 XSS 风险（innerHTML / URL 注入）
- [ ] 日志 / 上报无 token、PII 泄露

### 体验与 a11y
- [ ] 对照设计稿（或 Figma MCP 输出）检查关键间距 / 颜色
- [ ] 键盘可完成主流程
- [ ] 图标按钮有 aria-label

### 架构
- [ ] 未引入与项目不一致的新范式
- [ ] 改动范围与 MR 描述一致（无 scope creep）
- [ ] 公共组件改动已评估影响面

### 测试
- [ ] 测行为不测实现
- [ ] 关键边界有用例
- [ ] Author 已自测并附截图 / 录屏
```

***

## 七、AI 时代 Review 工作流：怎么审才高效

### 7.1 Author 侧：提交前自检

在 [MCP 工作流](https://juejin.cn/post/7657074612481261603) 的基础上，提交 MR 前多一步：

    1. Agent 完成代码 → 跑 lint / test / typecheck
    2. 用 Ask 模式让 Agent 对照 Checklist 自查，输出「未通过项」
    3. 人审 Agent 的自查结果（它也会漏）
    4. 附状态矩阵截图 + 关键路径录屏
    5. 提交 MR，在描述里标注「哪些文件是 AI 生成 / 大改」

**标注 AI 生成不是示弱**，是帮 Reviewer 提高警觉——就像药品说明书标注副作用。

### 7.2 Reviewer 侧：15 分钟高效审法

| 顺序 | 看什么                    | 时间    |
| -- | ---------------------- | ----- |
| 1  | MR 描述：需求、边界、自测证据       | 2 min |
| 2  | 改动文件清单：有没有 scope creep | 1 min |
| 3  | 权限 / 安全 / 接口相关 diff    | 5 min |
| 4  | 异步逻辑 / 状态管理 diff       | 3 min |
| 5  | 测试文件：测的是啥              | 2 min |
| 6  | 本地拉分支，走一遍主流程 + 一个边界    | 2 min |

**不要**从第一行 CSS 开始看。**先看会伤人的，再看好不好看。**

### 7.3 用 Agent 辅助 Review（但不能替代人）

可以让 Cursor 做 **预审查**：

    【Ask 模式】读当前分支 diff，对照以下 Checklist 输出风险项：
    1. 权限守卫是否完整
    2. useEffect 是否有竞态风险
    3. 是否只用了 happy path
    4. 是否引入了新范式
    5. 测试是否测了行为

    按 P0 / P1 / P2 分级，不要改代码。

Agent 预审查能抓 **模式化问题**（缺 cleanup、危险 API），但 **业务规则、产品取舍、设计细节** 仍要人判。

***

## 八、团队层面：把 Review 标准写进 Rules

个人习惯之上，团队可以固化：

### 8.1 `.cursor/rules` 里加 Review 约束

```markdown
## 生成代码必须符合（Review 红线）

- 禁止 dangerouslySetInnerHTML，除非有 DOMPurify 且 MR 说明原因
- 所有 useEffect 中的 fetch 必须有 cleanup
- 权限判断不得仅 return null，需与产品约定 disabled / 隐藏策略
- 新 Hook / 工具函数不得与 src/hooks/ 已有实现重复
- 列表组件超过 50 条必须考虑虚拟滚动或分页
```

AI 生成时就被约束，比事后 Review 返工便宜。

### 8.2 CODEOWNERS + 高风险路径

    # 高风险路径必须资深 Review
    src/features/payment/     @senior-frontend
    src/utils/auth/           @security-champion
    src/api/                  @api-owner

AI 越普及，**高风险目录越不能省 Review 人**。

### 8.3 Review 文化：对事不对人

AI 生成代码的 MR，更容易出现「这不是我写的」心态——Reviewer 怕伤和气，Author 懒得改。

团队需要明确：

*   Review 的是 **即将上线的行为**，不是 Author 的能力
*   AI 生成的烂代码 **不降低合并标准**
*   「CI 过了」不是 Review 通过的理由

***

## 九、常见误区

### 误区 1：「AI 写的，所以 Review 可以松一点」

恰恰相反。**应该更严**——因为 AI 会以同等自信产出正确和错误的代码，且 diff 更长、更容易藏问题。

### 误区 2：「小需求不用审」

一行 `dangerouslySetInnerHTML`、一个没 abort 的 `useEffect`，都足以制造 P0 事故。按 **风险** 不按 **行数** 决定审查深度。

### 误区 3：「测试绿了就行」

[Cursor 复盘](https://juejin.cn/post/7656751882112565275) 坑 5 专门讲过：mock 过度的测试是安慰剂。

### 误区 4：「Review 要逐行抠风格」

把风格交给 Prettier 和 ESLint。Reviewer 的时间是有限的，**花在安全和体验上回报率更高**。

### 误区 5：「资深才需要做 Review」

AI 降低了写代码门槛，也降低了 **埋雷概率的感知**。新人 MR 更需要 Review——不是不信任，是保护他和用户。

***

## 十、行动清单

*   [ ] 把本文第六节 Checklist 贴进团队 MR 模板
*   [ ] 在 `.cursor/rules/` 加入 Review 红线
*   [ ] CI 补齐：lint、typecheck、test、a11y lint、bundle size
*   [ ] 下一次 Review 先审权限 / 竞态 / 边界态，再审样式
*   [ ] 要求 AI 辅助 MR 标注生成范围 + 附自测录屏
*   [ ] 复盘最近一次线上 bug：Review 本能否拦住？

***

## 结语

AI 让写代码变快了，但没有让 **「合并进主分支」** 变轻。

前端 Code Review 在 2026 年的核心价值，越来越接近一句话：

> **机器负责产出，人负责后果。**

格式、样板、基础类型——交给工具。权限、竞态、边界、安全、体验、架构——留给人。这不是倒退，是分工进化。

你会用 Cursor 写代码，会用 MCP 拉文档——下一步，是成为那个 **AI 时代最靠谱的 Reviewer**。因为最终对线上用户负责的，不是模型，是按合并按钮的人。

***
