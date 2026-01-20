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
 * 8. 支持下拉刷新功能（移动端专用）
 */

// 定义组件的模板（包含样式和结构）
const template = `
<style>
  :host {
    display: block;
    width: 100%;
    height: 100%;
    overscroll-behavior-y: contain;
  }

  .bottom-ref {
    width: 0;
    height: 0;
    pointer-events: none;
  }

  /* 状态驱动 UI：利用 CSS 选择器响应属性变化 */
  .slot-wrapper {
    display: none;
  }
  :host([has-next-page="true"]) .loading-slot {
    display: contents;
  }
  :host([has-next-page="false"]) .no-data-slot {
    display: contents;
  }

  .refresh-container {
    overflow: hidden;
    height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: height 0.3s ease;
    flex-shrink: 0;
    background-color: transparent;
  }
</style>

<div class="refresh-container">
  <slot name="refresh"></slot>
</div>
<slot></slot>
<div class="bottom-ref"></div>
<div class="slot-wrapper loading-slot">
  <slot name="loading"></slot>
</div>
<div class="slot-wrapper no-data-slot">
  <slot name="no-data"></slot>
</div>
`;

class InfiniteScrollList extends HTMLElement {
  // 私有属性
  private _observerRef: IntersectionObserver | null = null;
  private _resizeObserverRef: ResizeObserver | null = null;
  private _bottomRef: HTMLDivElement | null = null;
  private _scrollContainer: Element | null = null; // 缓存当前的滚动容器
  private _onEndReachedThreshold: number = 0;
  private _hasNextPage: boolean = false;
  
  // 下拉刷新相关属性
  private _refreshContainer: HTMLDivElement | null = null;
  private _enableRefresh: boolean = false;
  private _refreshThreshold: number = 60;
  private _isRefreshing: boolean = false;
  private _startY: number = 0;
  private _isPulling: boolean = false;
  private _isScrollingToTop: boolean = false; // 是否正在滚动到顶部

  constructor() {
    super();
    
    // 创建 Shadow DOM 并注入模板，取代手动 DOM 构建
    this.attachShadow({ mode: 'open' }).innerHTML = template;
    
    // 获取模板中的关键元素引用
    this._bottomRef = this.shadowRoot!.querySelector('.bottom-ref');
    this._refreshContainer = this.shadowRoot!.querySelector('.refresh-container');
  }

  /**
   * 定义需要观察的属性列表
   * 当这些属性发生变化时，会触发 attributeChangedCallback
   * @returns 需要观察的属性名称数组
   */
  static get observedAttributes(): string[] {
    return [
      'on-end-reached-threshold', 
      'has-next-page',
      'enable-refresh',
      'refresh-threshold',
      'is-refreshing'
    ];
  }

  /**
   * 属性变化时的回调函数
   * 当 observedAttributes 中定义的属性发生变化时，浏览器会自动调用此方法
   * @param name - 发生变化的属性名称
   * @param oldValue - 属性的旧值
   * @param newValue - 属性的新值
   */
  attributeChangedCallback(name: string, oldValue: string, newValue: string): void {
    if (oldValue === newValue) return;
    
    if (name === 'on-end-reached-threshold') {
      this._onEndReachedThreshold = Number(newValue) || 0;
      if (this._bottomRef) {
        // 使用 transform 来实现距离阈值，不影响文档流
        // 当滚动到距离底部还有 threshold 像素时，_bottomRef 会进入视口
        this._bottomRef.style.transform = `translateY(${-this._onEndReachedThreshold}px)`;
      }
    } else if (name === 'has-next-page') {
      this._hasNextPage = newValue !== null && newValue !== 'false';
    } else if (name === 'enable-refresh') {
      this._enableRefresh = newValue !== null && newValue !== 'false';
      if (this._enableRefresh && this._isMobile) {
        // 只在移动端且启用刷新时才设置监听器
        this._setupRefreshListeners();
      } else {
        this._cleanupRefreshListeners();
      }
    } else if (name === 'refresh-threshold') {
      this._refreshThreshold = Number(newValue) || 60;
    } else if (name === 'is-refreshing') {
      const wasRefreshing = this._isRefreshing;
      this._isRefreshing = newValue !== null && newValue !== 'false';
      
      // 如果从 true 变为 false，收起刷新头
      if (wasRefreshing && !this._isRefreshing && this._refreshContainer) {
        this._refreshContainer.style.height = '0';
      }
    }
  }

