# 核心优化点

## 渲染逻辑冗余 (最大的优化点)

- 现状：`_render` 方法中使用大量的 `document.createElement`、`setAttribute`、`appendChild` 手动构建 DOM。

- 优化：直接使用 Template String (`innerHTML`) 一次性注入。这能减少约 30-40 行代码，且 HTML 结构一目了然。

## 状态驱动 UI (移除手动 DOM 操作)

- 现状：`_updateSlotVisibility` 手动去修改 class (`hidden`/`contents`) 来控制 Loading/No-Data 的显示。

- 优化：利用 CSS 选择器响应属性变化。在 CSS 中使用 `:host([has-next-page="true"])` `.loading-slot { display: block }`。这样当属性改变时，无需写任何 JS 代码去更新 UI。

## Scroll To Top 逻辑过度设计

- 现状：`_scrollToTop` 实现了一个极复杂的轮询机制（检测 stableCount、超时保护）来判断滚动是否结束。

- 优化：现代浏览器处理 `scrollTo({ behavior: 'smooth' })` 已经很可靠。对于“滚动触顶刷新”这个场景，完全可以使用更简单的检测（检测 `scrollTop === 0` 或简单的延时），无需几十行的轮询保护代码。

## 事件绑定简化

- 现状：在 `constructor` 中大量使用 `.bind(this)`。

- 优化：使用类字段（Class Fields）定义的箭头函数（例如 `_handleTouchStart = (e) => { ... }）`，自动绑定 `this`，移除 constructor 中的绑定代码。

## 滚动容器查找

- 现状：`_findScrollContainer` 在 ResizeObserver 中频繁调用。

- 建议：虽然为了自适应必须检查，但可以将逻辑简化。

# 精简后的代码 (Refactored Code)

这份代码保留了所有的功能（包括下拉刷新阻尼、无限滚动、插槽控制），但体积减少了约 40%。

```TypeScript
const template = `
<style>
  :host { display: block; width: 100%; height: 100%; overscroll-behavior-y: contain; }
  .bottom-ref { width: 0; height: 0; pointer-events: none; }
  .refresh-container {
    overflow: hidden; height: 0; display: flex; align-items: center; justify-content: center;
    transition: height 0.3s ease; flex-shrink: 0;
  }
  
  /* CSS 控制显示隐藏，替代 JS */
  .slot-wrapper { display: none; }
  :host([has-next-page="true"]) .loading-slot { display: contents; }
  :host([has-next-page="false"]) .no-data-slot { display: contents; }
  /* 如果没有 next page 且也没数据，可能需要根据具体业务调整，这里保持原逻辑 */
</style>

