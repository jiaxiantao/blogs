# cos-design RippleWater & SmokeFog：水面涟漪与烟雾雾气怎么做

> 发布日期：2026-07-24\
> 标签：前端 / React / WebGL / Canvas / 组件库 / cos-design / 视觉特效

活动页、品牌 Landing、登录页，常常需要一层「有空间感」的背景：水面能点出涟漪，雾气能被手拨开。很多项目会临时找一段 Three.js Demo 或 CSS 动画改一改——能用，但依赖重、参数难调，更谈不上做成可复用组件。

本文拆解 [cos-design](https://github.com/jiaxiantao/cos-design) 里两个互补的**背景动效**组件：

| 组件            | 中文   | 渲染路线                 | 一句话              |
| ------------- | ---- | -------------------- | ---------------- |
| `RippleWater` | 水波纹  | **WebGL + CPU 高度场**  | 真实感水面，点击产生物理扩散涟漪 |
| `SmokeFog`    | 烟雾雾气 | **Canvas 2D + 噪声精灵** | 底部升起的雾气，点击向外拨散   |

两者同属「背景氛围」：默认 `800×500`、支持交互、无 Three.js 依赖，并共享 `bindVisibilityPause`、`prefers-reduced-motion` 等工程细节。下面讲清实现，也方便你直接装包试用。

**Playground**

*   水波纹：<https://jiaxiantao.xyz/cos-design/#/rippleWater>
*   烟雾雾气：<https://jiaxiantao.xyz/cos-design/#/smokeFog>

**仓库**：[github.com/jiaxiantao/cos-design](https://github.com/jiaxiantao/cos-design)\
**独立包**：`@cos-design/ripple-water@3.5.4` / `@cos-design/smoke-fog@3.5.4`\
**全量包**：`cos-design@3.5.4`

***

## 效果预览

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/d8aa1893a5c7463c8d535b9a5a301795~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785482700&x-orig-sign=1Zd2qQfseBOFmAHUx8gqXTFUgTE%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/fca5ee9a24654a2c941569489e0c3fa5~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785482700&x-orig-sign=eoyEVmru9aHvMNwRkOkVY%2Fz9TK8%3D)

***

## 一、为什么这两个组件放在一起讲？

它们回答的是同一类产品问题：

> **页面底层要有「可交互的气氛」，但不要拖进一整套 3D 引擎。**

差异在「材质」：

| 维度   | RippleWater             | SmokeFog             |
| ---- | ----------------------- | -------------------- |
| 介质   | 液体表面                    | 体积雾 / 烟柱             |
| 物理   | 2D 波动方程高度场              | 粒子漂浮 + 阵风场           |
| GPU  | 片段着色（法线 / Fresnel / 高光） | 无；离屏精灵 + `screen` 叠色 |
| 交互隐喻 | 点一下 → 涟漪扩散              | 点一下 → 雾被拨开           |
| 典型场景 | 科技 / 海洋 / 清凉主题 Hero     | 悬疑 / 夜景 / 氛围登录页      |

一起看，正好对照 **「CPU 仿真 + GPU 着色」** 与 **「离线烘焙 + 轻量粒子」** 两条路线——活动页里都很常用。

***

## 二、RippleWater：高度场水面 + WebGL 着色

### 2.1 架构一句话

    点击 → 在 192×192 高度场写入「中心凹陷 + 环形」
         → 每帧用邻居平均推进波动方程（×2 pass）
         → 高度上传为纹理 u_height
         → 片段着色器：法线 → Lambert / Fresnel / 高光闪烁 → 成图

React 只负责 canvas 生命周期与 props；真正「像水」的部分在 **CPU 仿真 + 自写 GLSL**，没有 Three.js / regl。

### 2.2 Props 一览

```ts
export interface RippleWaterProps {
  width?: number;              // 默认 800
  height?: number;             // 默认 500
  fromColor?: string;          // 水面渐变浅端，默认 '#52ade3'
  toColor?: string;            // 水面渐变深端，默认 '#013565'
  color?: string;              // 涟漪高光色，默认 '#a8d8f5'
  waveAmplitude?: number;      // 环境波浪强度 0~2，默认 1
  waveSpeed?: number;          // 环境波浪速度 0~3，默认 1
  shimmer?: number;            // 波光闪烁 0~2，默认 1
  reflection?: number;         // 反射强度 0~1，默认 0.38
  rippleStrength?: number;     // 点击涟漪力度 0~3，默认 1
  rippleRadius?: number;       // 落点半径（仿真格点）2~12，默认 6
  damping?: number;            // 衰减 0.9~0.999，默认 0.985
  spread?: number;             // 传播速度 0.3~0.7，默认 0.5
  interactive?: boolean;       // 是否响应点击，默认 true
  showHint?: boolean;          // 底部提示，默认 true
  hint?: string;               // 默认「点击水面产生涟漪」
}
```

### 2.3 关键算法①：高度场波动

经典二维波动的离散形式：下一点高度 ≈（四邻域加权 − 上一点）× 阻尼。

```ts
// 伪代码：每帧两遍，边界不更新
next[i] = (neighbors * spread - prev[i]) * damping;
// neighbors = 左 + 右 + 上 + 下
```

要点：

*   网格固定 **SIM = 192**，仿真成本与画布 CSS 尺寸解耦；
*   高度钳制在 `±1.5`，防止数值爆炸；
*   `damping` 越接近 1，涟漪越「悠」；`spread` 控制扩散快慢。

点击扰动不是简单挖一个洞，而是 **中心软凹陷 + 外环抬升**，更像水花溅开：

```ts
const center = Math.exp(-dist * dist * 0.55) * -0.35;
const ring = Math.exp(-Math.pow(dist - r * 0.55, 2) * 0.9);
curr[y * SIM + x] += strength * (center + ring * 1.1);
```

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/584595ae092f45299ec0f2d63f755f4c~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785482700&x-orig-sign=w1gSpTpgCckwYqhjIYrg7ZxaaU4%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/8873303d706d47df856ed73199d0cd45~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785482700&x-orig-sign=uyhuM5iFwgeZw5whsd0japFWt68%3D)