  /**
   * 组件连接到 DOM 时的生命周期回调
   * 当组件被插入到 DOM 树中时，浏览器会自动调用此方法
   * 在此方法中初始化观察器、事件监听器等资源
   */
  connectedCallback(): void {
    // 注意：如果属性在 HTML 中存在，浏览器会在 connectedCallback 之前自动触发 attributeChangedCallback
    // 如果属性不存在，使用属性声明处的默认值即可（已在类属性声明处设置）
    
    // CSS 会根据 has-next-page 属性自动处理插槽可见性
    
    // 初始化 IntersectionObserver（使用提取的方法）
    const scrollContainer = this._findScrollContainer();
    this._setupObserver(scrollContainer);

    // 初始化 ResizeObserver 监听父元素大小变化
    this._resizeObserverRef = new ResizeObserver(this._resizeCallback);
    if (this.parentElement) {
      this._resizeObserverRef.observe(this.parentElement);
    }
    
    // 如果启用刷新且为移动端，设置事件监听
    if (this._enableRefresh && this._isMobile) {
      this._setupRefreshListeners();
    }
  }

  /**
   * 组件从 DOM 断开连接时的生命周期回调
   * 当组件从 DOM 树中移除时，浏览器会自动调用此方法
   * 在此方法中清理观察器、事件监听器等资源，防止内存泄漏
   */
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
    
