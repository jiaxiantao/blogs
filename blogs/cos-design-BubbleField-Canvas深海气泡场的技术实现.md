# cos-design BubbleField：用 Canvas 做一个「会呼吸」的深海气泡场

> 发布日期：2026-07-28\
> 标签：前端 / React / Canvas / 组件库 / cos-design / 视觉特效 / 物理仿真

活动页、品牌 Landing、游戏氛围页，常常需要一层「水下感」：气泡从海底升起、靠近时融成一团、鼠标划过时被水流带偏。很多项目会临时找一段粒子 Demo——圆点往上飘，看起来像汽水，不像深海。

**BubbleField** 是我在 [cos-design](https://github.com/jiaxiantao/cos-design) **v3.6.0** 新增的背景动效组件：纯 Canvas 2D，无 Three.js / WebGL。对外几个 props，对内拆成物理、融合、渲染、背景四层模块——浮力上升、表面振荡、体积守恒融合、指针尾流扰动。本文讲清技术实现，并方便你直接装包试用。

**Playground**：<https://jiaxiantao.xyz/cos-design/#/bubbleField>\
**仓库**：[github.com/jiaxiantao/cos-design](https://github.com/jiaxiantao/cos-design)\
**独立包**：`@cos-design/bubble-field@3.6.0`\
**全量包**：`cos-design@3.6.0`

***

## 效果预览

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/655b28e621bc485fa7296df2ba8457d5~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785809844&x-orig-sign=s1FVhW8XP1zQSqLRyCapxYLoSc0%3D)

***

## 一、它解决什么问题？

常见「气泡背景」有三条路：

| 方案              | 优点   | 痛点           |
| --------------- | ---- | ------------ |
| CSS 圆点 / 简单粒子   | 轻量   | 没有变形、融合、水流感  |
| 现成粒子 Demo       | 上手快  | 一份效果一份代码，难调参 |
| Three.js / 流体仿真 | 表现力强 | 依赖重，活动页往往过重  |

BubbleField 选的是中间态：**Canvas 2D + 轻量物理配方**。对外是一个组件：

```tsx
import { BubbleField } from '@cos-design/bubble-field';

<BubbleField width={800} height={500} bubbleCount={36} speed={1} />
```

对内不是「一堆 `arc` 往上挪」，而是：

> 海底生成 → 浮力上升 → 表面模态变形 → 相近体积守恒融合 → 鼠标划过制造尾流。

***

## 二、整体架构：四个模块各管一层

源码按职责拆开，适合阅读，也适合扩展：

    bubbleField/
    ├── index.tsx      # React 外壳、rAF、指针、生成调度
    ├── physics.ts     # 浮力、环境流、指针尾流、表面模态
    ├── merge.ts       # 空间哈希、短距吸引、体积守恒融合
    ├── render.ts      # 可变形轮廓 Path2D、metaball 轮廓、光照
    ├── background.ts  # 静态背景缓存、God rays、海洋雪
    ├── utils.ts       # frameDamp、easing、终端上升速度
    └── types.ts       # Bubble / Merge / Pointer 类型

主循环顺序可以概括成：

    画动态背景 → 按节奏从海底 spawn
      → 指针尾流扰动（可选）
      → 积分运动 + 表面模态
      → 短距吸引 / 启动融合 / 更新融合姿态
      → 按 y 深度排序绘制（单体 blob / 融合 metaball）

这和游戏里的「物理 tick → 碰撞/合并 → 渲染」同一套心智。

***

## 三、Props：少而够用

```ts
export interface BubbleFieldProps {
  width?: number;        // 默认 800
  height?: number;       // 默认 500
  bubbleCount?: number;  // 气泡数量上限，默认 36
  speed?: number;        // 上浮速度倍率，默认 1
  color?: string;        // 水体主色 / tint，默认 '#7dd3fc'
  interactive?: boolean; // 鼠标划过扰动，默认 true
}
```

交互开启时底部提示是「海底气泡上升 · 划过扰动水流」；关掉则只保留氛围层。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/f70094ff1b2b47359395317f8917c802~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785809844&x-orig-sign=gOzUUOh1fhZ8SZ%2F9y3g2gjqWaYk%3D)

***

## 四、关键算法①：浮力上升，而不是匀速上飘

每颗气泡有 `terminalRise`（与半径相关的终端上升速度）。积分时用弹簧式加速度追这个目标，靠近水面再给一点 `depthBoost`，并叠加轻微 wobble / sway 与环境流场：

```ts
const depthBoost = 1 + (1 - depth) * 0.12;
const targetUp = bubble.terminalRise * speedScale * depthBoost;
const accel = (targetUp - upSpeed) * (0.022 + bubble.radius * 0.0011);
bubble.vy -= accel * frameScale;
// + 正弦晃动 + ambientFlow + frameDamp 阻尼
```

