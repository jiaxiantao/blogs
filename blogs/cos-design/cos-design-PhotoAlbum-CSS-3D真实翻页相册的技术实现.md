<!-- post-id: 29f31a0c5fc3461f -->

# cos-design PhotoAlbum：用 CSS 3D 做一个「能翻页」的实体相册

> 发布日期：2026-07-31\
> 标签：前端 / React / CSS 3D / 组件库 / cos-design / 交互玩具 / 翻页动画

个人主页、婚礼邀请函、旅行回顾、品牌故事页——很多场景都想塞进一本「真的能翻」的相册，而不是左右滑的轮播。常见做法要么是一张张 `transform: rotateY` 的 Demo（卸层时中缝闪一下、铁圈穿模），要么是上 Three.js / 翻页引擎（活动页往往过重）。

**PhotoAlbum** 是我在 [cos-design](https://github.com/jiaxiantao/cos-design) **v3.7.1** 新增的交互玩具组件：纯 CSS 3D + React 状态机，无 WebGL。对外几个 props，对内把「一叶两面、装订铁圈、飞页、卸层防闪」做成可装包复用的组件。本文讲清技术实现，也方便你直接试用推广。

**Playground**：<https://jiaxiantao.xyz/cos-design/#/photoAlbum>\
**仓库**：[github.com/jiaxiantao/cos-design](https://github.com/jiaxiantao/cos-design)\
**独立包**：`@cos-design/photo-album@3.7.1`\
**全量包**：`cos-design@3.7.1`

***

## 效果预览

![image.png](https://jiaxiantao.github.io/blogs/images/cos-design-photo-album/01.webp)

![image.png](https://jiaxiantao.github.io/blogs/images/cos-design-photo-album/02.webp)

***

## 一、它解决什么问题？

| 方案              | 优点    | 痛点                |
| --------------- | ----- | ----------------- |
| 横向轮播 / Swiper   | 成熟、轻量 | 没有「翻书」的实体感        |
| 网上 CSS 翻页 Demo  | 上手快   | 卸层闪烁、装订穿模、难做成组件   |
| Three.js / 翻页引擎 | 表现力强  | 依赖重，活动页 / 个人站往往过重 |

PhotoAlbum 选的是中间态：**CSS `preserve-3d` + 明确的翻页状态机**。对外是一个组件：

```tsx
import { PhotoAlbum } from '@cos-design/photo-album';

<PhotoAlbum
  photos={[
    { src: '...', title: '在路上', description: '把远方装进相册' },
    { src: '...', title: '山谷晨光', description: '风从群山之间吹来' }
  ]}
  width={780}
  height={475}
/>
```

对内不是「给每张图加个 `rotateY`」，而是：

> 摊开左右页 → 点右半边翻走一叶两面 → 过半提前切底层 → 贴平后卸层，中缝不跳。

***

## 二、整体架构：舞台、书页、翻页叶、铁圈分层

源码集中在一个 React 组件 + 一份 Less 模块，职责可以这样理解：

```text
photoAlbum/
├── index.tsx              # 状态机、可见页索引、预热、键盘/点击
├── types.ts               # PhotoAlbumItem / Props / Labels
└── style/index.module.less # 透视舞台、封面、纸叠、飞页、翻页关键帧、铁圈
```

DOM 分层（从后往前）：

```text
album（perspective）
├── bookShadow            # 桌面投影
├── stage                 # 封面 + 左右纸边叠层（俯视倾角）
├── WireRings back        # 铁圈后半段（z-index 夹住）
├── book                  # 左右静态页 + 翻页叶（preserve-3d）
├── bookGutter            # 常驻中缝谷影（不跟翻页 class 挂动画）
├── WireRings front       # 铁圈前半段
└── hitArea 左 / 右       # 透明点击区
```

关键取舍：**铁圈不进 `book` 的 `preserve-3d`**。若铁圈和纸页在同一套 3D 空间里，翻页时环面会和纸面相交穿模。把铁圈放到 `album` 子级、用前后两半 `clip-path` + `z-index` 夹住翻页叶，几何上更稳。

![image.png](https://jiaxiantao.github.io/blogs/images/cos-design-photo-album/03.webp)

***

## 三、心智模型：一叶两面，索引每次 ±2

摊开时：

*   **右页** = `rightIndex`（当前焦点）
*   **左页** = `rightIndex - 1`

往后翻走的是「当前右页 + 它的背面」这一整叶，因此目标索引是 `fromIndex + 2`；往前翻是 `-2`。

```ts
// 一叶两面：往后翻带走右页及其背面，索引 +2；往前翻同理 -2
const targetIndex = direction === 'next' ? fromIndex + 2 : fromIndex - 2;
```

翻动叶的正反面：

| 方向       | front（朝外）     | back（背面）          |
| -------- | ------------- | ----------------- |
| next     | `fromIndex`   | `fromIndex + 1`   |
| previous | `targetIndex` | `targetIndex + 1` |

另外约定：`rightIndex` 可以等于 `photos.length`，表示右页是空白**尾飞页**，最后一叶翻完后停在「仅左页有图」。首页也有装饰性飞页（`index < 0`），形成开场 / 收束。

这和真实相册一致：你翻的是纸，不是「单独挪一张图」。

***

## 四、翻页状态机：cover → run → settle

翻页最容易翻车的，不是 `rotateY(-180deg)`，而是**动画结束那一帧**：底层切图、翻页层卸掉、透视差、阴影叠加叠在一起，就会闪、跳、糊。

PhotoAlbum 把一次翻页拆成三阶段：

| 阶段       | 作用                                                    |
| -------- | ----------------------------------------------------- |
| `cover`  | 先盖上翻页层，底层仍保持翻页前画面                                     |
| `run`    | 双 rAF 后再开 CSS 动画，露出目标页；过半 `underlaySynced`            |
| `settle` | JS 把翻页叶写成 `translateZ(0)` 贴平，再 `visibility:hidden` 卸层 |

```ts
type TurnPhase = 'cover' | 'run' | 'settle';

interface TurnState {
  direction: TurnDirection;
  fromIndex: number;   // 整段动画锁定，避免中途状态错乱
  targetIndex: number;
  phase: TurnPhase;
  underlaySynced?: boolean; // 过半后提前切底层终态
}
```

### 4.1 为什么要 cover？

如果 `setTurn` 的同一帧就同时：

1.  底层切到目标图
2.  翻页层从 0° 开始转

首帧很容易露馅：目标页已经闪一下，或者翻页叶还没画完底层已经变了。

做法是：**先只盖层、底层不动**；下一帧（实际用了两层 `requestAnimationFrame`）再把 phase 切到 `run`，让浏览器先完成布局/绘制，再开动画。

### 4.2 为什么要 underlaySynced？

动画过半（约 `duration * 0.52`）时，落点侧已被翻页叶盖住。此时提前把底层同步到终态并画完——结束卸层时，去掉的只是「已经贴平、内容与底层一致」的重复页，而不是「换图 + 拆层」叠在同一帧。

### 4.3 为什么 settle 不用 opacity 淡出？

注释里写得很直白：两层明暗不同，淡出只会拉长闪烁。正确顺序是：

1.  去掉动画，把 transform 写成带 `translateZ(0)` 的终态（透视差是中缝「跳动」的主因）
2.  底层已是终态，再画一帧
3.  `visibility: hidden` 后再卸 React 节点

```ts
const flatTransform =
  active.direction === 'next'
    ? 'translateZ(0) rotateY(-180deg)'
    : 'translateZ(0) rotateY(0deg)';
sheet.style.animation = 'none';
sheet.style.transform = flatTransform;
// …再 rAF → visibility:hidden → setTurn(null)
```

![image.png](https://jiaxiantao.github.io/blogs/images/cos-design-photo-album/04.webp)

***

## 五、CSS 3D：绕书脊翻转 + backface

翻页叶锚定在右半边，`transform-origin: left center`，绕书脊翻转：

```css
.turningPage {
  left: 50%;
  transform-origin: left center;
  transform-style: preserve-3d;
}

@keyframes turnNext {
  from { transform: translateZ(2px) rotateY(0deg); }
  to   { transform: translateZ(0) rotateY(-180deg); }
}
```

正反面用 `backface-visibility: hidden`，背面预先 `rotateY(180deg)`。有个容易踩的坑：

> 父级 `preserve-3d` 时，直接在 3D 变换节点上写 `overflow` + `border-radius` 会被忽略。

所以拆成 **`face`（只负责朝向）+ `faceSheet`（圆角裁切与纸面样式）**。背面落到左页时，再把圆角改成与 `leftPage` 一致，卸层时边缘才接得上。

整本书还有俯视倾角：

```css
--book-tilt: rotateX(18deg) rotateY(-6deg);
perspective: 1400px;
```

封面、纸叠厚度、中缝谷影、桌面投影叠在一起，才像桌上摊开的实体相册，而不是悬浮的两张卡片。

![image.png](https://jiaxiantao.github.io/blogs/images/cos-design-photo-album/05.webp)

***

## 六、铁圈与打孔：前后半圈 + 自适应个数

铁圈视觉上「穿过」中缝孔洞，实现上是：

*   **后半圈** `clip-path: inset(48% 0 0 0)`，沉在纸后
*   **前半圈** `clip-path: inset(0 0 48% 0)`，拱形压在纸面
*   孔洞与圈心共用 `ringSlotTop(index, count)`，保证对齐

圈数不写死：用 `ResizeObserver` 读相册实际高度，按约 32px 间距在 4～28 之间取整——矮相册不会挤成一排，高相册也不会太空。

中缝谷影 `bookGutter` 放在 `book` 外、透明度恒定，**不跟翻页 class 挂动画**。否则卸层时 animation 被摘掉，中缝会突然「跳」一下。

***

## 七、飞页、相纸与工程细节

### 7.1 开场 / 收束飞页

没有对应 `photos[i]` 时渲染装饰飞页：四角线框、几何纹样 SVG、主副标题。文案全部走 `labels`，方便中英文与品牌定制。

### 7.2 相纸「贴」在页上

照片不在整页铺满，而是放进略歪的 `photoMount`（左右页分别 `±0.35deg`），底下留手写风 caption 与页码。观感更像相册贴片，而不是浏览器里的 `<img>` 列表。

### 7.3 图片预热

翻页首帧最怕等解码。对当前索引 ±2 范围调用 `Image` + `decode()`，并缓存已预热 URL：

```ts
const warmPhoto = (src?: string) => {
  if (!src || warmedPhotos.has(src)) return;
  warmedPhotos.add(src);
  const image = new Image();
  image.src = src;
  image.decode?.().catch(() => {});
};
```

### 7.4 无障碍与减动效

*   根节点 `role="region"` + `tabIndex={0}`，方向键 / Enter / Space 翻页
*   左右半屏透明 `button`，带 `aria-label`
*   `prefers-reduced-motion: reduce` 时把翻页动画压到 `1ms`

***

## 八、Props：少而够用

```ts
export interface PhotoAlbumProps {
  photos: PhotoAlbumItem[];
  width?: number | string;       // 默认 920
  height?: number | string;      // 默认 560
  initialIndex?: number;         // 初始右页索引
  pageTurnDuration?: number;     // 默认 760ms
  objectFit?: CSSProperties['objectFit'];
  showPageNumber?: boolean;
  pageColor?: string;            // 相纸色，默认 '#f2ead8'
  coverColor?: string;           // 封皮色，默认 '#4a3025'
  ariaLabel?: string;
  labels?: PhotoAlbumLabels;     // 按钮 / 飞页文案
  onPageChange?: (index: number, photo: PhotoAlbumItem) => void;
  className?: string;
  style?: CSSProperties;
}
```

```ts
export interface PhotoAlbumItem {
  src: string;
  alt?: string;
  title?: string;
  description?: string;
}
```

调气质时优先动 `pageColor` / `coverColor` / `labels`；交互手感动 `pageTurnDuration`。

![image.png](https://jiaxiantao.github.io/blogs/images/cos-design-photo-album/06.webp)

![image.png](https://jiaxiantao.github.io/blogs/images/cos-design-photo-album/07.webp)

***

## 九、五分钟接入

### 9.1 安装

```bash
# 只要相册
pnpm add @cos-design/photo-album

# 或装全量包
pnpm add cos-design
```

### 9.2 最小示例

```tsx
import { PhotoAlbum } from '@cos-design/photo-album';

const photos = [
  {
    src: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85',
    title: '在路上',
    description: '把远方装进相册',
    alt: '在路上'
  },
  {
    src: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=85',
    title: '山谷晨光',
    description: '风从群山之间吹来',
    alt: '山谷晨光'
  }
  // …建议偶数张，翻页叶正反面成对更自然
];

export function TravelAlbum() {
  return (
    <PhotoAlbum
      photos={photos}
      width={780}
      height={475}
      pageTurnDuration={760}
      pageColor="#f2ead8"
      coverColor="#4a3025"
      ariaLabel="旅行照片相册"
      labels={{
        previous: '上一张照片',
        next: '下一张照片',
        empty: '暂无照片',
        flyleafTitle: '旅行相册',
        flyleafSubtitle: '把远方装进这一页',
        flyleafEndTitle: '完',
        flyleafEndSubtitle: '故事暂告一段落'
      }}
      onPageChange={(index, photo) => {
        console.log('当前焦点', index, photo.title);
      }}
    />
  );
}
```

### 9.3 Next.js

依赖浏览器布局与动画，SSR 请关掉：

```tsx
import dynamic from 'next/dynamic';

const PhotoAlbum = dynamic(
  () => import('@cos-design/photo-album').then((m) => m.PhotoAlbum),
  { ssr: false }
);
```

### 9.4 适合放哪里？

*   旅行 / 婚礼 / 纪念日回顾页
*   个人作品集、品牌故事的「实体相册」段落
*   活动页里需要停留感、仪式感的图集（不是扫一眼的商品轮播）
*   需要键盘可操作、文案可 i18n 的展示组件

不太适合：强电商比价列表、必须毫秒级切图的缩略图墙、或完全不允许动效的后台。

***

## 十、和轮播、其他 cos-design 组件怎么选？

| 需求               | 更合适的选择                               |
| ---------------- | ------------------------------------ |
| 快速扫图、指示点、自动播     | 普通 Carousel / Swiper                 |
| 要「翻实体书」的仪式感      | **PhotoAlbum**                       |
| 背景氛围（水 / 雾 / 气泡） | RippleWater / SmokeFog / BubbleField |
| 点击微交互装饰          | ClickSpark / CursorTrail 等           |

PhotoAlbum 吃的是**注意力停留**，不是信息密度。图集叙事清楚、张数可控（Demo 用 10 张左右）时，体验收益最大。

***

## 结语

PhotoAlbum 想证明的不是「CSS 也能 `rotateY`」，而是：

1.  **一叶两面的索引模型**：翻的是纸，不是单图；
2.  **cover → run → settle 状态机**：把卸层闪烁当成一等公民问题来解；
3.  **过半同步底层 + visibility 卸层**：中缝不跳、不靠淡出糊弄；
4.  **铁圈在 3D 书页外用 z-index 夹住**：装订感在，穿模风险可控；
5.  **预热、减动效、键盘与 labels**：能进真实页面，而不只是 Demo。

如果你正在做旅行回顾或故事型 Landing，打开 Playground 翻两页比看文档更快：

<https://jiaxiantao.xyz/cos-design/#/photoAlbum>

```bash
pnpm add @cos-design/photo-album
```

欢迎 Issue / PR，一起把「交互玩具」做得更完整。

***

## 系列延伸阅读

*   [cos-design BubbleField：用 Canvas 做一个「会呼吸」的深海气泡场](https://jiaxiantao.github.io/blogs/post/ef624d3ba560423b)
*   [cos-design RippleWater & SmokeFog：水面涟漪与烟雾雾气怎么做](https://jiaxiantao.github.io/blogs/post/2ef3989533f7403d)
*   [cos-design WeatherBackground：用 Canvas 做一个「会变天」的背景引擎](https://jiaxiantao.github.io/blogs/post/acbc4062c27249f5)
*   [cos-design v3.0：从 15 个 Demo 到 49 个组件的视觉特效库](https://jiaxiantao.github.io/blogs/post/d156efd617754cf1)

***

## 参考

| 资源         | 链接                                                      |
| ---------- | ------------------------------------------------------- |
| Playground | <https://jiaxiantao.xyz/cos-design/#/photoAlbum>        |
| GitHub     | <https://github.com/jiaxiantao/cos-design>              |
| npm 全量包    | <https://www.npmjs.com/package/cos-design>              |
| npm 子包     | <https://www.npmjs.com/package/@cos-design/photo-album> |
| CSS 3D     | `perspective` / `preserve-3d` / `backface-visibility`   |

***