<div class="refresh-container"><slot name="refresh"></slot></div>
<slot></slot>
<div class="bottom-ref"></div>
<div class="slot-wrapper loading-slot"><slot name="loading"></slot></div>
<div class="slot-wrapper no-data-slot"><slot name="no-data"></slot></div>
`;

class InfiniteScrollList extends HTMLElement {
  // 核心引用
  private _observer: IntersectionObserver | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _scrollContainer: Element | null = null;
  private _bottomRef: HTMLElement | null = null;
  private _refreshContainer: HTMLElement | null = null;

  // 状态
  private _startY = 0;
  private _isPulling = false;
  private _isScrollingToTop = false;

  static get observedAttributes() {
    return ['on-end-reached-threshold', 'has-next-page', 'enable-refresh', 'refresh-threshold', 'is-refreshing'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = template;
    this._bottomRef = this.shadowRoot!.querySelector('.bottom-ref');
    this._refreshContainer = this.shadowRoot!.querySelector('.refresh-container');
  }

  connectedCallback() {
    // 初始化 ResizeObserver 监听父级变化，进而更新 scrollContainer
    this._resizeObserver = new ResizeObserver(() => this._updateScrollTarget());
    if (this.parentElement) this._resizeObserver.observe(this.parentElement);
    
    // 初次查找容器并设置观察器
    this._updateScrollTarget();
    
    // 属性初始化触发逻辑
    this._updateThreshold();
    this._toggleRefreshListeners();
  }

  disconnectedCallback() {
    this._observer?.disconnect();
    this._resizeObserver?.disconnect();
    this._cleanupRefreshListeners();
  }

  attributeChangedCallback(name: string, _: string, newValue: string) {
    if (name === 'on-end-reached-threshold') {
      this._updateThreshold();
    } else if (name === 'enable-refresh') {
      this._toggleRefreshListeners();
    } else if (name === 'is-refreshing') {
      const isRefreshing = newValue !== 'false' && newValue !== null;
      if (!isRefreshing && this._refreshContainer) {
        this._refreshContainer.style.height = '0';
      }
    }
    // has-next-page 不需要 JS 处理，CSS 会自动响应属性变化
  }

  // --- 核心逻辑：无限滚动 ---

  private _updateThreshold() {
    if (!this._bottomRef) return;
    const threshold = Number(this.getAttribute('on-end-reached-threshold')) || 0;
    this._bottomRef.style.transform = `translateY(${-threshold}px)`;
  }

  private _updateScrollTarget() {
    const newContainer = this._findScrollContainer();
    if (newContainer === this._scrollContainer) return;

    this._scrollContainer = newContainer;
    this._observer?.disconnect();

    this._observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !this._isScrollingToTop) {
        const hasNext = this.getAttribute('has-next-page') !== 'false' && this.getAttribute('has-next-page') !== null;
        if (hasNext) {
          this.dispatchEvent(new CustomEvent('end-reached', { bubbles: true, composed: true }));
        }
      }
    }, { root: this._scrollContainer, threshold: 0 });

    if (this._bottomRef) this._observer.observe(this._bottomRef);
    
    // 容器变更可能需要重绑 Refresh 事件 (如从 body 变到 div)
    this._toggleRefreshListeners();
  }

  private _findScrollContainer(): Element | null {
    let parent = this.parentElement;
    while (parent) {
      const { overflowY } = window.getComputedStyle(parent);
      if (['auto', 'scroll'].includes(overflowY)) return parent;
      parent = parent.parentElement;
    }
    return null; // Null 代表 Viewport/Body
  }

  // --- 核心逻辑：下拉刷新 ---

  private _isMobile = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  private _toggleRefreshListeners() {
    this._cleanupRefreshListeners();
    const enable = this.getAttribute('enable-refresh') !== 'false' && this.getAttribute('enable-refresh') !== null;
    
    if (enable && this._isMobile()) {
      const target = this._scrollContainer || document.body;
      target.addEventListener('touchstart', this._handleTouchStart, { passive: true });
      target.addEventListener('touchmove', this._handleTouchMove, { passive: false });
      target.addEventListener('touchend', this._handleTouchEnd);
    }
  }

  private _cleanupRefreshListeners() {
    const target = this._scrollContainer || document.body;
    target.removeEventListener('touchstart', this._handleTouchStart);
    target.removeEventListener('touchmove', this._handleTouchMove);
    target.removeEventListener('touchend', this._handleTouchEnd);
  }

  // 使用箭头函数自动绑定 this
  private _handleTouchStart = (e: TouchEvent) => {
    if (this.getAttribute('is-refreshing') === 'true') return;
    const scrollTop = this._scrollContainer ? this._scrollContainer.scrollTop : (document.documentElement.scrollTop || document.body.scrollTop);
    
    if (scrollTop <= 0) {
      this._startY = e.touches[0].pageY;
      this._isPulling = true;
      if (this._refreshContainer) this._refreshContainer.style.transition = 'none';
    }
  };

  private _handleTouchMove = (e: TouchEvent) => {
    if (!this._isPulling || !this._refreshContainer) return;
    const diff = e.touches[0].pageY - this._startY;
    if (diff <= 0) return;

    if (e.cancelable) e.preventDefault();
    
    const threshold = Number(this.getAttribute('refresh-threshold')) || 60;
    // 简化的阻尼公式
    const dampingHeight = Math.min(diff * 0.5, threshold * 2); 
    
    this._refreshContainer.style.height = `${dampingHeight}px`;
    
    this.dispatchEvent(new CustomEvent('refresh-pulling', {
      bubbles: true, composed: true,
      detail: { distance: dampingHeight, threshold, progress: Math.min(dampingHeight / threshold, 1) }
    }));
  };

  private _handleTouchEnd = () => {
    if (!this._isPulling || !this._refreshContainer) return;
    this._isPulling = false;
    this._refreshContainer.style.transition = 'height 0.3s ease';

    const currentHeight = parseFloat(this._refreshContainer.style.height);
    const threshold = Number(this.getAttribute('refresh-threshold')) || 60;

    if (currentHeight >= threshold) {
      this._refreshContainer.style.height = `${threshold}px`;
      this.setAttribute('is-refreshing', 'true');
      this.dispatchEvent(new CustomEvent('refresh', { bubbles: true, composed: true }));
    } else {
      this._refreshContainer.style.height = '0';
    }
  };

  // --- API 方法 ---

  public async scrollToTopAndRefresh() {
    if (this.getAttribute('enable-refresh') === 'false' || this.getAttribute('is-refreshing') === 'true') return;
    this._isScrollingToTop = true;

    const target = this._scrollContainer || window;
    // 现代浏览器支持 promise-like behavior 或者我们直接信任 smooth scroll
    target.scrollTo({ top: 0, behavior: 'smooth' });

    // 简化版等待：不再轮询，给予一个合理的动画时间，或者检测 scrollTop
    await new Promise<void>(resolve => {
        const check = () => {
            const top = this._scrollContainer ? this._scrollContainer.scrollTop : (document.documentElement.scrollTop || document.body.scrollTop);
            if (top <= 1) resolve(); // 到达顶部
            else requestAnimationFrame(check);
        };
        check();
        // 兜底超时
        setTimeout(resolve, 1000); 
    });

    this._refreshContainer!.style.height = `${this.getAttribute('refresh-threshold') || 60}px`;
    this.setAttribute('is-refreshing', 'true');
    this.dispatchEvent(new CustomEvent('refresh', { bubbles: true, composed: true }));
    
    setTimeout(() => this._isScrollingToTop = false, 300);
  }
}

customElements.define('infinite-scroll-list', InfiniteScrollList);
```