观感上：小泡升得慢且稳，大泡更「鼓」；不是所有圆点同一速度排队上浮。

从海底 `spawn` 时，半径也有偏置——多数中小，偶尔偏大——场里才有主次。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/0ab17842f8344c4e9a39e6c919719c4a~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785809844&x-orig-sign=CVDqWy2ZAInE8hkf8tvHVre3Gmc%3D)

***

## 五、关键算法②：傅里叶表面模态 = 假软体

气泡没有网格、没有逐顶点弹簧。形变靠两阶表面模态（谐波振荡器）：

\[
\ddot{m} = -\omega^2 m - d\dot{m}
]

*   **mode2**：椭圆振荡，(\omega\_2 \propto 1/\sqrt{r})（大气泡更「肉」）
*   **mode3**：三倍角非对称抖动
*   **streamStretch**：沿相对流速拉伸轮廓

画轮廓时，对 48 个角度采样半径：

```ts
const blobRadius = (bubble, angle, time) => {
  let local = breathe + ripple + pulseBoost + settle;
  // 沿流拉伸：面向流向变长，侧向略收
  local += facing * facing * s - (1 - facing * facing) * s * 0.55;
  local += mode2 * Math.cos(2 * (angle - mode2Angle)) * 0.28;
  local += mode3 * Math.cos(3 * (angle - mode3Phase)) * 0.16;
  return bubble.radius * (1 + local);
};
```

再旋转 / 压扁成 `Path2D`，叠径向渐变高光（光源约在右上）。这是 BubbleField「像果冻、像水下气泡」而不是「硬圆」的关键。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/6a89799a912540dd87bf63bdfc9657e1~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785809844&x-orig-sign=6bjcA80JgwEv2GMLE4lPdMiBLto%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/393f4cdeb64c403282a202994d32afbf~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785809844&x-orig-sign=DE1RpsOAl696XR9mQXe9Bb95zDk%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/4103273b8fb14d83a6e2da293fc4623b~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785809844&x-orig-sign=DZfDmw8CzRxaodk9FZhTu2ju7%2Bk%3D)

***

## 六、关键算法③：指针 = 局部尾流，不是简单排斥

`samplePointerFlow` 在光标附近用高斯衰减叠三种力：

| 分量           | 作用                 |
| ------------ | ------------------ |
| **drag**     | 沿指针切向拖拽            |
| **vortex**   | 侧向旋流（`tanh(side)`） |
| **pressure** | 径向压力               |

并按指针速度放大影响半径。同时把 `strain` / `excite` 灌进表面模态，让「水流扫过」和「外形晃一下」连在一起。

这比 `bubble.x += dx * 0.1` 那种推开，更像水下尾流。

***

## 七、关键算法④：体积守恒融合 + Metaball 轮廓

相近气泡会自动融合，流程分三段：

1.  **空间哈希**（cell ≈ `MAX_RADIUS * 2.6`）做近邻，避免 O(n²)；
2.  **短距吸引**：刚要碰上时轻轻拉近；
3.  **启动融合**：目标半径按体积守恒：

```ts
const targetRadius = Math.min(
  MAX_RADIUS,
  Math.cbrt(primary.radius ** 3 + secondary.radius ** 3)
);
```

融合姿态分 **approach（靠近）** 与 **absorb（吸收）** 两段缓动：主泡变大、副泡缩小，同时用 metaball 场画「两球粘连」的公共轮廓：

```ts
// 经典 r²/d² 场
metaballField = (ar*ar)/d1 + (br*br)/d2;
// 每个角度沿射线二分搜索场值 ≈ 1 的等值面点
```

Canvas 2D 上做双体 metaball，比 WebGL 等值面轻一个数量级，观感足够「融成一团」。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/024a7abe858b48ec9f8793ce51c81ed2~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785809844&x-orig-sign=XQw%2BTVm2sAcxKZq0PuLzz0a74s8%3D)

***

## 八、背景与观感：深海不用 3D

背景也分层，控制成本：

| 层           | 做法                             |
| ----------- | ------------------------------ |
| 静态深度渐变 / 暗角 | 离屏 canvas 缓存，仅尺寸或 `color` 变时重画 |
| God rays    | 动态、`screen` 叠色，模拟从水面透下的光柱      |
| 海洋雪         | 单张柔边精灵 `drawImage`，数量按画布面积封顶   |

气泡按 `y` 从深到浅排序绘制，远近叠压更自然。整体气质是「深海气泡场」，不是 UI 上的蓝色圆点雨。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/2bf61ea6916045e8b21571f01f6f4fc2~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785809844&x-orig-sign=mjtfDbLhPlxZEMmfrb5pJ8AEk0o%3D)

***

## 九、性能与工程约束

