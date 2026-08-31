<!-- post-id: 92365ecd76b94b37 -->

# 登录页还在用渐变？我一口气做了 5 个能摸的背景动效：吹蒲公英、滴墨染水、点熔岩闷裂

> 发布日期：2026-08-31\
> 标签：前端 / React / Canvas / WebGL / 组件库 / cos-design / 视觉特效 / 交互设计

做活动页、登录屏、品牌 Landing 时，背景常常是个尴尬的存在：纯 CSS 渐变太「模板站」，Three.js 流体 Demo 又太重，临时抄一段 CodePen 往往只能撑一次活动。

我在 [cos-design](https://github.com/jiaxiantao/cos-design) 里一直在补这一层——**可装包、可调参、能交互的背景动效**。v3.6 做了深海气泡场，v3.5 做了水面涟漪和烟雾雾气，v3.7 把图片预览做成了 13 种「能摸」的交互。

**v3.8.0** 这次一口气上了 5 个重磅背景组件，组件总数来到 **91**。它们气质完全不同，但共享同一套工程约定：`fill` 铺满、`bindVisibilityPause` 切 tab 暂停、`prefers-reduced-motion` 静态帧降级、独立 `@cos-design/*` 分包。

全文约 **12 分钟**。建议先打开 [Playground](https://jiaxiantao.xyz/cos-design/#/)（侧栏 → 背景动效），边读边摸——每个组件我都按**侧栏顺序**写：先讲为什么要做，再拆核心实现，最后留关键交互帧给你对照。

**仓库**：[github.com/jiaxiantao/cos-design](https://github.com/jiaxiantao/cos-design) · **版本**：`cos-design@3.8.0`

| 组件 | 中文 | 渲染路线 | 独立包 |
| --- | --- | --- | --- |
| `SoapBubbles` | 肥皂泡天空 | Canvas 2D 薄膜光学 + 融合 | `@cos-design/soap-bubbles` |
| `DandelionField` | 蒲公英播种 | Canvas 2D 生命周期 + 物理 | `@cos-design/dandelion-field` |
| `LavaBubble` | 熔岩泡 | CPU 场仿真 + WebGL 着色 | `@cos-design/lava-bubble` |
| `InkBloom` | 墨染清水 | Canvas 2D 密度/速度场 | `@cos-design/ink-bloom` |
| `AuroraVeil` | 极光帷幕 | Canvas 2D 光带轮廓 | `@cos-design/aurora-veil` |

***

## 开场：五个场景，五种「介质」

下面五张图，就是 Playground 里五个新组件的默认态——从肥皂泡到极光，一张比一张「不像 CSS 能做出来的」：

![SoapBubbles 肥皂泡天空 — 虹彩薄膜缓缓上升](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/27430329d3de4c9399f2c34025120ef0~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788252584&x-orig-sign=2sjojk5mL%2F2bbbG2L%2FW2xpbZEaY%3D)

![DandelionField 蒲公英播种 — 多株绒球静立草坡](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/62bb24936d75486994ac53d4da0e1011~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788252620&x-orig-sign=0qQtBRxg1e2YzyNb%2B881w%2FzXASs%3D)

![LavaBubble 熔岩泡 — 暗红湖面随机闷胀](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/c2aa4d9eb2c94786a61e00d84cab2655~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788252651&x-orig-sign=%2FLKFuhXTRtFJFp0W%2FlMpjRZ643s%3D)

![InkBloom 墨染清水 — 一盆尚浅的清水](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/24f3c6f5a86c4d27b56aee4310bf8092~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788252717&x-orig-sign=PCQasI%2B814rMoBerDn4SIXqF3zg%3D)

![AuroraVeil 极光帷幕 — 星夜垂落光带](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/1448543998c14ac7b1b5f067d23e4249~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788252736&x-orig-sign=gVDKtsOHro8BV0rVP2kGBNK9iCY%3D)

这五个组件不是「五种配色方案」，而是五种**介质模型**：

- **肥皂泡** — 薄膜干涉色 + 上升气流 + 融合/爆裂
- **蒲公英** — 植株生命周期 + 种子飘飞 + 落地发芽闭环
- **熔岩** — 壳层鼓起、闷裂、空腔回填的高度场
- **墨染** — 浓墨滴入清水后的密度场流体
- **极光** — 垂向光带在星夜里的弯曲与脉冲

对外都是几个 props；对内各自拆模块。接下来五个章节，我会按这个顺序往下走——**每节末尾留 Playground 链接，方便你对照动效**。

***

## 一、SoapBubbles：薄膜光学，不是几个半透明圆

v3.8.0 的第一个背景，我从最「轻」的开始：纯 Canvas 2D，没有场仿真，但要骗过眼睛——泡膜得泛虹彩，碰在一起得会融，戳破得溅水珠。

![SoapBubbles 默认飘飞 — 不同深度的泡各有虹彩](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/88bf209fcc934c4e9755d97c9dd44922~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788253077&x-orig-sign=u2poU6qMjs0PW1eUuKOs5cHnLTM%3D)

### 它解决什么问题？

「肥皂泡背景」最容易翻车：画几个 `arc` + 白高光，看起来像玻璃球。真实肥皂泡的关键是**薄膜干涉**——厚度变化带来彩虹色斑，以及**融合时 neck 收缩**的 metaball 形态。

### 核心实现：film + merge + pop 三件套

**薄膜色** `film.ts`：`filmRgb(thickness)` 在 8 个干涉色 stop 间插值；`drawSoapIridescence` 在泡内撒 7~12 个 `softBlob` 色斑 + rim 色带，按 `lambertAtAngle` 受光。

**运动**：每个泡有 `rise`（上升力）、`gust`（阵风倍率）、`drift`（横向目标），用指数 ease 追踪目标速度——不是匀速上升，而是「忽快忽慢、左右晃」。

**融合** `merge.ts`：近距先弱吸引，触及时 30% 概率双爆、70% 进入 merge 状态机。`resolveMergePose` 分 **approach / absorb** 两阶段，体积按 `∛(r₁³+r₂³)` 守恒，绘制时用 metaball 轮廓（与 [BubbleField](https://jiaxiantao.xyz/cos-design/#/bubbleField) 同思路）。

**爆裂** `popBubble`：14+ 颗 bead 水珠沿点击反方向飞出 + 28+ 颗 mist 微粒；pop 动画结束后 `spawnBubble` 从底部补新泡。

```tsx
import { SoapBubbles } from '@cos-design/soap-bubbles';

<SoapBubbles fill count={28} speed={1} />
```

左：点击戳破，膜 fade 的同时水珠飞出。右：两泡靠近融合，颈部收缩成 metaball 连体。

<img src="https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/da3d01a102b24bc0881dd96d481c6641~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788252829&x-orig-sign=sfL1%2FCZ0WBhPqLafe5%2BFFgxRBMM%3D" alt="SoapBubbles 点击爆裂" width="45%" />

<img src="https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/70522fd0509c466482bf20e2c09a263c~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788252849&x-orig-sign=pc5hvf25wFY8nizQMcq3Aao8X5c%3D" alt="SoapBubbles 双泡融合" width="45%" />

**一句话带走**：虹彩来自薄膜厚度插值，灵魂在 merge 状态机——体积守恒 + metaball 绘制。

👉 试玩：[#/soapBubbles](https://jiaxiantao.xyz/cos-design/#/soapBubbles)

***

## 二、DandelionField：一整片会呼吸的生命循环

肥皂泡是「死物物理」；第二个组件我想做**活物逻辑**——不是粒子往上飘，而是一株株蒲公英真的在长高、开花、变绒球、被风吹散、再发芽。Playground 里等 intro 动画播完，你会看到草坡上一片 mature 绒球，那就是最佳阅读起点。

![DandelionField 成熟态 — 多株绒球静立草坡](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/ac528964215b42e9a447752c9f90bc4f~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788253046&x-orig-sign=42a2aVcb55rGYu0zg078f5CPJCM%3D)

### 它解决什么问题？

「飘絮粒子」Demo 很多，但很少做成**完整生态**：发芽 → 开花 → 变绒球 → 被风吹散 → 种子落地 → 再发芽。DandelionField 要的是这个闭环，而且鼠标滑过要像真的在吹风。

### 核心实现：模块化生命周期

源码按职责拆成六个文件——v3.8.0 CHANGELOG 里专门提到的重构：

```
dandelionField/
├── index.tsx      # React 外壳、主循环、指针风场
├── plant.ts       # 植株状态机：sprout → flower → puffing → mature → wither
├── seed.ts        # 附着/脱离、飘飞、落地、发芽
├── draw.ts        # 茎叶、绒球、种子、光晕
├── scene.ts       # 静态背景 + 草簇风摆
└── frame-cache.ts # 植株几何缓存（每帧不算两次 head 位置）
```

**植株状态机**是灵魂。以 `mature` 为例：先 `matureHoldLeft` 随机驻留，到期后 `beginReleasing`，按 `scheduledRelease` 时间轴**不规则**释放种子——外圈先飞、内圈后飞，而不是一次性爆炸。

**指针风场**：`pointermove` 根据位移速度算 gust，扫过 mature/puffing 绒球且距离 < 105×scale 时，`boostPlantRelease` 加速散种；点击最近绒球则 `boostPlantRelease(2.8)` 整朵炸开。

**种子发芽**：落地后延迟 `germinateDelay`，按 `GERMINATION_CHANCE` / `GERMINATION_NEAR_CHANCE` 决定是否在附近长出新株——离母株越近概率越高，视觉上像「一片草地慢慢蔓延」。

```tsx
import { DandelionField } from '@cos-design/dandelion-field';

<DandelionField fill plantCount={10} seedCount={32} speed={1} />
```

左：快速划过绒球，风场加速散种。右：点击整朵炸开，种子刚离体的一瞬。

<img src="https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/b5e2390bd81348eea5257b1867b6729b~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788253119&x-orig-sign=S49uMKqqJ1SVKz2ZeJJ0eF8IlEg%3D" alt="DandelionField 滑动吹风散种" width="30%" />

<img src="https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/ddfdacb9117746cc8e2e81a77094980a~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788253169&x-orig-sign=LEN4ItkSvJXiBQdnhWLWAZ4PG0Y%3D" alt="DandelionField 点击炸开绒球" width="50%" />

**性能优化**（v3.8.0 重点）：`PlantFrameCache` 缓存 head/life 几何；`AttachedSeedTracker` 用计数器替代每帧 `filter` 附着种子——植株多时帧率更稳。

**一句话带走**：这不是粒子系统，是带 germination 闭环的植株状态机 + 指针风场。

👉 试玩：[#/dandelionField](https://jiaxiantao.xyz/cos-design/#/dandelionField)（建议先等 intro 播完再摸）

***

## 三、LavaBubble：CPU 算场，GPU 只看

前两个都是 Canvas 2D。第三个我想做「硬介质」——熔岩湖。难点不在颜色渐变，而在**完整事件链**：鼓起 → 变薄 → 闷裂 → 空腔 → 回填，还要能点击、能拖拽撕裂。这是五个组件里唯一上了 WebGL 的。

![LavaBubble 自动鼓泡 — 湖面随机闷胀](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/40d081107e534f0ebde734963d99c083~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788253233&x-orig-sign=ogLbwF0xT0MqjQAaUWOwGhobntI%3D)

### 它解决什么问题？

熔岩/岩浆视觉在 Web 里常被做成 looping 视频或纯 shader 噪声——能看，但很难**点击鼓起 → 壳裂 → 溅射 → 空腔回填**这一完整事件链。LavaBubble 拆成：**CPU 192×192 场仿真**写纹理，**WebGL 片段着色**读高度/热量/空腔做法线光照。

### 核心实现：Blister 四阶段状态机

每个 blister 经历：

```
inflate（壳层隆起）→ thin（变薄、裂纹发热）→ burst（撕裂空腔 + 溅射）→ cavity（回填、余温）
```

`sim.ts` 里维护三张标量场：

- `heightField`：隆起高度
- `heatF`：热量（写回 shader 做辉度）
- `cavityF`：爆裂后的空腔深度

`upload()` 把 RGBA 纹理打包：`R=height, G=heat, B=cavity`。

片段着色器 `shaders.ts` 从纹理采样后：

1. `calcNormal` 算法线（空腔会「挖深」法线）
2. `heatColor(t)` 六段渐变——**最低也是暗红**，避免纯黑熔壳
3. wrap lighting + 双层 specular + 空腔 rim 余温

交互两路：

- **点击** `spawnBlister(u,v)` 在 UV 坐标鼓新泡
- **拖拽** `applyStir` 注入涡旋、螺旋热纹、椭圆 shell crack，并 `stirBlister` 加速未爆泡的裂纹

```tsx
import { LavaBubble } from '@cos-design/lava-bubble';

<LavaBubble fill heat={1} autoSpawn activity={1} speed={1} />
```

左：点击后 burst 相，空腔 + 溅射热纹。右：壳层隆起、裂纹发热的 thin 阶段。

<img src="https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/13097278587e444fb4a83fcfefb495ad~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788253303&x-orig-sign=PwRjHvbeHwCTGSKx%2BC8wHo0Hp2o%3D" alt="LavaBubble 点击爆裂" width="50%" />

<img src="https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/24d27d7e3f134b0a913504eebce8c569~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788253285&x-orig-sign=EHkJpKLXVUIg8u6m2ceUF234C5I%3D" alt="LavaBubble 壳层隆起" width="40%" />

**为什么 CPU + GPU 分工？** 气泡生命周期、溅射粒子（mist/bomb/crust 三类 spatter）、热扩散需要随机性和分支逻辑，放 CPU 更直观；全屏像素着色交给 GPU，192² 纹理足够表达「湖面的起伏与裂口」。

**一句话带走**：仿真在 CPU，观感在 GPU——纹理 RGB 三包 height / heat / cavity。

👉 试玩：[#/lavaBubble](https://jiaxiantao.xyz/cos-design/#/lavaBubble)（`autoSpawn` 开着等几秒，看随机鼓泡）

***

## 四、InkBloom：一滴墨，两种场

熔岩是「硬壳 + 碎裂」；第四个我想做完全相反的质感——**软、慢、会累积**。墨水滴进清水，溶开后整盆水越来越深——这种「越摸越深」的反馈，blur 圆叠不出来。

![InkBloom 刚滴墨 — 浓墨心 + 羽状外晕](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/26bc0078ea434495b70c52035429fef1~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788253371&x-orig-sign=nXsMyHCc3ne3vVzoqk%2BoeOeOPs0%3D)

### 它解决什么问题？

「墨水扩散」特效常见做法是叠几张 blur 圆——像，但缺少**溶开**和**整片水被染深**的累积感。InkBloom 用轻量 2D 流体近似：**密度场 + 速度场 + 持久染色场**。

### 核心实现：三缓冲区 + 低分辨率仿真

仿真网格 `simW × simH ≈ 画布 / 4`，每格维护：

| 场 | 变量 | 作用 |
| --- | --- | --- |
| 密度 | `dens` | 当前悬浮的浓/淡墨团 |
| 速度 | `vx`, `vy` | 平流 + 涡旋驱动 |
| 染色 | `stain` | 已溶入水中、几乎不退色的背景色 |

主循环（每帧）：

```
applyForces → 粘滞衰减 → advect(dens) → diffuseDensity
→ advect(velocity) → dens 溶入 stain → stain 缓慢铺匀
→ paintWater(avgStain) → renderStain → renderInk
```

**点击注入** `injectDrop` 做三件事：不规则浓墨心（fbm 扰动边界）、3~6 个随机涡旋（切向速度）、外圈 22 点淡墨晕。**拖拽** `injectStir` 把指针位移写进速度场。

力场里值得单独说的一句是**涡度约束**——从 `curl` 场反推侧向推力，拉出絮状细丝，避免每次扩散都是完美圆：

```ts
const cx = (curl[i + 1] - curl[i - 1]) * 0.5;
const cy = (curl[i + simW] - curl[i - simW]) * 0.5;
vx[i] += (cy / len) * curl[i] * eps;
vy[i] -= (cx / len) * curl[i] * eps;
```

**质量守恒的染色**：浓团 `dissolve` 后质量转入 `stain`，`paintWater` 根据 `avgStain` 把清水从 `#c5dff0` 渐变为 `#12151a`——点得越多，整盆水越深，这是和「一次性 blur 圆」最大的体验差异。

```tsx
import { InkBloom } from '@cos-design/ink-bloom';

<InkBloom fill inkColor="#0c0e12" speed={1} />
```

上：单点滴墨，羽状晕开。下：连续多点后，整片清水被染深——注意背景色已从浅蓝变成深灰。

![InkBloom 单点扩散 — 絮状细丝](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/0f67fce0c76e43deb205d5123f8f3681~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788253417&x-orig-sign=yLLprNW0qR3SCk581vH01yhjH%2BQ%3D)

![InkBloom 多点染深 — 整盆水变深](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/b60a44b4ee824eec8f66e8a8be31a59d~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788253446&x-orig-sign=SpoSPkMvTqs0ad7V3rLIifibPdo%3D)

**一句话带走**：`dens` 是悬浮墨团，`stain` 是已溶入水的永久染色——质量守恒，越点越深。

👉 试玩：[#/inkBloom](https://jiaxiantao.xyz/cos-design/#/inkBloom)（连续点 5~8 次，等十秒看背景变深）

***

## 五、AuroraVeil：把极光画成「可弯曲的丝带」

五个里最后做、也最「登页面」的一个。极光背景烂大街，但多数要么像壁纸、要么 shader 调参劝退。我想用纯 Canvas 2D 做出**光带能被鼠标弯曲、点击能爆发脉冲**的北极夜——不引 WebGL，但要够「哇」。

![AuroraVeil 默认态 — 星夜 + 多层垂落光带](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/24ac527592fb4e25a65bc1a3d605e44c~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788253469&x-orig-sign=%2BmJPaT%2BBvWa4eqAXwTfqVEf3c4E%3D)

### 它解决什么问题？

市面上「极光背景」常见两条路：CSS 渐变动画（轻，但像壁纸）或 WebGL 噪声场（真，但调参成本高）。AuroraVeil 选中间态：**纯 Canvas 2D**，用**逐行轮廓**描述光带，再用离屏 buffer + `screen` 混合叠出辉光。

### 核心实现：EdgeProfile 光带

每条光带（Veil）不是一张图片，而是一列 **y → 中心 x、半宽 hw** 的采样：

```ts
// 每一行 y：正弦波叠加 drift + 指针磁吸 + 点击脉冲扰动
const centerX = (veil, y, time, sheet) => { /* wave + drift + pointer magnet */ };
const halfWidth = (veil, y, time, sheet) => { /* 指针附近收窄 */ };

// Float32Array 缓存左右边缘，拼成闭合 ribbon
const buildProfile = (veil, time, sheet): EdgeProfile => { /* leftBuf / rightBuf */ };
```

渲染分三层：

1. **paintSky**：深空渐变 + 260 颗按深度闪烁的星 + 地平线暗角
2. **fillRibbon**：水平/垂直双色渐变，`source-atop` 做垂向衰减
3. **离屏合成**：主 sheet `screen` 叠一层，再 blur 2.4px 的 glowSheet 做柔辉

交互上，指针会**磁吸弯曲**最近光带、**收窄**经过区域的半宽；点击触发 `burstRef` 整屏 ripple + 最多 4 个扩散 pulse。

```tsx
import { AuroraVeil } from '@cos-design/aurora-veil';

<AuroraVeil fill colors={['#7ee8d8', '#4cc9f0', '#9d8df1']} bandCount={5} speed={1} />
```

![AuroraVeil 点击脉冲 — 光带爆发能量波纹](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/4f164b166345449a8131b6b8f2005632~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=e9ecf3d6&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1788253493&x-orig-sign=nj5R8Ly0CWjeFpYjI2nFJdikBAI%3D)

**工程细节**：`MAX_DPR = 2`；`prefers-reduced-motion` 时 stars 停止 twinkle、光带冻结；与 BubbleField 一样走 `@cos-design/shared` 的 `useCanvasBox`。

**一句话带走**：光带不是贴图，是逐行 EdgeProfile + 离屏 glow 合成。

👉 试玩：[#/auroraVeil](https://jiaxiantao.xyz/cos-design/#/auroraVeil)（在光带中心点一下，看脉冲扩散）

***

## 六、五个组件怎么选？一张表说清楚

五个组件读下来，你可能已经在脑子里对上了场景。我把选型收成一张表——**按 Playground 侧栏顺序排列**，方便回去对照：

| 你要的气质 | 推荐组件 | 交互方式 | 渲染成本 |
| --- | --- | --- | --- |
| 童趣 / 夏日 / 轻活动 | SoapBubbles | 点击戳破、自动融合 | 中（纯 Canvas） |
| 治愈 / 春季活动 / 自然系 | DandelionField | 滑动吹风、点击炸开 | 中高（多实体 + 生命周期） |
| 硬核 / 游戏 / 暗黑 Hero | LavaBubble | 点击鼓泡、拖拽撕裂 | 中高（WebGL + CPU sim） |
| 国风 / 文艺 / 留白排版 | InkBloom | 点击滴墨、拖拽搅动 | 中（低分辨率场） |
| 科技感 / 登录屏 / 北欧夜 | AuroraVeil | 移动弯曲、点击脉冲 | 中（离屏 blur） |

还有一个 cos-design 一贯建议：**一页只放一个强全屏动效背景**。第二个背景请降尺寸或关 `interactive`，否则抢视觉、也抢 GPU。

如果五个都想试一遍，Playground 侧栏从上往下点就行——和本文顺序完全一致。

***

## 七、工程化：分包、降级、Next.js

五个组件均已独立发布，可按需安装——不必为了一个肥皂泡拖进整个库：

```bash
pnpm add @cos-design/soap-bubbles @cos-design/dandelion-field @cos-design/lava-bubble @cos-design/ink-bloom @cos-design/aurora-veil
# 或全量
pnpm add cos-design@3.8.0
```

Next.js App Router 记得动态导入 + `ssr: false`（Canvas/WebGL 仅客户端）：

```tsx
import dynamic from 'next/dynamic';

const SoapBubbles = dynamic(
  () => import('@cos-design/soap-bubbles').then((m) => m.SoapBubbles),
  { ssr: false }
);

export default function Hero() {
  return (
    <section style={{ position: 'relative', minHeight: '100vh' }}>
      <SoapBubbles fill />
      {/* 前景内容 z-index 需高于 canvas */}
    </section>
  );
}
```

共享约定（v3.7 起逐步统一，五个新组件全部遵循）：

- **`fill`**：父级需有明确高度（如 `100vh`），组件铺满
- **`bindVisibilityPause`**：切 tab 停 rAF，省电
- **`prefers-reduced-motion`**：静态帧，不黑屏
- **Playwright smoke**：v3.8.0 为新组件补了 canvas 挂载测试

`@cos-design/shared` 本版还导出了 `softSat` 等数学工具，供后续组件复用。

***

## 收尾：从 Demo 到「介质库」

回头看 v3.8.0，这五个组件不是简单「+5」，而是在补 cos-design 背景线的**介质维度**：

- SoapBubbles → **薄膜**
- DandelionField → **生命**
- LavaBubble → **热/壳层**
- InkBloom → **流体**
- AuroraVeil → **光**

它们和早期的 WeatherBackground、BubbleField、RippleWater 一起，构成一套「不用 Three.js 也能做重磅背景」的选项库。

如果你只来得及摸一个：夏日活动页戳 [SoapBubbles](https://jiaxiantao.xyz/cos-design/#/soapBubbles)，登录屏弯曲 [AuroraVeil](https://jiaxiantao.xyz/cos-design/#/auroraVeil)，国风留白滴 [InkBloom](https://jiaxiantao.xyz/cos-design/#/inkBloom)。**背景能不能留人，往往差的就是这一层可交互的介质感**——读完这篇，打开 Playground 走一遍侧栏，比看十张截图都直观。

***

## 链接与延伸阅读

| 资源 | 地址 |
| --- | --- |
| Playground | <https://jiaxiantao.xyz/cos-design/#/> |
| SoapBubbles | <https://jiaxiantao.xyz/cos-design/#/soapBubbles> |
| DandelionField | <https://jiaxiantao.xyz/cos-design/#/dandelionField> |
| LavaBubble | <https://jiaxiantao.xyz/cos-design/#/lavaBubble> |
| InkBloom | <https://jiaxiantao.xyz/cos-design/#/inkBloom> |
| AuroraVeil | <https://jiaxiantao.xyz/cos-design/#/auroraVeil> |
| GitHub | <https://github.com/jiaxiantao/cos-design> |
| npm | <https://www.npmjs.com/package/cos-design> |

**同系列文章**

- [BubbleField：用 Canvas 做一个「会呼吸」的深海气泡场](https://jiaxiantao.github.io/blogs/post/ef624d3ba560423b)
- [RippleWater & SmokeFog：水面涟漪与烟雾雾气怎么做](https://jiaxiantao.github.io/blogs/post/2ef3989533f7403d)
- [WeatherBackground：用 Canvas 做一个「会变天」的背景引擎](https://jiaxiantao.github.io/blogs/post/acbc4062c27249f5)
- [cos-design v3.0：从 15 个 Demo 到 49 个组件的视觉特效库](https://jiaxiantao.github.io/blogs/post/d156efd617754cf1)