### 2.4 关键算法②：片段着色里的「像水」

高度纹理每帧上传后，着色器做三件事：

1.  **合成高度**：交互涟漪 + 多频正弦环境波（闲置时水面仍在呼吸）；
2.  **有限差分法线**：用左右上下高度估法线；
3.  **光照**：Lambert 漫反射 + Fresnel 反射天空 + Blinn-Phong 高光，再用阈值筛出「闪金」点。

环境波用多 octave 正弦叠出远近不同的涟漪感：

```glsl
float ambientH(vec2 p, float t) {
  float h = 0.0;
  h += sin(p.x * 3.2 + t * 1.3) * cos(p.y * 2.4 - t * 0.9) * 0.45;
  h += sin(p.x * 6.8 - t * 1.7 + p.y * 1.1) * 0.22;
  h += sin(p.x * 12.0 + p.y * 9.0 + t * 2.4) * 0.08;
  h += sin(p.x * 1.4 + p.y * 1.8 + t * 0.55) * 0.35;
  return h;
}
```

高光侧用 `step(0.992, glitter)` 做硬阈值，只在法线几乎对准观察方向时爆亮——这是「波光粼粼」比单纯 `pow(spec, N)` 更脆的原因。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/cc22bf49730a46a696d525bb4b0049d5~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785482700&x-orig-sign=aZzC%2BsY8OAbXTn%2BdU9izkHg%2BB7c%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/eb5ceafa39b242e0a7ce7e0521a34dd6~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785482700&x-orig-sign=5rHs%2FVtLBs1aIMLGS8u%2BSKGiRFQ%3D)

### 2.5 性能与可访问性

| 手段                       | 作用                               |
| ------------------------ | -------------------------------- |
| 固定 192² 仿真               | CPU 开销可预期（约 7 万邻域更新 / 帧 ×2 pass） |
| DPR ≤ 2                  | 高分屏不过度放大 fill-rate               |
| `bindVisibilityPause`    | 切标签页停仿真                          |
| `prefers-reduced-motion` | 只画一帧静态水面                         |
| `pointerdown` 统一交互       | 避免 touch + click 双触发             |

***

## 三、SmokeFog：FBM 精灵 + 阵风拨散

### 3.1 架构一句话

    启动时烘焙 10 张 128×128 噪声烟贴
      → 烟团只从底部生成，缓升 + 游荡 + 生命周期淡入淡出
      → 点击生成 Gust（扩张半径 + 径向/旋流推力）
      → screen 混合叠画 → 体积感雾气

整条链路是 **Canvas 2D**，没有着色器；「贵」的噪声只在贴图烘焙时算一次。

### 3.2 Props 一览