    // 清理刷新相关的事件监听
    this._cleanupRefreshListeners();
  }

  /**
   * 查找滚动容器
   * 从组件自身开始，向上遍历元素，查找第一个设置了 overflow-y: auto 或 overflow-y: scroll 的元素
   * 如果找不到，返回 null，表示滚动发生在 body 上
   * @returns 滚动容器元素，如果未找到则返回 null
   */
  private _findScrollContainer(): Element | null {
    // 从组件自身开始检查（组件自身可能是滚动容器）
    let parent: Element | null = this as Element;
    
    while (parent) {
      const { overflowY } = window.getComputedStyle(parent);
      if (['auto', 'scroll'].includes(overflowY)) return parent;
      parent = parent.parentElement;
    }
    
    return null; // 如果没有找到滚动容器，则返回null，使用默认的viewport
  }

  /**
   * IntersectionObserver 的回调函数
   * 当底部观察元素进入视口时触发，用于检测是否滚动到底部
   * @param entries - IntersectionObserver 的观察条目数组
   */
  private _intersectionCallback = (entries: IntersectionObserverEntry[]): void => {
    const [target] = entries;
    if (!(target.isIntersecting)) return;
    
    // 如果正在滚动到顶部，忽略触发（防止滚动过程中误触发）
    if (this._isScrollingToTop) return;
    
    // 只在有下一页时触发事件
    if (this._hasNextPage) {
      // 触发自定义事件
      this.dispatchEvent(new CustomEvent('end-reached', {
        bubbles: true,
        composed: true
      }));
    }
  }

  /**
   * 设置 IntersectionObserver
   * 创建或重新创建 IntersectionObserver，用于观察底部元素是否进入视口
   * @param container - 滚动容器元素，如果为 null 则使用 viewport 作为根
   */
  private _setupObserver(container: Element | null): void {
    this._scrollContainer = container;
    
    // 如果已存在观察器，先断开连接
    if (this._observerRef) {
      this._observerRef.disconnect();
    }
    
    // 创建新的观察器
    this._observerRef = new IntersectionObserver(this._intersectionCallback, {
      threshold: 0.0,
      root: container
    });
    
    if (this._bottomRef) {
      this._observerRef.observe(this._bottomRef);
    }
  }

  /**
   * ResizeObserver 的回调函数
   * 当父元素大小发生变化时触发
   * 只有当滚动容器发生变化时，才重新设置 IntersectionObserver，避免不必要的性能开销
   * @param entries - ResizeObserver 的观察条目数组
   */
  private _resizeCallback = (entries: ResizeObserverEntry[]): void => {
    // 只有当滚动容器发生变化时，才重新设置观察器
    const newContainer = this._findScrollContainer();
    if (newContainer !== this._scrollContainer) {
      // 1. 先清理旧容器的监听器（此时 this._scrollContainer 还指向旧容器）
      this._cleanupRefreshListeners();
      
      // 2. 更新容器引用并重新设置无限滚动观察器
      this._setupObserver(newContainer);
      
      // 3. 在新容器上重新设置监听器（如果启用了刷新且在移动端）
      if (this._enableRefresh && this._isMobile) {
        this._setupRefreshListeners();
      }
    }
  };

  /**
   * 检测当前环境是否为移动端
   */
  private get _isMobile(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /**
   * 设置下拉刷新的事件监听器
   */
  private _setupRefreshListeners(): void {
    if (!this._isMobile) return;
    
    const target = (this._scrollContainer || document.body) as EventTarget;
    
    // 直接绑定方法名，箭头函数会自动处理 this
    target.addEventListener('touchstart', this._handleTouchStart as EventListener, { passive: true });
    target.addEventListener('touchmove', this._handleTouchMove as EventListener, { passive: false });
    target.addEventListener('touchend', this._handleTouchEnd as EventListener);
  }

  /**
   * 清理下拉刷新的事件监听器
   */
  private _cleanupRefreshListeners(): void {
    const target = (this._scrollContainer || document.body) as EventTarget;
    
    target.removeEventListener('touchstart', this._handleTouchStart as EventListener);
    target.removeEventListener('touchmove', this._handleTouchMove as EventListener);
    target.removeEventListener('touchend', this._handleTouchEnd as EventListener);
  }

  /**
   * 处理 touchstart 事件
   * 检测是否在滚动容器顶部，如果是则开始下拉刷新流程
   * @param e - TouchEvent 对象
   */
  private _handleTouchStart = (e: TouchEvent): void => {
    // 检查是否启用刷新
    if (!this._enableRefresh) return;
    
    // 检查是否正在刷新中
    if (this._isRefreshing) return;
    
    // 使用缓存的滚动容器获取滚动位置
    let scrollTop: number;
    
    if (this._scrollContainer) {
      // 在滚动容器中
      scrollTop = this._scrollContainer.scrollTop;
    } else {
      // 在 body 中滚动，需要兼容处理
      scrollTop = document.documentElement.scrollTop || document.body.scrollTop || 0;
    }
    
    // 只有在滚动条位于顶部时才开启下拉逻辑
    if (scrollTop <= 0) {
      this._startY = e.touches[0].pageY;
      this._isPulling = true;
      if (this._refreshContainer) {
        this._refreshContainer.style.transition = 'none';
      }
    }
  };

  /**
   * 处理 touchmove 事件
   * 计算下拉距离，应用阻尼效果，更新刷新容器高度
   * 派发 refresh-pulling 事件，让外部感知下拉进度
   * @param e - TouchEvent 对象
   */
  private _handleTouchMove = (e: TouchEvent): void => {
    if (!this._isPulling || !this._refreshContainer) return;

    const currentY = e.touches[0].pageY;
    const diff = currentY - this._startY;

    if (diff > 0) {
      // 阻止浏览器默认下拉刷新
      if (e.cancelable) e.preventDefault();
      
      // 阻尼计算 + 最大距离限制
      const maxPull = this._refreshThreshold * 2; // 最大下拉距离为阈值的2倍
      const dampingHeight = Math.min(
        Math.pow(diff, 0.85), 
        maxPull
      );
      
      this._refreshContainer.style.height = `${dampingHeight}px`;
      
      // 派发 pulling 事件，让外部感知进度（例如旋转图标）
      this.dispatchEvent(new CustomEvent('refresh-pulling', {
        bubbles: true,
        composed: true,
        detail: { 
          distance: dampingHeight,
          threshold: this._refreshThreshold,
          progress: Math.min(dampingHeight / this._refreshThreshold, 1)
        }
      }));
    }
  };

  /**
   * 处理 touchend 事件
   * 判断下拉距离是否达到阈值，如果达到则触发刷新事件，否则回弹
   * @param e - TouchEvent 对象
   */
  private _handleTouchEnd = (e: TouchEvent): void => {
    if (!this._isPulling || !this._refreshContainer) return;
    
    this._isPulling = false;
    this._refreshContainer.style.transition = 'height 0.3s ease';

    const finalHeight = parseFloat(this._refreshContainer.style.height) || 0;
    
    if (finalHeight >= this._refreshThreshold) {
      // 保持在 threshold 高度并触发刷新事件
      this._refreshContainer.style.height = `${this._refreshThreshold}px`;
      this._triggerRefresh();
    } else {
      // 回弹
      this._refreshContainer.style.height = '0';
    }
  };

  /**
   * 滚动到顶部并触发刷新
   * 用于程序化触发刷新，例如点击导航菜单时
   * 使用平滑滚动动画
   * @returns Promise，滚动完成后 resolve
   */
  public async scrollToTopAndRefresh(): Promise<void> {
    // 1. 检查是否启用刷新
    if (!this._enableRefresh) {
      console.warn('下拉刷新功能未启用');
      return;
    }
    
    // 2. 检查是否正在刷新中
    if (this._isRefreshing) {
      console.warn('正在刷新中，请勿重复触发');
      return;
    }
    
    // 3. 检查是否正在滚动到顶部
    if (this._isScrollingToTop) {
      console.warn('正在滚动到顶部，请勿重复触发');
      return;
    }
    
    this._isScrollingToTop = true;
    
    try {
      const scrollPromise =this.scrollToTop();
      this._triggerRefresh();
      await scrollPromise;
    } finally {
      // 给予一小段缓冲时间，确保 UI 状态更新完成
      setTimeout(() => {
        this._isScrollingToTop = false;
      }, 300);
    }
  }

  /**
   * 滚动到顶部
   * 使用平滑滚动动画，并等待滚动结束
   * @returns Promise，滚动完成后 resolve
   */
  public scrollToTop(): Promise<void> {
    return new Promise((resolve) => {
      const target = this._scrollContainer || window;
      
      // 执行平滑滚动
      target.scrollTo({ top: 0, behavior: 'smooth' });

      // 兜底超时：如果 1 秒内没检测到触顶，也强制结束
      const timeout = setTimeout(resolve, 1000);
      
      // 循环检测是否触顶
      const checkScroll = () => {
        const currentTop = this._scrollContainer 
          ? this._scrollContainer.scrollTop 
          : (document.documentElement.scrollTop || document.body.scrollTop || 0);
          
        if (currentTop <= 1) {
          clearTimeout(timeout);
          resolve();
        } else {
          requestAnimationFrame(checkScroll);
        }
      };
      
      requestAnimationFrame(checkScroll);
    });
  }

  /**
   * 触发刷新（内部方法，供下拉刷新和程序化刷新共用）
   * 显示刷新容器并触发刷新事件
   */
  private _triggerRefresh(): void {
    if (!this._refreshContainer) return;
    
    // 显示刷新容器
    this._refreshContainer.style.height = `${this._refreshThreshold}px`;
    
    // 设置刷新状态
    this._isRefreshing = true;
    this.setAttribute('is-refreshing', 'true');
    
    // 触发刷新事件
    this.dispatchEvent(new CustomEvent('refresh', {
      bubbles: true,
      composed: true
    }));
  }
}

// 注册自定义元素
customElements.define('infinite-scroll-list', InfiniteScrollList);
