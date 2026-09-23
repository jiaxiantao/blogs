<!-- post-id: bbcf6d2259d94f5d -->

# cos-design 4.0：91 个特效组件一次捅成 React / Vue / Web Components / Core

> 发布日期：2026-09-23  
> 标签：前端 / 组件库 / 架构 / React / Vue / Web Components / Canvas / cos-design / 工程化  
> 仓库：[github.com/jiaxiantao/cos-design](https://github.com/jiaxiantao/cos-design) · 版本：`cos-design@4.0.0` · [Playground](https://jiaxiantao.github.io/cos-design/)

做过营销页的人都懂：烟花、刮刮乐、天气背景、霓虹标题……这些「特效层」一旦写进业务，就会被下一份需求问：

> 「我们 Vue 项目也能用吗？」  
> 「落地页是原生 HTML，能不能直接塞个自定义标签？」  
> 「能不能命令式 `createFireworks(el)`，别绑死框架？」

在 cos-design **3.x** 里，答案常常是尴尬的：组件逻辑和 `useEffect` / Hooks 缠在一起，想给 Vue 用，几乎等于再写一套。

**4.0.0** 我做了一次「大爆炸」式升级——**91 个组件、包名一个都不改**，同时交付四端：

| 入口 | 用法 |
|------|------|
| React（默认 `.`） | `import { Fireworks } from '@cos-design/fireworks'` —— 与 3.x 兼容 |
| Vue 3（`/vue`） | `import { Fireworks } from '@cos-design/fireworks/vue'` |
| Core（`/core`） | `createFireworks(el, options)` |
| Web Components（`/element`） | `import '@cos-design/fireworks/element'` → `<cos-fireworks>` |

这不是「加几个 wrapper」那么简单。整仓库从 **React 组件库**，迁成了 **Core + Adapter**；Playground 也能在同一页里切四个运行时现场验活。

全文约 **18 分钟**。建议边读边打开 [Playground → Fireworks](https://jiaxiantao.github.io/cos-design/#/fireworks)，把顶部 Tab 切到 Vue / Web Components / Core 看同一引擎。

---

## 开场：先看一眼 4.0 长什么样

首页还是那套「视觉特效工具箱」定位——91 组件、9 大类——但文档站已经把多框架当成一等公民：

![cos-design 4.0 Playground 首页](https://jiaxiantao.github.io/blogs/images/cos-design-v4/01-home.png)

组件目录一眼能扫到背景、文字、看图、抽奖、物理……：

![组件 Catalog](https://jiaxiantao.github.io/blogs/images/cos-design-v4/02-catalog.png)

进入任意组件页，你会看到这条横贯全站的 Tab：**React · Vue · Web Components · Core**。下面三张是同一套 `Fireworks` 引擎，在三个不同运行时里挂载：

![Fireworks · React Tab](https://jiaxiantao.github.io/blogs/images/cos-design-v4/03-fireworks-react.png)

![Fireworks · Vue Tab](https://jiaxiantao.github.io/blogs/images/cos-design-v4/04-fireworks-vue.png)

![Fireworks · Web Components Tab](https://jiaxiantao.github.io/blogs/images/cos-design-v4/05-fireworks-wc.png)

对业务方来说，这叫「框架自由」；对维护者来说，这叫：**如果没有 Single Source of Truth，你会维护四份烟花。**

---

## 一、为什么必须做 4.0：痛点不是「少几个 Vue 组件」

### 1.1 3.x 的真实瓶颈

到 v3.8，cos-design 已经有 91 个特效组件，覆盖活动页、品牌 Landing、数据装饰。问题不在数量，在于**耦合形态**：

```
业务想要的：烟花怎么炸、怎么暂停、怎么销毁
3.x 实际交付：一段绑死 React Hooks 的组件实现
```

结果是：

1. **Vue / 原生用户几乎无解** —— 要么 iframe 嵌 React，要么抄一份
2. **命令式场景难用** —— 抽奖「服务端开奖后 `spin(targetIndex)`」天然是 imperative
3. **Playground 只能演示 React** —— 多框架承诺无法自证
4. **样式契约脆弱** —— CSS Modules hash 类名，业务 override 一升级就碎

### 1.2 RFC 定死的六条决策

正式文档在仓库 [`docs/rfc-v4-multi-framework.md`](https://github.com/jiaxiantao/cos-design/blob/main/docs/rfc-v4-multi-framework.md)。最关键的六条：

| # | 决策 | 结论 |
|---|------|------|
| D1 | npm 包名 | **完全沿用** `@cos-design/*` / `cos-design` |
| D2 | Vue 怎么装 | **同包名 + subpath**，不另起 `@cos-design/vue-*` |
| D3 | Vue 覆盖 | **91 个全覆盖**，不做「先迁 10 个」 |
| D4 | Web Components | **与 4.0 同期发布** |
| D5 | 迁移策略 | **Big Bang 一次切完** |
| D6 | React 兼容 | 默认入口仍是 React，**现有 import 尽量零改动** |

一句话：**对外像「同一家店换了四个窗口」；对内像「厨房只保留一套灶」。**

---

## 二、核心架构：Core + Adapter

### 2.1 一张图看懂分层

![Core + Adapter 架构图](https://jiaxiantao.github.io/blogs/images/cos-design-v4/11-architecture.jpg)

```
┌─────────────────────────────────────────┐
│              Component Core              │
│  createFireworks(container, options)     │
│  · Canvas / WebGL / DOM 渲染循环         │
│  · resize / visibility / reduced-motion  │
│  · launch / spin / destroy               │
│  · 零 React / Vue 依赖                   │
└──────────┬──────────┬──────────┬─────────┘
           │          │          │
      subpath .   subpath /vue  /core · /element
      React 薄包装  Vue SFC     命令式 · Custom Element
```

设计原则就四条（RFC 原文精神）：

1. **Single Source of Truth** —— Options / Controller 类型只定义在 Core
2. **Thin Adapters** —— 框架层尽量 < 80 行，禁止写渲染逻辑
3. **Imperative First** —— `launch()` / `spin()` 是一等公民；React `ref`、Vue `defineExpose`、CE 方法都是转发
4. **Style Sharing** —— 公共 `style/index.css` + `cos-*` 类名，四端复用

### 2.2 源码目录约定

每个组件目录长这样（以 Fireworks 为例）：

```
src/components/fireworks/
  core/       engine.ts + types.ts     → createFireworks
  react/      index.tsx                → 默认入口
  vue/        Fireworks.vue
  element/    index.ts                 → <cos-fireworks>
  style/      index.css
  index.tsx   → re-export react（兼容）
```

发布侧：`packages/fireworks` 的 `exports` 挂四个 subpath；聚合包 `cos-design` 同步暴露 `.` / `/vue` / `/core` / `/elements`。

---

## 三、实现逻辑：同一引擎，三层薄包装

下面用 **Fireworks** 当「解剖标本」——逻辑足够典型，又不像 Weather / Three.js 那样淹没细节。

### 3.1 React Adapter：挂载一次，指纹更新

```tsx
// src/components/fireworks/react/index.tsx（节选）
const Fireworks = forwardRef<unknown, FireworksOptions>((props, ref) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<FireworksController | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const optionsKey = useMemo(() => optionsFingerprint(props), [props]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ctrl = createFireworks(host, propsRef.current);
    ctrlRef.current = ctrl;
    return () => {
      ctrl.destroy();
      ctrlRef.current = null;
    };
  }, []); // 只挂载一次

  useEffect(() => {
    ctrlRef.current?.update(propsRef.current);
  }, [optionsKey]); // 选项变了才 update

  return <div ref={hostRef} className="cos-fireworks-host" />;
});
```

关键点：

- **销毁只走 `destroy()`** —— rAF、监听、ResizeObserver 全由 Core 收口
- **`optionsFingerprint`** —— 忽略 function 字段做稳定 JSON key，避免每次 render 都 `update`
- React 用户几乎感觉不到架构换代

### 3.2 Vue Adapter：生命周期对称 + 事件映射

```vue
<!-- src/components/fireworks/vue/Fireworks.vue（节选） -->
<script setup lang="ts">
const props = withDefaults(defineProps<FireworksOptions>(), { auto: true });
const emit = defineEmits<{ complete: [...args: unknown[]] }>();
let ctrl: FireworksController | null = null;

onMounted(() => {
  if (hostRef.value) ctrl = createFireworks(hostRef.value, toOptions());
});
watch(() => optionsFingerprint(props), () => ctrl?.update(toOptions()));
onUnmounted(() => {
  ctrl?.destroy();
  ctrl = null;
});
defineExpose({ launch: (x?: number) => ctrl?.launch(x) });
</script>
```

约定：

- Core 的 `onComplete` → Vue `emit('complete')`
- 命令式方法走 `defineExpose`
- 业务侧：`import { Fireworks } from '@cos-design/fireworks/vue'`

### 3.3 Web Components：属性 ↔ Options，断开即销毁

```ts
// src/components/fireworks/element/index.ts（节选）
class CosFireworksElement extends HTMLElement {
  private ctrl: FireworksController | null = null;

  connectedCallback() {
    this.ctrl = createFireworks(this, parseOptions(this));
  }
  disconnectedCallback() {
    this.ctrl?.destroy();
    this.ctrl = null;
  }
  attributeChangedCallback() {
    this.ctrl?.update(parseOptions(this));
  }
  launch(x?: number) {
    return this.ctrl?.launch(x);
  }
}
customElements.define('cos-fireworks', CosFireworksElement);
```

原生页面可以写成：

```html
<script type="module">
  import '@cos-design/fireworks/element';
</script>
<cos-fireworks auto fill></cos-fireworks>
```

布尔属性、kebab-case、复杂对象（如 `prizes`）的解析，是 v4 QA 阶段批量 codegen / 加固的重点——抽奖、相册类组件尤其吃这一套。

### 3.4 Core：真正干活的那一层

Core 对外契约极简：

```
createXxx(host, options) → Controller
Controller.update(partial)
Controller.destroy()
(+ launch / spin / reveal … 领域方法)
```

所有 Canvas / WebGL / DOM 状态机都住在这里。框架层**不允许**再开第二条 rAF。这也是后面「切 Tab 不卡死」的前提。

---

## 四、共享基建：fill、指纹、可见性——比组件本身更决定体验

多框架迁完之后，最容易翻车的不是「能不能渲染」，而是 **host 尺寸、更新抖动、后台空转**。

### 4.1 `applyCanvasHostBox`：尺寸打在 Adapter Host 上

```ts
// packages/shared/src/host-layout.ts（节选）
export function applyCanvasHostBox(
  container: HTMLElement,
  root: HTMLElement,
  opts: { fill: boolean; width: number; height: number },
): void {
  if (opts.fill) {
    container.style.width = '100%';
    container.style.height = '100%';
  } else {
    container.style.width = `${opts.width}px`;
    container.style.height = `${opts.height}px`;
    container.style.marginInline = 'auto';
  }
  root.style.width = '100%';
  root.style.height = '100%';
}
```

3.x 有个隐蔽坑：有人只给内层 canvas 设宽高，外层 host 在 flex 里被挤成 0，百分比 `fill` 直接塌掉。v4 明确：**先让 host 有盒子，再让引擎根节点铺满 host。**

### 4.2 `optionsFingerprint`：更新节流

```ts
export function optionsFingerprint(value: unknown): string {
  try {
    return JSON.stringify(value, (_k, v) =>
      typeof v === 'function' ? undefined : v,
    ) ?? '';
  } catch {
    return '';
  }
}
```

回调函数每次都是新引用——若不剔除，Vue `watch` / React `useEffect` 会把 Core 打成「每帧 update」。指纹是 Adapter 层最便宜的稳定性补丁。

### 4.3 可见性暂停 & reduced-motion

背景类组件继续走 `bindVisibilityPause`：标签页隐藏停 rAF。`prefers-reduced-motion: reduce` 时降级为静态帧 / 跳过抽奖旋转动画——这是活动页可访问性的底线，和「炫」不冲突。

---

## 五、91 个组件怎么迁完：A/B/C/D 四批次

Big Bang 不是「周末手写 91 × 4」。工程上拆成四批，复杂度递增：

![Batch A/B/C/D 迁移阶梯](https://jiaxiantao.github.io/blogs/images/cos-design-v4/12-migration-batches.jpg)

| Batch | 类型 | 约数量 | 代表 | 策略 |
|-------|------|--------|------|------|
| A | 纯 CSS / DOM 文字与按钮 | ~25 | NeonText、Typewriter、WaveButton | 脚本工厂为主 |
| B | Canvas 2D | ~34 | Confetti、MatrixRain、FlipCard | 脚本 + 引擎模板 |
| C | WebGL / Three / 复杂场 | ~15 | LavaBubble、RippleWater、WeatherBackground | **手写 Core** |
| D | 抽奖 / 相册 / 物理状态机 | ~16 | Turntable、ScratchCard、NineGrid、Photo* | 手写 + 事件映射 |

配套命令：

```bash
pnpm migrate:batch-a   # …b/c/d
pnpm verify:v4-matrix  # 91 × 4 源码/产物入口门禁
pnpm verify:v4-runtime # 运行时审计
pnpm test:smoke        # Playwright 挂载与交互冒烟
```

**DoD（每个组件）**：core + react + vue + element + Playground 四 Tab 可预览 + smoke。达不到就不算迁完。

这是我认为最值得抄的工程方法：**把「架构理想」翻译成可执行的批次与门禁**，否则多框架项目会死在「还差 17 个组件」的半成品地狱。

---

## 六、Playground：多运行时实验室，而不只是文档站

文档站本身也是 v4 的一部分产品能力。

### 6.1 FrameworkPreview：异步挂载的竞态清理

切 Tab / 切路由时，最容易泄漏的是：**上一个 Vue app 还在 `import()`，下一个已经挂上了**。

```ts
// src/pages/playground/framework-preview.tsx（节选）
let alive = true;
let dispose: (() => void) | null = null;

const setDispose = (fn: () => void) => {
  if (!alive) {
    fn(); // effect 已取消：立刻拆掉刚挂上的实例
    return;
  }
  dispose = fn;
};

// Vue
vueApp.mount(mountEl);
setDispose(() => vueApp.unmount());

// Element：显式 destroy + remove，确保走 disconnectedCallback
setDispose(() => {
  el.destroy?.();
  el.remove();
});

// Core
setDispose(() => ctrl.destroy?.());

return () => {
  alive = false;
  dispose?.();
};
```

另外用 `previewKey = path:framework:name` 强迫 React 在路由变化时重建预览树，避免「旧组件的 Canvas 还在跑」。

这直接回应了一个真实体验问题：**连续切换左侧菜单和框架 Tab，性能越来越卡**——根因几乎总是「旧实例没死干净」。

### 6.2 FillStage：打死「高度反馈环」

天气、极光、水面这类背景喜欢 `fill: 100%`。若预览容器高度又由子元素撑开，就会出现：

```
child 变高 → ResizeObserver → 再注入更大 height → child 再变高 → …
```

FillStage 的解法很「笨」，但有效：

```tsx
export const FILL_STAGE_HEIGHT = 480;

// 只观察父级宽度；高度恒定；向子组件注入像素宽高，并强制 fill=false
React.cloneElement(child, {
  width: size.width,
  height: size.height,
  fill: false,
});
```

![WeatherBackground · FillStage 固定舞台](https://jiaxiantao.github.io/blogs/images/cos-design-v4/06-weather.png)

### 6.3 Vue 点击被遮罩偷走：RippleWater 血泪

背景 Demo 常叠一层文案 / Hero。装饰层默认 `pointer-events: auto` 时，**涟漪永远点不到水面**。修法：装饰层 `pointer-events: none`，真正可点的开关再开回 `auto`。

![RippleWater 可点击水面](https://jiaxiantao.github.io/blogs/images/cos-design-v4/07-ripple-water.jpg)

这些「看起来像样式问题」的坑，本质都是：**多框架预览把原来 React 树里隐含的约束暴露了出来。**

---

## 七、Breaking Changes：谁要改代码？

完整清单见 [`docs/migration-v4.md`](https://github.com/jiaxiantao/cos-design/blob/main/docs/migration-v4.md)。摘要：

| 使用者 | 是否要改 |
|--------|----------|
| React：`import { Fireworks } from 'cos-design'` | **通常不用** |
| 从 `@cos-design/shared` 引 React hooks | 改到 `@cos-design/shared/react` |
| CSS 覆盖打在 hash 模块类名上 | 改成公开 `cos-*` / CSS 变量 |
| Vue / 原生 / CE | 用新 subpath（本来就是新能力） |

```tsx
// React — 与 3.x 相同
import { Fireworks } from '@cos-design/fireworks';

// Vue
import { Fireworks } from '@cos-design/fireworks/vue';

// Core
import { createFireworks } from '@cos-design/fireworks/core';
const ctrl = createFireworks(el, { auto: true });
ctrl.launch();
ctrl.destroy();

// Web Components
import '@cos-design/fireworks/element';
// <cos-fireworks auto></cos-fireworks>
```

示例工程也对齐到 4.0.0：

- [examples/next-app](https://github.com/jiaxiantao/cos-design/tree/main/examples/next-app)
- [examples/vue-app](https://github.com/jiaxiantao/cos-design/tree/main/examples/vue-app)
- [examples/vanilla](https://github.com/jiaxiantao/cos-design/tree/main/examples/vanilla)

Quickstart 页同步了多框架片段：

![Quickstart 多框架入门](https://jiaxiantao.github.io/blogs/images/cos-design-v4/10-quickstart.png)

---

## 八、不止架构：抽奖、墨染、转盘仍是「能摸」的产品

架构升级容易写成「纯工程自嗨」。我想强调：4.0 **没有改掉产品气质**——它仍然是给活动页/品牌页用的特效层。

墨染清水、水面涟漪、转盘抽奖，在 Vue Tab 下照样能摸：

![InkBloom 墨染](https://jiaxiantao.github.io/blogs/images/cos-design-v4/08-ink-bloom.jpg)

![Turntable 转盘](https://jiaxiantao.github.io/blogs/images/cos-design-v4/09-turntable.png)

对活动页团队，真正的组合拳仍是：

```
fill 背景氛围
 + 霓虹/打字标题
 + FlipCard / NineGrid / Turntable / ScratchCard
 + Confetti / Fireworks 收束
```

只是现在同一套配方，可以在 Next、Nuxt、甚至静态 HTML 上落地。

---

## 九、如果让我复盘，这五条最值得带走

1. **包名不变 + subpath 扩展** —— 比「再建一套 vue 包」迁移成本低一个数量级  
2. **Imperative Core 先行** —— 框架只是 host；命令式 API 天然适配抽奖/动画控制  
3. **指纹更新 + destroy 收口** —— 多框架性能的生死线  
4. **批次 + 矩阵门禁** —— Big Bang 可执行，靠的是 `verify:v4-matrix` 不是热情  
5. **Playground 当运行时实验室** —— 文档站能切四端，才算把架构「证伪/证真」过

也有代价：

- Custom Element 的属性类型系统永远比 TS Props 糙，需要约定与 codegen  
- 可监控的「框架层调试体验」变弱了——问题更多要下到 Core  
- Big Bang 短期 PR 巨大，需要强 RFC 与分批脚本，否则 review 会崩

---

## 十、写在最后

cos-design 4.0 对我来说，不是「支持 Vue」打个勾，而是把特效库从：

> 「一个 React 组件集合」

推进到：

> 「一套与框架解耦的视觉引擎 + 四套薄宿主」

如果你是 React 老用户：升级到 4.0.0，多数项目可以当 minor 用。  
如果你是 Vue / 原生：现在终于不用再问「有没有 Vue 版烟花」。  
如果你在做组件库：不妨把 RFC 里的 D1–D6 和 A/B/C/D 批次，当成一次可复用的多框架改造剧本。

**试玩**：https://jiaxiantao.github.io/cos-design/  
**迁移**：https://github.com/jiaxiantao/cos-design/blob/main/docs/migration-v4.md  
**RFC**：https://github.com/jiaxiantao/cos-design/blob/main/docs/rfc-v4-multi-framework.md  
**npm**：`pnpm add cos-design`（或按需 `@cos-design/<component>`）

欢迎在 Issue / Discussion 拍砖——尤其是你们在 Vue / CE 接入里踩到的属性映射和销毁时序问题。这类反馈，会直接变成下一轮 `verify:v4-runtime` 的用例。

---

## 参考

- Changelog `[4.0.0]`：https://github.com/jiaxiantao/cos-design/blob/main/CHANGELOG.md  
- 站内前作：[v3.8 五个背景动效](https://jiaxiantao.github.io/blogs/post/92365ecd76b94b37) · [从 Demo 到可发布组件库](https://jiaxiantao.github.io/blogs/post/6a317416652c4876) · [13 种看图方式](https://jiaxiantao.github.io/blogs/post/10124a35b4374458)
