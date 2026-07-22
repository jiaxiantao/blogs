# cos-design WeatherBackground：用 Canvas 做一个「会变天」的背景引擎

> 发布日期：2026-07-22\
> 标签：前端 / React / Canvas / 组件库 / cos-design / 视觉特效 / Open-Meteo

活动页、登录页、品牌展示页，常常需要一层「有天气感」的背景：晴天要有光晕，雨天要有斜线与水花，雪天最好能看到晶体，而不是几个白色圆点。很多项目会临时找一段粒子 Demo 改一改——能用，但难扩展、难维护，更谈不上对接真实天气。

**WeatherBackground** 是我在 [cos-design](https://github.com/jiaxiantao/cos-design) 里新增的背景动效组件：一套 Canvas 2D 渲染器 + 15 种天气配方，可选接入 Open-Meteo 实况，并自动区分日夜。本文讲清技术实现，也顺便说明怎么在业务里用起来。

**Playground**：<https://jiaxiantao.github.io/cos-design/#/weatherBackground>\
**仓库**：[github.com/jiaxiantao/cos-design](https://github.com/jiaxiantao/cos-design)\
**独立包**：`@cos-design/weather-background@3.5.1`\
**全量包**：`cos-design@3.5.1`

***

## 效果预览

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/70487ce7ee474bee8b15d1330a004b23~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785309745&x-orig-sign=4cd%2BpVLBYgf3OPhtyIj9CROfqQ4%3D)

***

## 一、它解决什么问题？

常见天气背景实现有三条路：

| 方案               | 优点   | 痛点           |
| ---------------- | ---- | ------------ |
| 静态图 / CSS 渐变     | 轻量   | 没有「天气在动」的体感  |
| 现成粒子 Demo        | 上手快  | 一种效果一份代码，难复用 |
| Three.js / WebGL | 表现力强 | 依赖重，活动页往往过重  |

WeatherBackground 选的是中间态：**纯 Canvas 2D + React 外壳，零动画库依赖**。对外是一个组件：

```tsx
import { WeatherBackground } from '@cos-design/weather-background';

<WeatherBackground weather="thunderstorm" width={800} height={450} />
```

对内是一台分层渲染引擎：天空、日月星、云、雾霾、雨、雪、冰雹、风、闪电，按配方组合，而不是为每种天气写一套独立循环。

***

## 二、整体架构：配置驱动的场景配方

核心思路可以概括成一句话：

> **一种天气 = 一份 `WeatherConfig`；一个组件 = 一套共享的 `draw*` 管线。**

```ts
interface WeatherConfig {
  sky: [string, string];
  sun: 'full' | 'soft' | 'dim' | 'none';
  cloudCount: number;
  cloudColor: [number, number, number];
  cloudAlpha: number;
  cloudSpread: number;
  rain: { count: number; speed: number; wind: number; alpha: number; splash: boolean } | null;
  fogBanks: number;
  haze: number;
  snowCount: number;
  lightning: boolean;
}
```

例如大雨与雷阵雨的差异，主要是参数表，而不是两套代码：

| 类型             | 雨滴数 | 风速分量 | 闪电 |
| -------------- | --- | ---- | -- |
| `heavyRain`    | 280 | -2.8 | 否  |
| `thunderstorm` | 240 | -2.2 | 是  |

夜间则另有 `NIGHT_CONFIGS`：换天空渐变、压暗云色、补星空与月亮。`live` 模式下日夜由 Open-Meteo 的 `is_day` 覆盖，不必业务侧自己算日落。

渲染主循环按固定图层顺序叠画：

    drawSky → drawSun/Moon/Stars → drawClouds → drawFog → drawHaze
      → drawRain → drawSnow → drawHail → drawWind → drawLightning

这和游戏里的「场景配方 + 图层合成」同一套心智：加新天气时，优先改配置表；只有新物理（比如冰雹重力）才扩绘制函数。

***

## 三、15 种天气：覆盖「晴—雨—雪—极端」全谱

| 类型                                         | 中文     | 视觉要点                   |
| ------------------------------------------ | ------ | ---------------------- |
| `sunny`                                    | 大晴天    | 完整太阳 + 旋转光晕射线          |
| `partlyCloudy`                             | 多云     | 柔光日 + 多层云              |
| `overcast`                                 | 阴天     | 灰蓝天 + 厚云 + 轻霾          |
| `lightRain` / `moderateRain` / `heavyRain` | 小/中/大雨 | 斜雨线；中大雨带地面水花           |
| `thunderstorm`                             | 雷阵雨    | 重雨 + 分形闪电 + 全屏闪白       |
| `fog`                                      | 雾      | 椭圆雾带径向淡出               |
| `lightSnow` / `moderateSnow` / `heavySnow` | 小/中/大雪 | 远景光点 + 近景六重冰晶          |
| `sleet`                                    | 雨夹雪    | 雨雪同屏                   |
| `hail`                                     | 冰雹     | 重力下落、弹跳、运动拖尾           |
| `smog`                                     | 霾      | 暖褐雾带 + 霾色罩层            |
| `gale`                                     | 大风     | Bezier 风纹 + 叶片碎屑；云速 ×7 |

从产品角度，这不是「再做一个雪花粒子」，而是希望业务能按语义选天气：`weather="heavySnow"` 比 `count={300}` 更贴近产品文案。

下面挑几组代表性场景（建议同尺寸截图，方便横向对比）：

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/6604d731be2b4e5bba96645aacb4fb9c~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785309745&x-orig-sign=XL5nqb%2BxsIojLhWAgDHDp2r53Fc%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/bf1cb7c791b248da955138c82d60adeb~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785309745&x-orig-sign=fQ4d%2BF%2BULBqOXeq2%2BUIK%2F1SXAXY%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/886cb8e5db724d74a6e4a3b4f8a6bd14~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785309745&x-orig-sign=BtiBHXILGnCPCH9TRTBlf2H4dow%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/2e93746b163840bb8a98a723e9bbf8a3~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785309745&x-orig-sign=Iw03GV1RRs8%2FiVN7iNmBhnt3FYQ%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/fded50f9d3154089bd9e05c74b045694~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785309745&x-orig-sign=C5ddis8VFsPnpJm9e2Ne2AAUy2w%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/eb4f50c402cc475f84085fd967fc0e11~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785309745&x-orig-sign=uH0y0g71FzTtwlKGVGikp3ClPVQ%3D)

