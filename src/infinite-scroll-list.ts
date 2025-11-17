/**
 * 无限滚动加载组件
 * 
 * 功能：
 * 1. 支持传入距离底部的距离参数(on-end-reached-threshold)
 * 2. 支持外部传入是否还有下一页(has-next-page)
 * 3. 支持两个slot：loading和no-data
 * 4. 根据是否有下一页显示对应的slot内容
 * 5. 支持在body中使用，也支持在父或祖先元素overflow-y: auto的元素中使用
 * 6. 自适应父元素大小变化
 * 7. 组件只在has-next-page为true时触发end-reached事件
 */

// 定义组件的样式
const style = `
:host {
  display: block;
  width: 100%;
  height: 100%;
}

.bottom-ref {
  width: 0;
  height: 0;
  pointer-events: none;
}

.w-full {
  width: 100%;
}

.hidden {
  display: none;
}

.contents {
  display: contents;
}
`;

class InfiniteScrollList extends HTMLElement {
  // 私有属性
  private _observerRef: IntersectionObserver | null = null;
  private _resizeObserverRef: ResizeObserver | null = null;
  private _bottomRef: HTMLDivElement | null = null;
  private _onEndReachedThreshold: number = 0;
  private _hasNextPage: boolean = false;

  constructor() {
    super();
    
    // 创建 Shadow DOM
    this.attachShadow({ mode: 'open' });
    
    // 绑定回调函数，避免this指向问题
    this._intersectionCallback = this._intersectionCallback.bind(this);
    this._resizeCallback = this._resizeCallback.bind(this);
  }

  // 定义观察的属性
  static get observedAttributes(): string[] {
    return ['on-end-reached-threshold', 'has-next-page'];
  }

  // 属性变化时的回调
  attributeChangedCallback(name: string, oldValue: string, newValue: string): void {
    if (oldValue === newValue) return;
    
    if (name === 'on-end-reached-threshold') {
      this._onEndReachedThreshold = Number(newValue) || 0;
      if (this._bottomRef) {
        // 使用 margin-top 负值来实现距离阈值
        // 当滚动到距离底部还有 threshold 像素时，_bottomRef 会进入视口
        this._bottomRef.style.marginTop = `${-this._onEndReachedThreshold}px`;
      }
    } else if (name === 'has-next-page') {
      this._hasNextPage = newValue !== null && newValue !== 'false';
      this._updateSlotVisibility();
    }
  }

  // 组件连接到 DOM 时
  connectedCallback(): void {
    // 初始化属性默认值
    this._onEndReachedThreshold = Number(this.getAttribute('on-end-reached-threshold')) || 0;
    this._hasNextPage = this.getAttribute('has-next-page') !== 'false';
    
    // 渲染组件
    this._render();
    
    // 初始化 IntersectionObserver
    this._observerRef = new IntersectionObserver(this._intersectionCallback, {
      threshold: 0.0,
      root: this._findScrollContainer()
    });
    
    if (this._bottomRef) {
      this._observerRef.observe(this._bottomRef);
    }

    // 初始化 ResizeObserver 监听父元素大小变化
    this._resizeObserverRef = new ResizeObserver(this._resizeCallback);
    if (this.parentElement) {
      this._resizeObserverRef.observe(this.parentElement);
    }
  }

  // 组件从 DOM 断开连接时
  disconnectedCallback(): void {
    // 清理 IntersectionObserver
    if (this._observerRef) {
      this._observerRef.disconnect();
      this._observerRef = null;
    }

    // 清理 ResizeObserver
    if (this._resizeObserverRef) {
      this._resizeObserverRef.disconnect();
      this._resizeObserverRef = null;
    }
  }

  // 查找滚动容器
  private _findScrollContainer(): Element | null {
    let parent = this.parentElement;
    
    while (parent) {
      const overflowY = window.getComputedStyle(parent).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') {
        return parent;
      }
      parent = parent.parentElement;
    }
    
    return null; // 如果没有找到滚动容器，则返回null，使用默认的viewport
  }

  // IntersectionObserver 回调
  private _intersectionCallback(entries: IntersectionObserverEntry[]): void {
    const [target] = entries;
    if (!(target.isIntersecting)) return;
    
    // 只在有下一页时触发事件
    if (this._hasNextPage) {
      // 触发自定义事件
      this.dispatchEvent(new CustomEvent('end-reached', {
        bubbles: true,
        composed: true
      }));
    }
  }

  // ResizeObserver 回调
  private _resizeCallback(entries: ResizeObserverEntry[]): void {
    // 当父元素大小变化时，重新初始化观察器
    if (this._observerRef) {
      this._observerRef.disconnect();
      
      this._observerRef = new IntersectionObserver(this._intersectionCallback, {
        threshold: 0.0,
        root: this._findScrollContainer()
      });
      
      if (this._bottomRef) {
        this._observerRef.observe(this._bottomRef);
      }
    }
  }

  // 更新插槽可见性
  private _updateSlotVisibility(): void {
    const loadingSlot = this.shadowRoot?.querySelector('.loading-slot');
    const noDataSlot = this.shadowRoot?.querySelector('.no-data-slot');
    
    if (loadingSlot && noDataSlot) {
      loadingSlot.className = this._hasNextPage ? 'loading-slot contents' : 'loading-slot hidden';
      noDataSlot.className = this._hasNextPage ? 'no-data-slot hidden' : 'no-data-slot contents';
    }
  }

  // 渲染组件
  private _render(): void {
    if (!this.shadowRoot) return;
    
    // 添加样式
    const styleElement = document.createElement('style');
    styleElement.textContent = style;
    this.shadowRoot.appendChild(styleElement);
    
    // 创建内容插槽
    const defaultSlot = document.createElement('slot');
    
    // 创建底部观察元素（宽高为0，跟在内容之后）
    this._bottomRef = document.createElement('div');
    this._bottomRef.className = 'bottom-ref';
    this._bottomRef.style.marginTop = `${-this._onEndReachedThreshold}px`;
    
    // 创建加载中插槽
    const loadingSlot = document.createElement('div');
    loadingSlot.className = this._hasNextPage ? 'loading-slot contents' : 'loading-slot hidden';
    
    const loadingNamedSlot = document.createElement('slot');
    loadingNamedSlot.setAttribute('name', 'loading');
    
    loadingSlot.appendChild(loadingNamedSlot);
    
    // 创建无数据插槽
    const noDataSlot = document.createElement('div');
    noDataSlot.className = this._hasNextPage ? 'no-data-slot hidden' : 'no-data-slot contents';
    
    const noDataNamedSlot = document.createElement('slot');
    noDataNamedSlot.setAttribute('name', 'no-data');
    
    noDataSlot.appendChild(noDataNamedSlot);
    
    // 组装组件（调整顺序：defaultSlot -> _bottomRef -> loadingSlot -> noDataSlot）
    this.shadowRoot.appendChild(defaultSlot);
    this.shadowRoot.appendChild(this._bottomRef);
    this.shadowRoot.appendChild(loadingSlot);
    this.shadowRoot.appendChild(noDataSlot);
  }
}

// 注册自定义元素
customElements.define('infinite-scroll-list', InfiniteScrollList);