```ts
export interface SmokeFogProps {
  width?: number;                                    // 默认 800
  height?: number;                                   // 默认 500
  density?: number;                                  // 0~1，默认 0.5 → 约 56~156 个烟团
  color?: string;                                    // 烟雾色，默认 '#d2d4d8'
  backgroundColor?: string | [string, string, string]; // 单色或 [上,中,下]
  speed?: number;                                    // 运动倍率 0~3，默认 1
  disperseStrength?: number;                         // 拨开力度 0~3，默认 1
  disperseRadius?: number;                           // 拨开范围倍率 0~3，默认 1
  interactive?: boolean;                             // 默认 true
}
```

### 3.3 关键算法①：离线 FBM 撕边烟贴

每张精灵用值噪声 + 4 octave FBM，把圆形半径 **warp** 成丝缕 / 破洞边缘，再乘径向衰减：

```ts
const n = fbm(...) * 0.7 + fbm(...) * 0.3;
const warped = r + (n - 0.45) * 0.55;
let density = Math.pow(Math.max(0, 1 - Math.max(0, warped)), 1.35);
density *= 0.55 + n * 0.7;
```

运行时只 `drawImage` + 旋转 / 拉伸，帧成本与「实时噪声流体」完全不在一个量级。`color` 变更时会重建贴图池，不必重启动画循环。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/2c04773585374a6985005c55dd4600da~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785482700&x-orig-sign=LSw%2F1gBbn2X5uSZyBivVTVeKc2s%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/dd85609bb7c14ddbb42fcbd42ec88641~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785482700&x-orig-sign=qfxUbszwNl7DR3pJ5y2m6Dn05LI%3D)

### 3.4 关键算法②：只从底部升起

烟团 `spawnPuff` 强制从画面底部出生，向上缓升；开场用 `progress = random^1.75` 预分布，让底部更浓、顶部更稀——像烟囱 / 晨雾，而不是满屏随机撒点。

绘制时：

*   `lifeAlpha`：生命周期淡入淡出；
*   `heightDensity`：越高越淡；
*   `globalCompositeOperation = 'screen'`：交叠处像体积光，而不是糊成一团灰。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/c4f1e1d51b0e48af85455171c85059f9~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785482700&x-orig-sign=7WduAPuLZXz1Oz3S26gh63oKnpo%3D)

### 3.5 关键算法③：Gust 拨散（不是瞬间消失）

点击不是把粒子 `opacity = 0`，而是生成一个向外扩张的 **阵风场**：

*   `sin(π · spent)` 包络：中间最强，首尾柔和；
*   `softCore + waveFront`：中心软推、外缘波前稍强，避免爆炸感；
*   径向推力 + 轻微旋流 + 上抬；
*   同时变薄、略胀开，再用阻尼慢慢回到缓升。

```ts
const softCore = Math.exp(-t * t * 2.2) * (1 - t * 0.35);
const waveFront = Math.exp(-Math.pow((t - 0.72) / 0.32, 2));
const falloff = softCore * 0.55 + waveFront * 0.45;
// 径向为主，少量旋流
puff.vx += (nx * 0.55 + tx * 0.22 + noise * 0.12) * response * inertia;
puff.vy += (ny * 0.48 + ty * 0.22 - 0.06) * response * inertia;
puff.opacity *= 1 - response * 0.028;
```

同时最多约 4 个 Gust，防止连点把场景「吹穿」。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/7b2bff1aa06f4dba8c5acbb42d36b29e~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785482700&x-orig-sign=TgfqcKOjqIH5aDVh22YVAfQ6q6Q%3D)

### 3.6 性能要点

| 手段                     | 作用               |
| ---------------------- | ---------------- |
| 10 × 128 精灵池           | 噪声只烘焙一次          |
| density → 56\~156 puff | 密度可预期            |
| DPR ≤ 2 + 可见性暂停        | 与 RippleWater 一致 |
| reduced-motion         | 静态一帧             |

***

## 四、两条路线怎么选？

| 你的需求                      | 更合适                                   |
| ------------------------- | ------------------------------------- |
| 要「点一下有物理涟漪」、科技 / 海洋气质     | **RippleWater**                       |
| 要「雾气被拨开」、悬疑夜景 / 氛围登录      | **SmokeFog**                          |
| 目标机 WebGL 不稳定 / 只要 Canvas | SmokeFog                              |
| 需要更强反射与波光参数               | RippleWater（`shimmer` / `reflection`） |
| 需要改烟雾色 / 三色背景渐变           | SmokeFog（`color` / `backgroundColor`） |

也可以同页组合：上层 SmokeFog 半透明叠在内容上做氛围，Hero 区再放 RippleWater——但记住 cos-design 一贯建议：**一页一个强全屏动效背景**，第二个请降尺寸或关掉交互。

***

## 五、工程上的共同约定

两个组件都遵循同一套「组件库该有的事」：

