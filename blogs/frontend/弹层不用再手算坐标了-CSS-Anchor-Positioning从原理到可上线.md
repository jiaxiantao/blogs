<!-- post-id: c4a91e7b2d08f653 -->

# 弹层不用再手算坐标了：CSS Anchor Positioning 从原理到可上线

> 发布日期：2026-11-12  
> 标签：前端 / CSS / Anchor Positioning / Popover / 工程实践

## 一、开篇：坐标算子还在主线程里跑

表格最后一行的「更多」按钮，一点，菜单从按钮下方弹出来，紧接着被视口底边切掉一半。你于是写一段 `getBoundingClientRect`，减一下滚动偏移，再决定翻到按钮上方。滚动容器一多，这段代码就开始长毛：`resize` 要听，`scroll` 要听，父级 `transform` 会把 `fixed` 变成局部坐标系，虚拟列表一回收，按钮节点换了，监听还挂在旧节点上。

这不是某个库没写好。只要弹层和锚点是两棵子树，**「锚点在哪、弹层该去哪、边上去了怎么翻」就是一套布局问题**。过去十年，前端用 JavaScript 把这套布局问题补完了：Popper、Floating UI、各种内部的 `usePopper`。它们可靠，也贵——每次滚动都在主线程上重算，每个设计系统都要再包一层，箭头、翻转、碰撞、隐藏条件全是中间件。

2026 年 1 月 13 日，CSS Anchor Positioning 成为 **Baseline Newly Available**：Chrome / Edge 125 起、Safari 26 起、Firefox 147 起，三家引擎都有了同一套能力。`position-area`、`position-try-fallbacks` 也在这一天对齐。弹层定位第一次可以写成样式，而不是写成一帧一帧的测量。

这篇文章不搬运规范。只回答四件事：它到底在替你算什么、和 Popover API 怎么接、列表和滚动里会踩哪些坑、什么时候仍然该把 Floating UI 留在依赖里。

先看一张选型表。今天是 2026 年 11 月，Baseline 已经落地十个月，但厂内浏览器基线未必跟上。

| 方案 | 谁在算位置 | 滚动时的成本 | 翻转 / 防溢出 | 适合 |
|------|------------|--------------|----------------|------|
| 手写 `getBoundingClientRect` | 主线程 | 每个滚动容器都要自己听 | 自己写 | 一次性脚本 |
| Floating UI / Popper | 主线程 | `autoUpdate` 持续测量 | 中间件很全 | 虚拟参照、复杂箭头、旧浏览器 |
| **CSS Anchor Positioning** | **浏览器布局** | **跟着锚点一起重排** | **`position-try-fallbacks`** | **按钮、菜单、Tooltip、跟随 DOM 的标签** |

结论直接一点：**锚点是一个真实 DOM 盒，浏览器又在 Baseline 之内，就让 CSS 来定位。** 锚点是光标、选区、Canvas 里的投影点，或者你必须兼容 2025 年以前的 Chrome，再把测量交回 JavaScript。

***

## 二、原理：浏览器要的只有「锚」和「被锚的那个」

### 2.1 两个名字，一次布局

Anchor Positioning 把参与者拆成两个角色。

锚点用 `anchor-name` 给自己起一个虚线标识。被定位的元素用 `position-anchor` 指向这个名字，并且自己必须是绝对定位或固定定位。然后你不再写 `top` / `left` 的魔法数，而是告诉浏览器：我要贴在锚点的哪一条边上。

```css
.more-btn {
  anchor-name: --more;
}

.menu {
  position: absolute;
  position-anchor: --more;
  position-area: block-end center;
  margin: 8px 0 0 0;
}
```

`position-area` 把锚点想成九宫格的中心格。`block-end center` 就是「排在锚点块轴末尾、行轴居中」——横排文档里，这就是按钮正下方、水平居中。以前叫 `inset-area`，Chromium 过渡期两个名字都认，新代码只写 `position-area`。

