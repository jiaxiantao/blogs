<!-- post-id: 10124a35b4374458 -->

# cos-design 图片预览系列：13 种物件隐喻，把图集做成可触摸的故事

> 发布日期：2026-08-03\
> 标签：前端 / React / 组件库 / cos-design / 图片预览 / 交互设计 / 视觉特效

活动页、旅行回顾、婚礼邀请、品牌故事——到处都要「看图」。默认答案往往是 Swiper：左右滑、指示点、自动播。能用，也无聊。用户记住的不是第几张图，而是有没有「翻过一本相册、甩过一根晾绳、转过一只走马灯」的手感。

[cos-design](https://github.com/jiaxiantao/cos-design) 从 **v3.7.1** 起陆续补齐 **图片预览** 分类，到 **v3.7.3** 已有 **13 个**独立组件：统一 `photos` 数据模型，各自对应一种真实物件隐喻。本文专门推广这一系列——讲清适合什么场景、怎么选型、怎么五分钟装上，方便你直接用进项目。

**Playground 分类入口**：<https://jiaxiantao.xyz/cos-design/#/>（侧栏选「图片预览」）\
**仓库**：[github.com/jiaxiantao/cos-design](https://github.com/jiaxiantao/cos-design)\
**全量包**：`cos-design@3.7.3`\
**独立包**：`@cos-design/photo-*`（按需安装，见下文）

***

## 效果速览

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/0cdc06383405497689f88c13937ebaa3~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786350137&x-orig-sign=J%2F6bnOh2wVB6AJ9NIFmEsDDwz3c%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/a57d85d6231e478780185cc5e79a5b58~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786350137&x-orig-sign=%2F1NiX5vPVGvACRd1ZRu05EOUGfw%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/e9c32509f4404916844754e2527cebac~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786350137&x-orig-sign=CalZ3%2FjAMBmj%2FqrpIZQHrcVnwA0%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/24d418cbcb7f4955a90f7993825d7342~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786350137&x-orig-sign=u0iPX4Pv3tA3rgHo0ViGBF1q8qs%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/8f483dbf967e43f88ab253a6bd6aed94~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786350137&x-orig-sign=vogwFMiUE4eUZxKytv6oT85WLe4%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/b55a0ac6f18c42dc83945db212303660~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786350137&x-orig-sign=%2B8kW93FTbWl4B6kRV%2BGT2AGG8Uo%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/0976c6f81a754c799eafa2d63f612653~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786350137&x-orig-sign=HE%2Fh6fRHHSfsDJX%2FGz7mkTuac7k%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/eb3ef1cb755743b28e5d23df25c1de81~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786350137&x-orig-sign=w85TqsbAwPCRfwaTYiQSAClXEe8%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/ae6b6a5486b44b2c8e37faca5ae2f5d0~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786350137&x-orig-sign=YMgsLC1JcFTKZnBVzkqMfwxBZuI%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/42cfc73885ee4f078f7c391f2fa5990c~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786350137&x-orig-sign=vQ1QWvJzpFSPKn64aMZTvkmAO6c%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/10a87bfc8bda44fbb42364a92b983020~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786350137&x-orig-sign=rE64PWRZyKtSrqlBO%2F6LXSJOxOo%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/02196a2a0f754ca3af66f4ea5689dc49~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786350137&x-orig-sign=tqMC7zWGlml8o2otfshAjpnDpAU%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/1e5ef203f1d6483dae6f4545457c4940~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786350137&x-orig-sign=aadZjL1C8mcz797qjcYVG0ReIFk%3D)

***

## 一、为什么单独做「图片预览」分类？

常见图集方案解决的是**信息浏览**：切得快、占得少、指标好。营销与故事页要的往往是**注意力停留**：

| 维度   | 普通轮播  | cos-design 图片预览                   |
| ---- | ----- | --------------------------------- |
| 交互隐喻 | 抽象滑块  | 相册、晾绳、胶卷、冰箱……                     |
| 记忆点  | 弱     | 强（「那个能翻的相册」）                      |
| 依赖   | 通常很轻  | 多数 CSS/Canvas；走马灯为 Three.js       |
| 安装方式 | 一个大组件 | **全量或单包**，按场景选型                   |
| 数据   | 各家不一  | 统一 `photos: { src, title?, … }[]` |

一句话：

> **不是再做一个 Swiper，而是把「看图」还原成桌面上的物件。**

***

## 二、13 个组件一览

| 组件                 | 中文名    | 一句话                     | Playground                                                                 |
| ------------------ | ------ | ----------------------- | -------------------------------------------------------------------------- |
| `PhotoAlbum`       | 真实翻页相册 | 摊开式 3D 相册，一叶两面真翻页       | [#/photoAlbum](https://jiaxiantao.xyz/cos-design/#/photoAlbum)             |
| `PhotoLantern`     | 走马灯    | Three.js 六面灯体，拖拽惯性 + 内光 | [#/photoLantern](https://jiaxiantao.xyz/cos-design/#/photoLantern)         |
| `PhotoClothesline` | 晾绳照片墙  | 吊带可甩弯，松手摆回，空白处横拖浏览      | [#/photoClothesline](https://jiaxiantao.xyz/cos-design/#/photoClothesline) |
| `PhotoFilmstrip`   | 胶卷条    | 齿孔帧号齐全，惯性卷动后吸附整帧        | [#/photoFilmstrip](https://jiaxiantao.xyz/cos-design/#/photoFilmstrip)     |
| `PhotoPolaroid`    | 拍立得堆   | 桌面散落翻找，拖放留位             | [#/photoPolaroid](https://jiaxiantao.xyz/cos-design/#/photoPolaroid)       |
| `PhotoLightbox`    | 灯箱透片   | 透光幻灯片，拖出切换 / 未过阈值弹回     | [#/photoLightbox](https://jiaxiantao.xyz/cos-design/#/photoLightbox)       |
| `PhotoCarousel`    | 旋转木马托盘 | 照片立在圆盘边缘环绕              | [#/photoCarousel](https://jiaxiantao.xyz/cos-design/#/photoCarousel)       |
| `PhotoPrism`       | 棱镜立方   | CSS 3D 六面贴图翻滚           | [#/photoPrism](https://jiaxiantao.xyz/cos-design/#/photoPrism)             |
| `PhotoScroll`      | 卷轴照片   | 中式手卷，木轴 + 宣纸横拖吸附        | [#/photoScroll](https://jiaxiantao.xyz/cos-design/#/photoScroll)           |
| `PhotoPostcard`    | 旅行明信片  | 正反翻转 + 邮戳，横拖换下一张        | [#/photoPostcard](https://jiaxiantao.xyz/cos-design/#/photoPostcard)       |
| `PhotoViewMaster`  | 观景器圆盘  | View-Master 风格转盘切景      | [#/photoViewMaster](https://jiaxiantao.xyz/cos-design/#/photoViewMaster)   |
| `PhotoFridge`      | 冰箱磁贴墙  | 磁贴拖放置顶，吸住不回弹            | [#/photoFridge](https://jiaxiantao.xyz/cos-design/#/photoFridge)           |
| `PhotoTunnel`      | 纵深隧道   | Z 轴穿行，近清远虚，吸附整帧         | [#/photoTunnel](https://jiaxiantao.xyz/cos-design/#/photoTunnel)           |

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/caecdbcb8e36467bad7f556d0c2e5519~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786350137&x-orig-sign=POgFRXC0ygCz13%2FxfSLqW3WwEAQ%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/2e443611b8aa42a594395ba1311d49eb~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786350137&x-orig-sign=n8SuBtliBtBbaXCQNMAD6SmCa5s%3D)

![image.png](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/14ddac617ea841a4980796626a82c4d5~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg54mn6Im6:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiMzk1ODY3MjgyMzY4Nzg4MCJ9&rk3s=f64ab15b&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018&x-orig-expires=1786350137&x-orig-sign=ixz1vWghLJmvmyHB%2FAH4K3%2BHE%2FM%3D)

***

## 三、按场景选型（比按技术选型更快）

不必先纠结 CSS 还是 Three.js，先问**页面想给人什么物件感**：

| 你想表达的气质         | 优先试试                                                     |
| --------------- | -------------------------------------------------------- |
| 仪式感、慢慢翻、故事有开场收束 | **PhotoAlbum**                                           |
| 国风、文博、手账、长卷叙事   | **PhotoScroll**                                          |
| 旅行寄语、正反两面文案     | **PhotoPostcard**                                        |
| 复古胶片、电影感帧序列     | **PhotoFilmstrip**                                       |
| 轻松家居、可乱摆的生活感    | **PhotoPolaroid** / **PhotoFridge**                      |
| 户外晾晒、可「玩一下」的互动墙 | **PhotoClothesline**                                     |
| 科技展台、立体灯体、夜间氛围  | **PhotoLantern** / **PhotoLightbox**                     |
| 玩具感、圆形陈列、展柜托盘   | **PhotoCarousel** / **PhotoViewMaster** / **PhotoPrism** |
| 沉浸穿行、品牌大片序章     | **PhotoTunnel**                                          |

经验法则：

*   **张数少、要讲故事** → Album / Postcard / Scroll
*   **张数中等、要「翻找」** → Polaroid / Fridge / Clothesline
*   **张数固定六面左右、要立体** → Lantern / Prism
*   **要纵深冲击** → Tunnel
*   **要横条扫描感** → Filmstrip

***

## 四、统一心智：一套 photos，多种外壳

系列刻意对齐数据形状，换组件几乎只改 import：

```ts
type PhotoItem = {
  src: string;
  alt?: string;
  title?: string;
  description?: string;
};
```

```tsx
import { PhotoAlbum, PhotoFilmstrip, PhotoFridge } from 'cos-design';

const photos = [
  { src: '/shots/01.jpg', title: '在路上', description: '把远方装进相册' },
  { src: '/shots/02.jpg', title: '山谷晨光', description: '风从群山之间吹来' }
  // …
];

// 同一份数据，三种「物件」
<PhotoAlbum photos={photos} width={780} height={475} />
<PhotoFilmstrip photos={photos} height={280} showCaption />
<PhotoFridge photos={photos} height={420} />
```

工程上每个组件都是独立 npm 包，Playground / AI 文档里写明了 `pnpm add @cos-design/photo-xxx`——全量引入和按需引入都支持。

***

## 五、五个最容易「一眼种草」的组件

篇幅有限，下面只展开推广向介绍；完整 Props 以 Playground 与 [docs/ai.md](https://github.com/jiaxiantao/cos-design/blob/main/docs/ai.md) 为准。

### 5.1 PhotoAlbum — 真的能翻的相册

摊开左右页，点右半边往后翻、点左半边往回翻；铁圈、书脊谷影、飞页开场/收束都在。适合婚礼、旅行终章、品牌年鉴。

```bash
pnpm add @cos-design/photo-album
```

深度实现可另见：[CSS 3D 真实翻页相册技术实现](https://jiaxiantao.github.io/blogs/post/29f31a0c5fc3461f)。

### 5.2 PhotoClothesline — 能甩的晾绳

照片挂在麻绳上，抓住任意一张往外甩，吊带跟着弯；松手像吊牌一样摆回。空白处左右拖看更多。互动本身就是内容。

```bash
pnpm add @cos-design/photo-clothesline
```

### 5.3 PhotoLantern — 六面走马灯

真实感灯体 + 内光摆动，空闲自转，拖拽跟手带惯性。适合夜场、展会、产品六面叙事（建议准备约 6 张主视觉）。

```bash
pnpm add @cos-design/photo-lantern
```

### 5.4 PhotoFilmstrip — 胶卷条

齿孔、帧号、横向卷动、松手吸附整帧。电影感活动页、摄影作品集横条预览很贴。

```bash
pnpm add @cos-design/photo-filmstrip
```

### 5.5 PhotoTunnel — 纵深隧道

沿 Z 轴叠帧，上下拖拽穿行，近清远虚。首屏「走进故事」的开场很有冲击力。

```bash
pnpm add @cos-design/photo-tunnel
```

***

## 六、五分钟接入

### 6.1 装全量（试玩最快）

```bash
pnpm add cos-design
```

```tsx
import { PhotoPostcard } from 'cos-design';

export function TravelPostcards() {
  return (
    <PhotoPostcard
      photos={[
        {
          src: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=85',
          title: '在路上',
          description: '把远方装进明信片'
        },
        {
          src: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=85',
          title: '山谷晨光',
          description: '风从群山之间吹来'
        }
      ]}
      ariaLabel="旅行明信片"
    />
  );
}
```

### 6.2 只装一个（上线更干净）

```bash
pnpm add @cos-design/photo-fridge
```

```tsx
import { PhotoFridge } from '@cos-design/photo-fridge';

<PhotoFridge photos={photos} height={420} ariaLabel="冰箱磁贴墙" />
```

### 6.3 Next.js

浏览器交互为主，SSR 建议动态关闭：

```tsx
import dynamic from 'next/dynamic';

const PhotoAlbum = dynamic(
  () => import('@cos-design/photo-album').then((m) => m.PhotoAlbum),
  { ssr: false }
);
```

`PhotoLantern` 依赖 Three.js，同样按需动态导入即可。

***

## 七、适合 / 不太适合

**适合**

*   活动页、Landing、邀请函中的「图集段落」
*   个人站旅行 / 婚礼 / 作品叙事
*   需要停留与分享欲，而不是 SKU 扫货
*   设计稿本身就有物件隐喻（相册、明信片、胶卷……）

**不太适合**

*   电商详情里要毫秒级切 50+ 缩略图
*   后台表格旁的附件预览
*   强指标驱动的信息流（这时轮播仍然更合适）

把系列当成**叙事层组件**，和 Swiper **并存**：列表用轮播，高潮段落换成物件隐喻——页面立刻有层次。

***

## 八、和 cos-design 其他分类怎么搭？

| 需求          | 搭配                                    |
| ----------- | ------------------------------------- |
| 图集底下要氛围     | `Aurora` / `SmokeFog` / `BubbleField` |
| 标题要跟照片一起「活」 | 文字动效分类（`SplitText`、`ShinyText` 等）     |
| 中奖 / 完结庆祝   | `Confetti` / `Fireworks`              |
| 只要一张可翻的故事书  | 单用 `PhotoAlbum` 即可                    |

图片预览负责「物件」，背景与文字负责「情绪」——拼在一起才是完整活动页。

***

## 结语

v3.7.x 的图片预览系列想回答的是：

> **看图，能不能也像摸到真实东西一样？**

13 个组件、统一数据、可分包发布——你不必自己从零抠 CSS 3D 或 Three.js 灯体，打开 Playground 拖两下，选一个最贴场景的隐喻装上就行。

```bash
pnpm add cos-design
# 或
pnpm add @cos-design/photo-album @cos-design/photo-clothesline
```

在线试玩：<https://jiaxiantao.xyz/cos-design/#/>\
欢迎 Star / Issue / PR，也欢迎在评论区说说你最想用在哪个页面。

***

## 系列延伸阅读

*   [cos-design PhotoAlbum：用 CSS 3D 做一个「能翻页」的实体相册](https://jiaxiantao.github.io/blogs/post/29f31a0c5fc3461f)
*   [cos-design BubbleField：用 Canvas 做一个「会呼吸」的深海气泡场](https://jiaxiantao.github.io/blogs/post/ef624d3ba560423b)
*   [cos-design v3.0：从 15 个 Demo 到 49 个组件的视觉特效库](https://jiaxiantao.github.io/blogs/post/d156efd617754cf1)
*   [从视觉 Demo 到可发布组件库的完整实践](https://jiaxiantao.github.io/blogs/post/6a317416652c4876)

***

## 参考

| 资源         | 链接                                                              |
| ---------- | --------------------------------------------------------------- |
| Playground | <https://jiaxiantao.xyz/cos-design/>                            |
| GitHub     | <https://github.com/jiaxiantao/cos-design>                      |
| npm 全量包    | <https://www.npmjs.com/package/cos-design>                      |
| 组件 AI 文档   | <https://github.com/jiaxiantao/cos-design/blob/main/docs/ai.md> |

***