1.  **`configRef` 热更新**：调 props 不必拆掉 rAF 循环；
2.  **`pointerdown` + 仅左键**：移动端与桌面行为一致；
3.  **`@cos-design/shared`**：`clamp`、`bindVisibilityPause`；
4.  **无障碍**：`prefers-reduced-motion` 走静态帧；
5.  **分包发布**：可只装 `@cos-design/ripple-water` / `@cos-design/smoke-fog`，样式自动注入。

这和 WeatherBackground、Aurora 等背景组件同一套心智——装一个用一个，而不是拷一段 Demo。

***

## 六、怎么用：安装与场景示例

### 6.1 安装

```bash
# 只要其中一个
pnpm add @cos-design/ripple-water
pnpm add @cos-design/smoke-fog

# 或整库
pnpm add cos-design
```

### 6.2 最小示例

```tsx
import RippleWater from '@cos-design/ripple-water';
import SmokeFog from '@cos-design/smoke-fog';
// 或：import { RippleWater, SmokeFog } from 'cos-design';

<RippleWater
  width={960}
  height={540}
  fromColor="#52ade3"
  toColor="#013565"
  shimmer={1.2}
  rippleStrength={1.2}
/>

<SmokeFog
  width={960}
  height={540}
  density={0.55}
  speed={1}
  color="#d2d4d8"
  backgroundColor={['#14151c', '#1a1b24', '#0e0f14']}
  disperseStrength={1.2}
/>
```

### 6.3 Next.js

两者都依赖浏览器 API，SSR 请关掉：

```tsx
import dynamic from 'next/dynamic';

const RippleWater = dynamic(() => import('@cos-design/ripple-water'), { ssr: false });
const SmokeFog = dynamic(() => import('@cos-design/smoke-fog'), { ssr: false });
```

### 6.4 适合放哪里？

*   **RippleWater**：科技发布会 Hero、海洋 / 清凉主题活动页、需要「可点」的趣味背景；
*   **SmokeFog**：夜景登录页、悬疑 / 游戏氛围页、需要一层可拨开的雾罩。

不适合：首屏字节极度敏感、且完全不需要动效的纯文档站或重度表单后台。

***

## 结语

RippleWater 与 SmokeFog 想证明的是同一件事：

> **氛围背景可以做成「有物理手感」的组件，而不必引入 Three.js。**

*   **RippleWater**：CPU 高度场波动方程 + WebGL Fresnel / 高光——点击涟漪是算出来的，不是 CSS 圆环；
*   **SmokeFog**：FBM 撕边精灵 + 阵风场拨散——雾气是升起来的，拨开后还会慢慢回来。

如果你正在做活动页或氛围型 Landing，打开 Playground 点两下比看文档更快：

*   <https://jiaxiantao.xyz/cos-design/#/rippleWater>
*   <https://jiaxiantao.xyz/cos-design/#/smokeFog>

```bash
pnpm add @cos-design/ripple-water @cos-design/smoke-fog
```

欢迎 Issue / PR，一起把背景动效做得更完整。

***

## 系列延伸阅读

*   [cos-design WeatherBackground：用 Canvas 做一个「会变天」的背景引擎](https://jiaxiantao.github.io/blogs/post/cos-design-WeatherBackground-Canvas天气引擎与Open-Meteo实况)
*   [cos-design v3.0：从 15 个 Demo 到 49 个组件的视觉特效库](https://jiaxiantao.github.io/blogs/post/cos-design-v3.0-从15个Demo到49个组件的视觉特效库)
*   [cos-design：从视觉 Demo 到可发布组件库的完整实践](https://jiaxiantao.github.io/blogs/post/cos-design-从视觉Demo到可发布组件库的完整实践)

***

## 参考

| 资源                     | 链接                                                       |
| ---------------------- | -------------------------------------------------------- |
| RippleWater Playground | <https://jiaxiantao.xyz/cos-design/#/rippleWater>        |
| SmokeFog Playground    | <https://jiaxiantao.xyz/cos-design/#/smokeFog>           |
| GitHub                 | <https://github.com/jiaxiantao/cos-design>               |
| npm 全量包                | <https://www.npmjs.com/package/cos-design>               |
| npm RippleWater        | <https://www.npmjs.com/package/@cos-design/ripple-water> |
| npm SmokeFog           | <https://www.npmjs.com/package/@cos-design/smoke-fog>    |
| 2D 波动方程 / 高度场水面        | 经典 discrete wave equation 仿真                             |
| FBM 值噪声                | 程序化纹理常用手法                                                |

***