也可以不用九宫格，改用 `anchor()` 函数把某条边拴死：

```css
.menu {
  position: absolute;
  position-anchor: --more;
  top: anchor(bottom);
  left: anchor(left);
  margin-top: 8px;
}
```

`anchor(bottom)` 的意思是：我的 `top` 对齐锚点的底边。九宫格够用就用 `position-area`，它短，也和后面的翻转关键字是一套语言。只有要「左边对齐、宽度跟锚点走」这种细控，才落到 `anchor()` 和 `anchor-size()`。

这里有一条必须写进团队规范的事实：**永远显式写 `position-anchor`。** 三家引擎曾经把这个属性的初始值做成 `implicit`、`auto`、`none`，互相还不一样。Chrome 直到 151 才把初始值收成规范里的 `normal`。名字写在声明里，这段历史就与你无关。

### 2.2 放不下时，浏览器替你试下一格

按钮贴近视口底边时，菜单不该被切掉。`position-try-fallbacks` 给出一组备选位置。默认位置放不下，浏览器按顺序试，用第一个不再溢出「inset 修改后的包含块」的方案。全都放不下，就退回你写的默认位置。

```css
.menu {
  position-area: block-end center;
  margin: 8px 0 0 0;
  position-try-fallbacks: flip-block;
}
```

`flip-block` 沿块轴镜像：下面放不下就翻到上面，外边距跟着镜像，所以 `margin-top: 8px` 翻上去之后会变成底部那 8 像素的间距，你不用再写一份「上方专用 margin」。`flip-inline` 沿行轴镜像。两个关键字用空格连在一起，表示同一次尝试里同时翻两轴；用逗号隔开，表示两次独立尝试。

备选位置也可以写成九宫格，或者写成具名的 `@position-try`：

```css
@position-try --above {
  position-area: block-start center;
  margin: 0 0 8px 0;
}

.menu {
  position-area: block-end center;
  margin: 8px 0 0 0;
  position-try-fallbacks: --above;
}
```

`@position-try` 不是一套完整的样式表。规范只让它改六类声明：inset、margin、尺寸、自对齐、`position-anchor`、`position-area`。它能把盒子挪走、缩小，**不能**在翻转时改颜色、换文案、改 `content`。Tooltip 的小箭头如果要「在下面时指上、在上面时指下」，不能指望这一条规则顺手改掉伪元素。箭头要么接受始终朝向锚点中心（用 `anchor-center` 对齐），要么在备选位置里改尺寸和 inset，用两个伪元素的裁切去模拟，那已经是装饰层的事，不要塞进定位层。

### 2.3 它为什么比测量便宜

JavaScript 方案的循环是：布局完成 → 读几何 → 写 `top`/`left` → 可能再触发布局。滚动和缩放都要把这个循环再跑一遍，所以 Floating UI 才需要 `autoUpdate`。

Anchor Positioning 发生在布局阶段内部。锚点的盒一变，依赖它的定位元素在同一次布局里就更新了。你没有读几何，也就没有强制同步布局的机会。滚动容器里的按钮移动时，菜单跟着走，不需要你挂 `scroll` 监听。

代价也明确：浏览器只会在「放不下」时翻面，它不会帮你做 Floating UI 那种「尽量留在视口里、同时不要盖住选区、同时箭头要指向第 3 个字」的业务策略。策略复杂，就还是中间件。

***

## 三、一个能上线的 Tooltip

下面这段是悬停和键盘焦点都能用的提示，不依赖弹出层属性。锚点是按钮，提示是紧跟其后的兄弟节点。

```html
<span class="tip-host">
  <button type="button" class="tip-anchor">保存草稿</button>
  <span class="tip" role="tooltip">已写入本地，可稍后发布</span>
</span>
```