***

## 四、关键算法：雪花、闪电、冰雹

这三项是组件「看起来不像普通粒子 Demo」的关键。

### 4.1 程序化六重对称冰晶

雪花不是贴图。生成时按尺寸分流：

*   小：径向渐变柔边光点（远景）
*   大：`makeCrystalSprite` 画六重对称晶体（近景）

尺寸用 `Math.pow(random, 1.6)` 偏小采样，远处细碎、近处偶有大片，景深更自然。晶体本身带随机：侧枝对数、夹角、尖端分叉、六边形内核——每片都不一样：

```ts
const makeCrystalSprite = (radius: number): HTMLCanvasElement => {
  // ... 离屏 canvas
  const branchPairs = 1 + Math.floor(Math.random() * 3);
  // 六次旋转，每次画主轴 + 侧枝 + 可选 tip fork
  for (let i = 0; i < 6; i++) {
    c.rotate((i * Math.PI) / 3);
    // moveTo / lineTo 绘制一条臂及其对称分支
  }
  return cv;
};
```

运行时只 `drawImage` 离屏精灵，避免每帧重画几何——这是性能上的关键取舍。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/604c7261f16c46fbaa06f6b937b3a316~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785309745&x-orig-sign=r64n40PrAv4AU77HAkZ8N0G03Tw%3D)

### 4.2 中点位移分形闪电

雷电用经典 **midpoint displacement**：对线段中点加随机扰动，递归细分，生成锯齿折线：

```ts
const displaceBolt = (
  x1: number, y1: number, x2: number, y2: number,
  rough: number, depth: number
): [number, number][] => {
  if (depth <= 0) return [[x1, y1], [x2, y2]];
  const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * rough;
  const my = (y1 + y2) / 2;
  const left = displaceBolt(x1, y1, mx, my, rough * 0.55, depth - 1);
  const right = displaceBolt(mx, my, x2, y2, rough * 0.55, depth - 1);
  return [...left.slice(0, -1), ...right];
};
```

配合 `boltLife` 淡出与 `flashAlpha` 全屏闪白衰减，雷阵雨才有「劈一下、亮一下」的节奏，而不是一根常驻折线。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/e21e4be53b9740168478b554f9a55ca5~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785309745&x-orig-sign=AY57BnnX4TkhTK1PDi61HXKeXS0%3D)

### 4.3 轻量冰雹物理

冰雹不是匀速下落：

