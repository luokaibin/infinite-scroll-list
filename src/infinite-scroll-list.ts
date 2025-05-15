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
 * 8. 支持向上加载功能，通过has-previous-page控制是否有上一页
 * 9. 支持传入距离顶部的距离参数(on-start-reached-threshold)
 * 10. 组件只在has-previous-page为true时触发start-reached事件
 */

// 定义组件的样式
const style = `
:host {
  display: block;
  width: 100%;
  height: 100%;
}

.relative {
  position: relative;
}

.absolute {
  position: absolute;
}

.bottom-0 {
  bottom: 0px;
}

.top-0 {
  top: 0px;
}

.z-\\[-1\\] {
  z-index: -1;
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

// 定义观察器类型
enum ObserverType {
  Top = 'top',
  Bottom = 'bottom'
}

// 定义槽类型
enum SlotType {
  TopLoading = 'top-loading',
  Loading = 'loading',
  NoData = 'no-data'
}

class InfiniteScrollList extends HTMLElement {
  // 私有属性
  private _observers: Map<ObserverType, IntersectionObserver | null> = new Map();
  private _resizeObserverRef: ResizeObserver | null = null;
  private _refElements: Map<ObserverType, HTMLDivElement | null> = new Map();
  private _thresholds: Map<string, number> = new Map();
  private _flags: Map<string, boolean> = new Map();
  private _container: HTMLDivElement | null = null;

  constructor() {
    super();
    
    // 创建 Shadow DOM
    this.attachShadow({ mode: 'open' });
    
    // 初始化Maps
    this._observers.set(ObserverType.Top, null);
    this._observers.set(ObserverType.Bottom, null);
    this._refElements.set(ObserverType.Top, null);
    this._refElements.set(ObserverType.Bottom, null);
    
    // 绑定回调函数，避免this指向问题
    this._intersectionCallback = this._intersectionCallback.bind(this);
    this._resizeCallback = this._resizeCallback.bind(this);
  }

  // 定义观察的属性
  static get observedAttributes(): string[] {
    return ['on-end-reached-threshold', 'has-next-page', 'on-start-reached-threshold', 'has-previous-page'];
  }

  // 属性变化时的回调
  attributeChangedCallback(name: string, oldValue: string, newValue: string): void {
    if (oldValue === newValue) return;
    
    switch (name) {
      case 'on-end-reached-threshold':
        this._updateThreshold('end', newValue);
        break;
      case 'on-start-reached-threshold':
        this._updateThreshold('start', newValue);
        break;
      case 'has-next-page':
        this._updateFlag('nextPage', newValue);
        this._updateSlotVisibility(SlotType.Loading, SlotType.NoData, this._flags.get('nextPage') || false);
        break;
      case 'has-previous-page':
        this._updateFlag('previousPage', newValue);
        this._updateSlotVisibility(SlotType.TopLoading, null, this._flags.get('previousPage') || false);
        break;
    }
  }

  // 更新阈值
  private _updateThreshold(type: string, value: string): void {
    const threshold = Number(value) || 0;
    this._thresholds.set(type, threshold);
    
    const refElement = type === 'end' 
      ? this._refElements.get(ObserverType.Bottom)
      : this._refElements.get(ObserverType.Top);
      
    if (refElement) {
      refElement.style.height = `${threshold}px`;
    }
  }

  // 更新标志
  private _updateFlag(type: string, value: string): void {
    this._flags.set(type, value !== null && value !== 'false');
  }

  // 组件连接到 DOM 时
  connectedCallback(): void {
    // 初始化属性默认值
    this._thresholds.set('end', Number(this.getAttribute('on-end-reached-threshold')) || 0);
    this._thresholds.set('start', Number(this.getAttribute('on-start-reached-threshold')) || 0);
    this._flags.set('nextPage', this.getAttribute('has-next-page') !== 'false');
    this._flags.set('previousPage', this.getAttribute('has-previous-page') !== 'false');
    
    // 渲染组件
    this._render();
    
    const scrollContainer = this._findScrollContainer();
    
    // 初始化观察器
    this._initObserver(ObserverType.Bottom, scrollContainer);
    this._initObserver(ObserverType.Top, scrollContainer);

    // 初始化 ResizeObserver 监听父元素大小变化
    this._resizeObserverRef = new ResizeObserver(this._resizeCallback);
    if (this.parentElement) {
      this._resizeObserverRef.observe(this.parentElement);
    }
  }

  // 初始化观察器
  private _initObserver(type: ObserverType, root: Element | null): void {
    const observer = new IntersectionObserver(
      (entries) => this._intersectionCallback(entries, type),
      { threshold: 0.0, root }
    );
    
    const refElement = this._refElements.get(type);
    if (refElement) {
      observer.observe(refElement);
    }
    
    this._observers.set(type, observer);
  }

  // 组件从 DOM 断开连接时
  disconnectedCallback(): void {
    // 清理 IntersectionObserver
    this._observers.forEach(observer => {
      if (observer) {
        observer.disconnect();
      }
    });
    this._observers.clear();

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

  // IntersectionObserver 统一回调
  private _intersectionCallback(entries: IntersectionObserverEntry[], type: ObserverType): void {
    const [target] = entries;
    if (!(target.isIntersecting)) return;
    
    const eventConfig = {
      [ObserverType.Bottom]: {
        flag: 'nextPage',
        event: 'end-reached'
      },
      [ObserverType.Top]: {
        flag: 'previousPage',
        event: 'start-reached'
      }
    };
    
    const config = eventConfig[type];
    
    // 只在标志为true时触发事件
    if (this._flags.get(config.flag)) {
      // 触发自定义事件
      this.dispatchEvent(new CustomEvent(config.event, {
        bubbles: true,
        composed: true
      }));
    }
  }

  // ResizeObserver 回调
  private _resizeCallback(): void {
    // 当父元素大小变化时，重新初始化观察器
    const scrollContainer = this._findScrollContainer();
    
    // 重新初始化所有观察器
    this._observers.forEach((observer, type) => {
      if (observer) {
        observer.disconnect();
        this._initObserver(type, scrollContainer);
      }
    });
  }

  // 更新插槽可见性
  private _updateSlotVisibility(showSlot: SlotType, hideSlot: SlotType | null, condition: boolean): void {
    const showSlotElement = this.shadowRoot?.querySelector(`.${showSlot}-slot`);
    
    if (showSlotElement) {
      showSlotElement.className = condition ? `${showSlot}-slot contents` : `${showSlot}-slot hidden`;
    }
    
    if (hideSlot) {
      const hideSlotElement = this.shadowRoot?.querySelector(`.${hideSlot}-slot`);
      if (hideSlotElement) {
        hideSlotElement.className = condition ? `${hideSlot}-slot hidden` : `${hideSlot}-slot contents`;
      }
    }
  }

  // 创建带有具名插槽的容器
  private _createSlotContainer(slotName: string, isVisible: boolean): HTMLDivElement {
    const container = document.createElement('div');
    container.className = isVisible ? `${slotName}-slot contents` : `${slotName}-slot hidden`;
    
    const slot = document.createElement('slot');
    slot.setAttribute('name', slotName);
    
    container.appendChild(slot);
    return container;
  }

  // 渲染组件
  private _render(): void {
    if (!this.shadowRoot) return;
    
    // 添加样式
    const styleElement = document.createElement('style');
    styleElement.textContent = style;
    this.shadowRoot.appendChild(styleElement);
    
    // 创建容器
    this._container = document.createElement('div');
    this._container.setAttribute('part', 'container');
    this._container.className = 'relative';
    
    // 创建顶部观察元素
    const topRef = document.createElement('div');
    topRef.className = 'absolute top-0 z-[-1]';
    topRef.style.height = `${this._thresholds.get('start')}px`;
    this._refElements.set(ObserverType.Top, topRef);
    
    // 创建底部观察元素
    const bottomRef = document.createElement('div');
    bottomRef.className = 'absolute bottom-0 z-[-1]';
    bottomRef.style.height = `${this._thresholds.get('end')}px`;
    this._refElements.set(ObserverType.Bottom, bottomRef);
    
    // 创建顶部加载中插槽
    const hasPreviousPage = this._flags.get('previousPage') || false;
    const topLoadingSlot = this._createSlotContainer(SlotType.TopLoading, hasPreviousPage);
    
    // 创建内容插槽
    const defaultSlot = document.createElement('slot');
    
    // 创建底部加载中和无数据插槽
    const hasNextPage = this._flags.get('nextPage') || false;
    const loadingSlot = this._createSlotContainer(SlotType.Loading, hasNextPage);
    const noDataSlot = this._createSlotContainer(SlotType.NoData, !hasNextPage);
    
    // 组装组件
    this._container.appendChild(topRef);
    this._container.appendChild(topLoadingSlot);
    this._container.appendChild(defaultSlot);
    this._container.appendChild(bottomRef);
    this._container.appendChild(loadingSlot);
    this._container.appendChild(noDataSlot);
    
    this.shadowRoot.appendChild(this._container);
  }
}

// 注册自定义元素
customElements.define('infinite-scroll-list', InfiniteScrollList);