```css
.tip-anchor {
  anchor-name: --tip;
}

.tip {
  position: absolute;
  inset: auto;
  margin: 0 0 8px 0;
  width: max-content;
  max-width: 240px;
  padding: 6px 8px;
  border-radius: 6px;
  background: #1f2329;
  color: #fff;
  font-size: 12px;
  line-height: 1.5;

  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms linear;
}

.tip-host:hover .tip,
.tip-host:focus-within .tip {
  opacity: 1;
}

@supports (anchor-name: --tip) and (position-area: top) {
  .tip {
    position-anchor: --tip;
    position-area: block-start center;
    position-try-fallbacks: flip-block;
    position-visibility: anchors-visible;
  }
}
```

几条实现约束，写进注释里比写进回忆里有用：

1. **降级位置写在 `@supports` 外面。** 不支持的浏览器会得到 `position: absolute` 加上你另外准备的静态偏移（比如相对 `.tip-host` 的 `bottom: calc(100% + 8px)`）。支持的浏览器再把 inset 交还给 `position-area`。只测 `anchor-name` 不够：Chrome 125 就认识它，但 `position-area` 要到 129，`position-try-fallbacks` 要到 128。三个能力你都用了，就把三个都放进条件。实践里测 `anchor-name` 加 `position-area` 已经能挡住那些「半支持」的 Chromium。
2. **`position-visibility: anchors-visible`。** 锚点滚出可视区域后，提示不应该漂在视口里指向空气。这个值就是干这件事的。Safari 26.2 和 Firefox 147 才和 Chrome 对齐，更早的 Safari 26 会忽略它，表现是提示还在，不会是布局崩掉。
3. **提示节点放在锚点后面。** 规范要求：在同一个包含块里，锚点必须先于被定位元素完成布局。源码顺序写成「先按钮、后提示」，这条就满足了。把提示 portals 到 `document.body` 末尾也可以，只要锚点在文档顺序上更早。
4. **不要用 `display: none` 切换。** 锚点或提示被 `display: none` 拿掉后，锚点关系直接失效，定位会退回最近的定位祖先。显隐用 `opacity`、`visibility` 或弹出层的 top layer，不要把盒子从格式化结构里摘掉。

***

## 四、和 Popover API 接上：点击菜单

悬停提示用兄弟节点就够。点击菜单要的是：顶层、点外面关闭、焦点回到按钮。这些是 Popover API 的工作，不是 Anchor Positioning 的工作。两个 API 叠在一起，才是设计系统里「更多」菜单的形态。

```html
<button
  type="button"
  class="more-btn"
  popovertarget="row-menu"
  style="anchor-name: --row-menu"
>
  更多
</button>
<div id="row-menu" popover class="menu">
  <button type="button">复制链接</button>
  <button type="button">移入回收站</button>
</div>
```

```css
.menu {
  position: fixed;
  inset: unset;
  margin: 8px 0 0 0;
  width: max-content;
  min-width: 160px;
  padding: 4px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;

  position-anchor: --row-menu;
  position-area: block-end span-inline-end;
  position-try-fallbacks: flip-block, flip-inline;
  position-visibility: anchors-visible;
}
```

Popover 的 UA 样式默认是「铺满视口再 `margin: auto` 居中」。你不把 `inset` 和 `margin` 重置掉，`position-area` 会被这套居中抵消，菜单停在屏幕中央，看起来像锚点没生效。`inset: unset` 再按需补一条间距，是接 Popover 的第一行代码。

`popovertarget` 还会给弹出层一个**隐式锚点**，就是那个按钮。隐式锚点要用 `position-anchor: auto` 才会被用上。上面的例子故意没走隐式锚点，而是写了 `--row-menu`。原因很具体：一行表格里如果有「更多」和「分享」两个按钮，隐式锚点会随着最后一次打开的按钮变，读样式的人看不出当前菜单到底跟谁。名字写在按钮上，关系就在 HTML 里，代码评审看得懂。

`position-area: block-end span-inline-end` 把菜单放在按钮下方，并且沿行轴末尾一侧展开。对右对齐的操作列，这比水平居中更不容易撞到表格右边界。`flip-block, flip-inline` 是两次尝试：先试上下对调，还溢出再试左右对调。