| 手段                         | 作用                 |
| -------------------------- | ------------------ |
| 默认 \~36 气泡                 | 路径采样与光照成本可预期       |
| 空间哈希融合                     | 近邻查询近似 O(n)        |
| 静态背景缓存                     | 避免每帧重绘大面积渐变        |
| DPR ≤ 2                    | 高分屏不过度放大 fill-rate |
| `bindVisibilityPause`      | 切标签页停仿真            |
| `deltaMs` 钳制 + `frameDamp` | 帧率无关阻尼，掉帧不「飞」      |
| `prefers-reduced-motion`   | 降速、弱化指针与光柱         |

使用建议与 cos-design 其它 Canvas 背景一致：**一页一个强全屏动效**；`bubbleCount` 过大或画布很大时先在真机上看帧率。

***

## 十、怎么用：安装与场景示例

### 10.1 安装

```bash
# 只要气泡场
pnpm add @cos-design/bubble-field

# 或整库
pnpm add cos-design
```

样式随包自动注入，无需再 `import` CSS。

### 10.2 典型用法

```tsx
import { BubbleField } from '@cos-design/bubble-field';
// 或：import { BubbleField } from 'cos-design';

<BubbleField
  width={960}
  height={540}
  bubbleCount={40}
  speed={1.2}
  color="#7dd3fc"
  interactive
/>
```

### 10.3 Next.js

依赖浏览器 API，SSR 请关掉：

```tsx
import dynamic from 'next/dynamic';

const BubbleField = dynamic(
  () => import('@cos-design/bubble-field').then((m) => m.BubbleField),
  { ssr: false }
);
```

### 10.4 适合放哪里？

*   海洋 / 潜水 / 清凉主题活动页 Hero
*   品牌 Landing 的氛围底层
*   游戏、互动展的水下场景装饰
*   需要「可划过扰动」的趣味背景

不适合：首屏字节极度敏感、完全不需要动效的纯文档站或重度表单后台。

***

## 十一、和 RippleWater / SmokeFog 怎么选？

同属 cos-design **背景动效**，气质不同：

| 组件                                                             | 介质    | 交互隐喻          | 渲染                   |
| -------------------------------------------------------------- | ----- | ------------- | -------------------- |
| [RippleWater](https://jiaxiantao.xyz/cos-design/#/rippleWater) | 水面    | 点击产生涟漪        | WebGL 高度场            |
| [SmokeFog](https://jiaxiantao.xyz/cos-design/#/smokeFog)       | 雾 / 烟 | 点击拨散          | Canvas 精灵            |
| **BubbleField**                                                | 水下气泡  | 划过扰动水流 + 自动融合 | Canvas 物理 + metaball |

要「点水面」用 RippleWater；要「拨雾」用 SmokeFog；要「深海气泡升起来、还能融」用 BubbleField。

***

## 结语

BubbleField 想证明的不是「Canvas 能画圆」，而是：

1.  **浮力 + 帧率无关阻尼**：上升有物理感，不是匀速粒子；
2.  **表面模态假软体**：不用网格也能做出果冻形变；
3.  **体积守恒融合 + metaball**：融合像一团水，而不是两圆叠透明度；
4.  **指针尾流**：拖拽 + 旋流 + 压力，划过才有「水流」；
5.  **模块化与工程细节**：可分包发布，可见性暂停与 reduced-motion 开箱即有。

如果你正在做海洋主题或氛围型 Landing，打开 Playground 划两下比看文档更快：

<https://jiaxiantao.xyz/cos-design/#/bubbleField>

```bash
pnpm add @cos-design/bubble-field
```

欢迎 Issue / PR，一起把背景动效做得更完整。

***

## 系列延伸阅读

*   [cos-design RippleWater & SmokeFog：水面涟漪与烟雾雾气怎么做](https://jiaxiantao.github.io/blogs/post/cos-design-RippleWater与SmokeFog-水面涟漪与烟雾雾气的技术实现)
*   [cos-design WeatherBackground：用 Canvas 做一个「会变天」的背景引擎](https://jiaxiantao.github.io/blogs/post/cos-design-WeatherBackground-Canvas天气引擎与Open-Meteo实况)
*   [cos-design v3.0：从 15 个 Demo 到 49 个组件的视觉特效库](https://jiaxiantao.github.io/blogs/post/cos-design-v3.0-从15个Demo到49个组件的视觉特效库)

***

## 参考

| 资源         | 链接                                                       |
| ---------- | -------------------------------------------------------- |
| Playground | <https://jiaxiantao.xyz/cos-design/#/bubbleField>        |
| GitHub     | <https://github.com/jiaxiantao/cos-design>               |
| npm 全量包    | <https://www.npmjs.com/package/cos-design>               |
| npm 子包     | <https://www.npmjs.com/package/@cos-design/bubble-field> |
| Metaball 场 | 经典 (r\^2/d\^2) 等值面思路                                     |
| 表面模态       | 气泡 / 液滴形变常用的低阶傅里叶模态                                      |

***