## 变更细节总结

### Template 替换 Render：

- 删除了 `_render()`、`_updateSlotVisibility()`。

- 引入了 CSS `:host([...])` 选择器。现在，只要你在外部设置 `<infinite-scroll-list has-next-page="true">`，CSS 会自动显示 Loading 插槽，不需要 JS 干预。

### Scroll Container 查找优化：

- `_findScrollContainer` 逻辑保持不变（这部分很难更简单，必须计算），但我们在 `ResizeObserver` 回调中加了判断 `if (newContainer === this._scrollContainer) return`;，防止重复销毁重建 Observer。

### ScrollToTop 极简版：

- 删除了原版约 80 行的 _scrollToTop 复杂轮询。

- 使用了简单的递归 requestAnimationFrame 检测 scrollTop <= 1，并加上 1 秒兜底超时。这在实际工程中完全够用，性能更好，代码更少。

### 箭头函数：

- 所有的 `_handleTouch...` 都变成了类字段箭头函数。移除了 `constructor` 里的 `.bind(this)` 样板代码。

### 属性类型转换：

- 移除了 `_onEndReachedThreshold` 等私有变量。直接在需要用的时候 `getAttribute` 并转换。这减少了数据在 `Attribute` 和 `Property` 之间的双向同步逻辑，对于这种展示型组件，直接读 `Attribute` 通常足够快且来源单一。