***

## 五、列表里同名锚点会互相覆盖

组件写成这样很自然：

```css
.row-action { anchor-name: --row-menu; }
.row-menu { position-anchor: --row-menu; }
```

一百行表格渲染出来之后，页面上有一百个 `--row-menu`。规范的冲突解决是：**同名锚点，被定位元素绑到树序里的最后一个。** 于是每一行的菜单都去找最后一行的按钮。这个 bug 在第一屏看不出来，滚动到底才会发现。

解法是 `anchor-scope`，把名字的可见性收进组件子树：

```css
.row {
  anchor-scope: --row-menu;
}

.row .row-action {
  anchor-name: --row-menu;
}

.row .row-menu {
  position-anchor: --row-menu;
}
```

每一行成为一个作用域，行内的 `--row-menu` 不再泄漏到下一行。这和 Shadow DOM 的封装是两件事：`anchor-scope` 限制的是**同一个文档树里的名字查找**。锚点名字本身仍然穿不过 Shadow 边界。Web Component 如果把按钮和菜单分在两个 shadow root 里，外面的菜单看不见里面的 `anchor-name`。组件库的弹层要和触发器做锚点关系，两者必须能在同一棵树里互相看见名字，或者干脆不要封装成两个独立的 shadow root。

还有一条和列表相关：虚拟列表把行节点复用、平移到新的数据上时，锚点盒的几何会变，CSS 会跟着重算，这部分你不用管。你要管的是菜单是否还开着。行被回收时，如果菜单用的是这一行内部的节点，菜单会跟着行一起被移走。交互上应该在滚动回收前关掉弹出层。`position-visibility: anchors-visible` 能在锚点离开可视区域时把菜单藏起来，但它不会帮你把 `popover` 的打开状态复位。滚动开始时主动 `hidePopover()`，状态才干净。

***

## 六、Canvas 和 3D 场景：锚点可以是一个零尺寸的代理

浏览器 3D 里的货位标签、车身热点，几何在画布坐标系里，标签却是 DOM，因为 DOM 能做选中态、键盘和无障碍。Anchor Positioning 不认识世界坐标。它只认识一个 CSS 盒。

做法是放一个零尺寸代理，由渲染循环把投影后的屏幕坐标写进去，标签再锚到这个代理上：

```html
<div class="viewport">
  <canvas></canvas>
  <span class="hotspot" style="anchor-name: --hotspot"></span>
  <div class="label">A-12 · 占用</div>
</div>
```

```css
.viewport { position: relative; }

.hotspot {
  position: absolute;
  width: 0;
  height: 0;
  left: var(--x);
  top: var(--y);
}

.label {
  position: absolute;
  position-anchor: --hotspot;
  position-area: block-start center;
  position-try-fallbacks: flip-block;
  margin: 0 0 8px 0;
}
```

渲染循环里只做一件和 DOM 有关的事：把投影结果写成 `--x` 和 `--y`。翻转、离开视口隐藏，仍然是 CSS 的事。代理必须真的在布局里占一个位置，`display: none` 和 `content-visibility` 把子树跳过时，锚点会丢。代理用 `width: 0; height: 0`，不要用 `display: none`。

这个模式的边界也很清楚。投影结果一帧一变时，你是在用自定义属性触发样式更新，锚点关系本身不再节省掉「JS 写坐标」这件事，它节省的是「翻转和碰撞」。热点数量上来之后，该合并绘制的仍然是 Canvas 文本，而不是一百个锚点元素。代理锚点适合少量、可点、要无障碍的热点，不适合把整个粒子系统搬进 DOM。

***

## 七、上线前对一下这张清单

支持面先说死，避免评审时各说各的版本号：