*   每帧 `vy += 0.16`（重力）
*   落地第一次：`vy *= -0.36`、`vx *= 0.72`（弹跳衰减）
*   第二次落地：重置到屏幕上方
*   用上一帧位置画短拖尾，增强速度感

体量不大，但观感明显强于「白色圆点往下掉」。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/d0e6ee168d9d4517b92839094d231f29~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785309745&x-orig-sign=neS3JzIEmk%2FazJKFHBHx23HTxg0%3D)

### 4.4 其它值得一提的细节

*   **雨**：按风速向量画斜线段；整批 `beginPath` / 一次 `stroke`；水花数量封顶 60，防爆炸。
*   **风**：Bezier 曲线做风纹，长条上挂旋转椭圆「叶片」。
*   **太阳**：`full` 模式带 12 条旋转射线；`soft` / `dim` 只保留光晕层次。
*   **雾 / 霾**：椭圆雾带 + 径向透明；霾用偏暖褐色，与冷雾区分。

***

## 五、实况天气：Open-Meteo + WMO 映射

组件支持 `live`：把「演示天气」升级成「当前真实天气」。

### 5.1 数据流

    live=true
      ├─ 传了 latitude + longitude → 直接请求
      └─ 未传坐标 → navigator.geolocation（需 HTTPS + 授权）
             ↓
      Open-Meteo current: weather_code, wind_speed_10m, is_day
             ↓
      mapWmoCodeToWeatherType(code, windSpeed)
             ↓
      覆盖 weather / night；失败则回退到手动 weather

API 免费、免 Key，适合开源组件：

    https://api.open-meteo.com/v1/forecast
      ?latitude=...
      &longitude=...
      &current=weather_code,wind_speed_10m,is_day

### 5.2 映射规则

WMO 码映射进组件语义类型。额外有一条产品规则：

> 晴 / 多云 / 阴 且 10m 风速 ≥ **39 km/h**（约蒲福 6 级）→ `gale`

雷暴伴冰雹码（96 / 99）按 `thunderstorm` 渲染——因为冰雹场景没有闪电，而「雷」才是主导现象。

### 5.3 UX：换城不闪回默认晴天

`useLiveWeather` 在坐标变化重新请求时，**保留上一次成功的 weather**，组件叠 loading 遮罩。这样城市切换时画面连续，而不是先跳回 `sunny` 再切到实况。

> 📸 **截图占位①**：开启「实况」+ 选中某城市，截取状态文案（含 WMO / 风速 / 日夜）。\
> 📸 **截图占位②**：切换城市瞬间的「天气加载中…」遮罩（可选）。

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/c4ec8f5fb08942eb9fc8c1dcccd3d1ed~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1785309745&x-orig-sign=xO362b6pPciO%2B1rErVIiZ1ruz9M%3D)

业务也可单独使用 hook：

```tsx
import { useLiveWeather, mapWmoCodeToWeatherType } from '@cos-design/weather-background';

const { weather, status, current, error } = useLiveWeather(true, {
  latitude: 39.9,
  longitude: 116.4
});
```

***

## 六、性能与工程约束

视觉组件如果不谈性能，上线就会被关掉。这里做了几件「组件库该做的事」：

| 手段                       | 作用                        |
| ------------------------ | ------------------------- |
| `bindVisibilityPause`    | 标签页隐藏时跳过绘制，省电             |
| HiDPI `devicePixelRatio` | 高分屏清晰，逻辑坐标仍按 CSS 尺寸       |
| 雪花离屏精灵                   | 几何只生成一次                   |
| 雨滴批量 stroke              | 减少状态切换                    |
| 水花数量上限                   | 防止瞬时对象暴涨                  |
| 粒子预算写进配方                 | 大雨 280、大雪 300、冰雹 130——可预期 |

使用建议与 cos-design 其它 Canvas 背景一致：

1.  **一页一个强背景**，不要叠多个全屏 Canvas。
2.  Next.js 等 SSR 环境请 `dynamic(..., { ssr: false })`。
3.  活动页优先「一个 WeatherBackground + 若干局部交互」，而不是全场动画大战。

***

## 七、怎么用：安装、API、场景示例

### 7.1 安装

只想用天气背景：

```bash
pnpm add @cos-design/weather-background
```

或安装整库：

```bash
pnpm add cos-design
```

样式随包自动注入，无需再 `import` CSS。

### 7.2 Props 一览