| 能力 | Chrome / Edge | Safari | Firefox |
|------|----------------|--------|---------|
| `anchor-name`、`anchor()`、`anchor-size()`、`@position-try` | 125 | 26 | 147 |
| `position-try-fallbacks` | 128 | 26 | 147 |
| `position-area`（旧名 `inset-area`） | 129 | 26 | 147 |
| `anchor-scope` | 131 | 26 | 147 |
| 整套成为 Baseline | 2026-01-13，随 Firefox 147 与 Chrome 144 对齐 | 同左 | 同左 |

`anchor-valid`、`anchor-visible` 这类更新的可见性关键字，到 2026 年 11 月仍然没有三家同时稳定。生产代码用 `anchors-visible` 和 `no-overflow` 这两个已经对齐的值，不把新关键字写进默认样式。

上线清单：

1. 每个锚点名字在作用域内唯一，列表组件加 `anchor-scope`。
2. `position-anchor` 写成明确的名字，不依赖初始值。
3. 被定位元素是 `absolute` 或 `fixed`，并且在源码顺序上晚于锚点。
4. 接入 Popover 时重置 `inset` 和居中用的 `margin`。
5. 需要翻面时写 `position-try-fallbacks`，箭头方向不放进 `@position-try`。
6. `@supports (anchor-name: --a) and (position-area: top)` 之外保留一个不测量的静态位置。
7. 打开的菜单在锚点滚动出容器、或虚拟行回收时调用 `hidePopover()`。
8. 旧浏览器流量还在基线之外时，Floating UI 留作 `@supports` 不成立时的脚本，而不是两套同时算。

最后一条值得展开。检测可以放在一次：

```javascript
const anchorReady = CSS.supports("anchor-name: --a")
  && CSS.supports("position-area: top")
  && CSS.supports("position-try-fallbacks: flip-block");
```

`anchorReady` 为假，再去 `import("floating-ui")`。为真，就不要把 `autoUpdate` 也挂上。两套同时写 `top`/`left`，后写的那个会在下一帧被浏览器的锚点布局盖掉，表现是菜单抖一下。降级是分支，不是叠加。

***

## 八、什么时候不要用

Anchor Positioning 替代的是「DOM 盒对 DOM 盒」的定位，不是全部的浮层基础设施。

继续用 Floating UI 或等价测量的情况：

- **参照物不是元素。** 文本选区、鼠标坐标、跨文档的 iframe 可视区域，都没有一个你能起 `anchor-name` 的盒。可以造代理元素，但代理的坐标还是你算的，库的中间件往往更完整。
- **策略比翻转更复杂。** 例如「优先不遮挡输入框，其次不遮挡提交按钮，再次允许覆盖描述文本」。`position-try-fallbacks` 只有位置列表，没有业务优先级。
- **箭头是交互的一部分。** 规范明确 `@position-try` 不能改非定位类属性。箭头要跟着翻面改变方向，并且这个方向还要参与点击热区，测量库的 `arrow` 中间件仍然更直接。
- **浏览器基线低于 2026 年初。** 企业环境里如果 Chrome 124、Safari 18 仍在支持矩阵内，Anchor Positioning 只能做增强，不能做唯一实现。

可以放心交给 CSS 的情况也很集中：设计系统里的 Tooltip、Dropdown、右键之外的操作菜单、表格行内气泡、以及少量 DOM 标签跟随一个锚点盒。这些场景里，删掉 `autoUpdate` 之后少掉的不是功能，是一类监听泄漏。

***

## 九、收束

弹层定位拖了这么多年，是因为它看起来像视图细节，实际上是布局。测量方案把布局搬进了主线程，每个滚动监听都是一次对这个事实的补偿。

Anchor Positioning 把补偿还了回去：你声明锚点和方位，浏览器在布局阶段完成跟随和翻转。Popover API 继续负责顶层、轻量关闭和焦点。`anchor-scope` 负责组件实例之间不要串名。`@supports` 负责基线之外的浏览器仍有一个不测量的位置。

明年设计系统如果还在给每一个 Tooltip 包一层测量 hook，先问一句：锚点是不是一个 DOM 盒。是的话，这段 JavaScript 现在就该退休。