```ts
export interface WeatherBackgroundProps {
  width?: number;          // 默认 800
  height?: number;         // 默认 450
  weather?: WeatherType;   // 默认 'sunny'
  night?: boolean;         // 夜间；live 下由 is_day 覆盖
  live?: boolean;          // Open-Meteo 实况
  latitude?: number;
  longitude?: number;
  onLiveWeather?: (weather: WeatherType) => void;
  loading?: boolean;       // 外部受控遮罩；live 请求中会自动显示
}
```

### 7.3 典型用法

**手动天气（活动页主题）**

```tsx
<WeatherBackground weather="heavySnow" night width={1200} height={640} />
```

**城市实况（数据大屏 / 天气产品）**

```tsx
<WeatherBackground
  live
  latitude={31.23}
  longitude={121.47}
  width={960}
  height={540}
  onLiveWeather={(w) => console.log('当前天气', w)}
/>
```

**Next.js**

```tsx
import dynamic from 'next/dynamic';

const WeatherBackground = dynamic(
  () =>
    import('@cos-design/weather-background').then((m) => m.WeatherBackground),
  { ssr: false }
);
```

### 7.4 适合放哪里？

*   营销活动页 Hero（节日雪景、暴雨氛围）
*   登录 / 欢迎页氛围层
*   天气类产品、城市大屏的背景层
*   作品集、技术 Demo 的「一眼能停住」的视觉锚点

不适合：对首屏字节极度敏感、且完全不需要动效的纯文档站或重度表单后台。

***

## 八、为什么做成独立子包？

cos-design 已进入 monorepo 分包阶段。WeatherBackground 既挂在全量 `cos-design` 下，也以 **`@cos-design/weather-background`** 单独发布：

*   只想要天气背景 → 装子包，依赖面更小
*   已经在用整库 → `import { WeatherBackground } from 'cos-design'` 即可
*   peer：`react` / `react-dom` ≥ 18
*   依赖：`@cos-design/shared`（可见性暂停等共享能力）

Playground 入口在文档站 `#/weatherBackground`，可切换 15 种天气、日夜，以及北京 / 上海 / 哈尔滨等城市实况，方便产品与设计直接看效果。

***

## 结语

WeatherBackground 想证明的不是「Canvas 能画粒子」，而是：

1.  **配置驱动**：15 种天气共用一条渲染管线，扩展成本可控；
2.  **程序化细节**：六重冰晶、分形闪电、冰雹重力，决定观感上限；
3.  **可落地**：Open-Meteo 实况、日夜自动、换城不闪、标签页暂停，组件库该有的工程细节都补上了；
4.  **可推广**：npm 一装就能用，Playground 一开就能看。

如果你正在做活动页或氛围型 Landing，不妨直接试一下：

```bash
pnpm add @cos-design/weather-background
```

在线预览：<https://jiaxiantao.github.io/cos-design/#/weatherBackground>\
欢迎 Issue / PR，一起把「会变天」的背景做得更完整。

***

## 系列延伸阅读

*   [cos-design：从视觉 Demo 到可发布组件库的完整实践](https://jiaxiantao.github.io/blogs/post/cos-design-%E4%BB%8E%E8%A7%86%E8%A7%89Demo%E5%88%B0%E5%8F%AF%E5%8F%91%E5%B8%83%E7%BB%84%E4%BB%B6%E5%BA%93%E7%9A%84%E5%AE%8C%E6%95%B4%E5%AE%9E%E8%B7%B5)
*   [cos-design v3.0：从 15 个 Demo 到 49 个组件的视觉特效库](https://jiaxiantao.github.io/blogs/post/cos-design-v3.0-%E4%BB%8E15%E4%B8%AADemo%E5%88%B049%E4%B8%AA%E7%BB%84%E4%BB%B6%E7%9A%84%E8%A7%86%E8%A7%89%E7%89%B9%E6%95%88%E5%BA%93)

***

## 参考

| 资源         | 链接                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------- |
| Playground | <https://jiaxiantao.github.io/cos-design/#/weatherBackground>                                 |
| GitHub     | <https://github.com/jiaxiantao/cos-design>                                                    |
| npm 全量包    | <https://www.npmjs.com/package/cos-design>                                                    |
| npm 子包     | <https://www.npmjs.com/package/@cos-design/weather-background>                                |
| Open-Meteo | <https://open-meteo.com/>                                                                     |
| WMO 天气码    | <https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM> |
