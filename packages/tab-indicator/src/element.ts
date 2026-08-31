// 元素定义：本文件仅声明类，注册逻辑在 register.ts
// SSR-safe 基类：浏览器环境等同 extends HTMLElement；服务端（Node/SSR）环境
// HTMLElement 不存在，退化为空基类，保证模块可被服务端安全导入（no-op）
const CustomElementBase =
  typeof HTMLElement !== "undefined"
    ? HTMLElement
    : (class {} as unknown as typeof HTMLElement);

export class TabIndicator extends CustomElementBase {
  // Sticky scroll feature properties
  private _stickyState = { isSticky: false };
  private _scrollTarget: HTMLElement | null = null;
  private _intersectionObserver: IntersectionObserver | null = null;
  private _scrollContainer: HTMLElement | null = null;
  /** 首次 tab 切换时解析并锁定 `_scrollContainer`，之后不再重算（直至 destroy） */
  private _stickyScrollContainerLatched = false;
  private _originalScrollPadding = "";
  private _windowWidth = 0;
  /** Shadow DOM 关键元素引用 */
  private slotEl!: HTMLSlotElement;
  private effectElement!: HTMLDivElement;
  private mutationObserver: MutationObserver | null;
  private resizeObserver: ResizeObserver | null;
  private isInitialized: boolean;
  /** 当前效果类型：underline | capsule（connectedCallback 时从 attribute 读取） */
  effect = "";
  // Observer for viewport changes (e.g., for responsive top values)
  private _viewportResizeObserver: ResizeObserver | null = null;
  private _reinitializeTimer: ReturnType<typeof setTimeout> | null = null;

  // For scroll position caching
  private _lastActiveTab: HTMLElement | null = null;
  private _scrollPositionCache = new Map<HTMLElement, number>();
  private _calculatedScrollPadding = "";

  /**
   * 上一次横向滚动定位时激活 tab 在 `getSlottedTabs()` 中的下标。
   * 用于：首帧/路由进入/布局抖动用 `auto`，用户切换不同下标的 tab 用 `smooth`。
   * 用下标而非 DOM 引用，避免 React 重渲染替换节点时误判为「切换」。
   */
  private _lastActiveTabIndex: number | null = null;

  /** rAF 节流：滚动容器 scroll 事件写入 cache */
  private _scrollRafId = 0;
  private _boundOnScrollContainerScroll = this._onScrollContainerScroll.bind(this);
  // 构造函数：在组件实例创建时调用
  constructor() {
    super(); // 必须首先调用父类的构造函数

    // 创建并附加一个 Shadow DOM，模式为 "open" 意味着可以在外部通过 JS 访问
    this.attachShadow({ mode: "open" });

    // 设置 Shadow DOM 的内部 HTML 结构
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: relative;
          display: block;
        }

        slot {
          position: relative;
          z-index: 1;
        }

        .effect-element {
          --default-animation-duration: 0.3s;
          position: absolute;
          left: 0;
          transition: transform var(--animation-duration, var(--default-animation-duration)) ease-in-out, width var(--animation-duration, var(--default-animation-duration)) ease-in-out, height var(--animation-duration, var(--default-animation-duration)) ease-in-out;
          will-change: transform, width, height;
          z-index: -1;
        }

        :host([effect="underline"]) .effect-element {
          bottom: var(--underline-bottom, 0);
          height: var(--underline-height, 2px);
          background-color: var(--underline-color, #007bff);
          z-index: 1;
        }

        :host([effect="capsule"]) .effect-element {
          background-color: var(--capsule-bg-color, rgba(0, 123, 255, 0.1));
          border-radius: var(--capsule-border-radius, 999px);
          z-index: 0;
        }
      </style>
      <slot></slot>
      <div class="effect-element"></div>
    `;

    // 获取对 Shadow DOM 中关键元素的引用，以便后续操作
    this.slotEl = this.shadowRoot!.querySelector<HTMLSlotElement>("slot")!;
    this.effectElement = this.shadowRoot!.querySelector<HTMLDivElement>(
      ".effect-element",
    )!;
  }

  // 声明需要观察的属性，以便 attributeChangedCallback 生效
  static get observedAttributes(): string[] {
    return ["enable-sticky-scroll"];
  }

  // 生命周期回调：当组件被插入到 DOM 中时调用
  connectedCallback() {
    // 在组件连接到 DOM 后，检查并设置默认的 effect 属性
    if (!this.hasAttribute("effect")) {
      this.setAttribute("effect", "underline");
    }
    this.effect = this.getAttribute("effect");

    // 监听 slotchange 事件，当插入到 slot 的节点变化时触发
    this.slotEl.addEventListener("slotchange", this.handleSlotChange);
    // 首次连接时，手动调用一次以进行初始化设置
    this.handleSlotChange();

    // `attributeChangedCallback` 在「仅设置初始属性」场景下可能早于插入完成或漏触发；
    // 连接后再尝试一次，且 `_initializeStickyScroll` 内会补绑晚到的 `nextElementSibling`。
    if (this._isStickyScrollAttributeEnabled()) {
      this._initializeStickyScroll();
    }
  }

  // 生命周期回调：当组件从 DOM 中被移除时调用
  disconnectedCallback() {
    // 移除事件监听，防止内存泄漏
    this.slotEl.removeEventListener("slotchange", this.handleSlotChange);
    // 断开观察器，停止监听
    this.mutationObserver?.disconnect();
    this.resizeObserver?.disconnect();
    // 确保在移除时销毁吸顶功能
    this._destroyStickyScroll();
  }

  // 生命周期回调：当 observedAttributes 中声明的属性变化时调用
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "enable-sticky-scroll") {
      const isEnabled = this._isStickyScrollAttributeEnabledFromValue(newValue);

      if (isEnabled) {
        this._initializeStickyScroll();
      } else {
        this._destroyStickyScroll();
      }
    }
  }

  /**
   * @private
   * @description 与 attributeChangedCallback 中 enable-sticky-scroll 的启用判定一致（属性移除由 newValue=null 表示关闭）。
   */
  _isStickyScrollAttributeEnabledFromValue(newValue) {
    return newValue !== null && newValue !== "false";
  }

  _isStickyScrollAttributeEnabled() {
    return this._isStickyScrollAttributeEnabledFromValue(
      this.getAttribute("enable-sticky-scroll"),
    );
  }

  /**
   * 同步判断 tab 条是否处于吸顶状态，避免仅依赖 IntersectionObserver 时在切换 tab 的同一次同步调用里读到滞后值。
   */
  _isTabStripStuckSync() {
    const position = window.getComputedStyle(this).position;
    if (position !== "sticky" && position !== "-webkit-sticky") {
      return false;
    }
    const top = parseFloat(window.getComputedStyle(this).top) || 0;
    const rectTop = this.getBoundingClientRect().top;
    return Math.abs(rectTop - top) < 2;
  }

  // slotchange 事件的处理函数
  handleSlotChange = () => {
    // 每当 slot 内容变化时（例如动态添加/删除 tab），重新设置观察器
    this.setupObservers();
    // 并立即更新一次下划线的位置
    this.updateEffect();
  }

  // 获取所有被插入到 slot 中的 tab 元素
  getSlottedTabs = (): HTMLElement[] => {
    // 直接在宿主元素 (this) 上使用 querySelectorAll 查找所有 role="tab-item" 的后代元素。
    // 这种方法比遍历 assignedElements 更健壮，因为它可以找到任意深层嵌套的 tab，
    // 解决了 tab 被包裹在容器 div 中时无法被检测到的问题。
    return Array.from(this.querySelectorAll<HTMLElement>('[role="tab-item"]'));
  }

  // 设置所有的观察器
  setupObservers = () => {
    // 在重新设置之前，先断开旧的观察器，避免重复监听
    this.mutationObserver?.disconnect();
    this.resizeObserver?.disconnect();

    const tabs = this.getSlottedTabs();
    if (tabs.length === 0) return; // 如果没有 tab，则不进行任何操作

    // 创建 MutationObserver 来监听属性变化
    this.mutationObserver = new MutationObserver((mutations) => {
      // 如果任何一个变化的属性是 'data-actived'
      if (mutations.some(m => m.attributeName === 'data-actived')) {
        // 则更新下划线
        this.updateEffect();
      }
    });

    // 创建 ResizeObserver 来监听元素尺寸变化
    this.resizeObserver = new ResizeObserver(() => {
      // 只要有任何 tab 尺寸变化，就更新下划线
      this.updateEffect();
    });

    // 遍历所有 tab，为它们分别添加属性和尺寸监听
    tabs.forEach(tab => {
      this.mutationObserver.observe(tab, { attributes: true }); // 监听属性变化
      this.resizeObserver.observe(tab); // 监听尺寸变化
    });
  }

  // 更新效果元素的位置和尺寸
  updateEffect = () => {
    // 如果组件或其任何祖先元素的 display 为 none，则 offsetParent 返回 null。
    // 在这种情况下，getBoundingClientRect 会返回全零，导致效果元素被错误重置。
    // 此处增加卫语句，如果组件不可见，则不执行任何更新，以保持其最后的状态。
    if (this.offsetParent === null) {
      return;
    }

    // 找到当前被激活的 tab
    const activeTab = this.getSlottedTabs().find(tab => tab.getAttribute("data-actived") === "true");

    if (activeTab) {
      // 如果找到了激活的 tab
      // 获取其宽度和相对于父元素的左侧偏移量
      // 首次加载时禁用动画，以避免从 (0,0) 位置“飞”过来的效果
      if (!this.isInitialized) {
        this.effectElement.style.transition = 'none';
      }

      const { offsetLeft, offsetTop, offsetWidth, offsetHeight } = activeTab;

      this.effectElement.style.width = `${offsetWidth}px`;

      // 根据效果类型应用不同的变换
      if (this.effect === "capsule") {
        const parentStyle = window.getComputedStyle(this);
        const paddingTop = parseFloat(parentStyle.paddingTop);
        this.effectElement.style.height = `${offsetHeight}px`;
        this.effectElement.style.transform = `translate(${offsetLeft}px, ${offsetTop - paddingTop}px)`;
      } else {
        // underline 效果仅需要水平位移
        this.effectElement.style.transform = `translateX(${offsetLeft}px)`;
      }
      let hasTabChanged = false;
      if (this._isStickyScrollAttributeEnabled()) {
        if (!this._stickyScrollContainerLatched) {
          this._ensureScrollContainerLatched();
        }
        const switching = !!(this._lastActiveTab && this._lastActiveTab !== activeTab);
        if (switching) {
          hasTabChanged = true;
        }
        this._lastActiveTab = activeTab;
      }
      if (this._isStickyScrollAttributeEnabled()) {
        this._executeScroll(activeTab, hasTabChanged);
      }
    } else {
      // 如果没有激活的 tab，则隐藏下划线
      this.effectElement.style.width = '0px';
    }

    // 如果是首次初始化，在下一帧重新启用动画
    if (!this.isInitialized) {
      requestAnimationFrame(() => {
        this.effectElement.style.transition = ''; // 恢复 CSS 中定义的过渡效果
        this.isInitialized = true;
      });
      return;
    }

    this._scrollActiveTabIntoView(activeTab);
  }

  /**
   * @public
   * @param {HTMLElement} element - The element to scroll to when a tab is clicked while sticky.
   * @description Sets the target element for the sticky scroll feature.
   */
  setScrollTarget(element: HTMLElement) {
    this._scrollTarget = element;
  }

  /**
   * @private
   * @description Initializes the IntersectionObserver and related logic for the sticky scroll feature.
   */
  _initializeStickyScroll() {
    // If no scroll target has been set externally, default to the next sibling element.
    // This provides a sensible default for common layout patterns.
    if (!this._scrollTarget || !this._scrollTarget.isConnected) {
      this._scrollTarget = this.nextElementSibling as HTMLElement | null;
    }

    // Prevent re-initialization if already active（仍需在上面的懒绑定之后执行）
    if (this._intersectionObserver) {
      return;
    }
    const winodwEl = document.body;
    // 不在此阶段绑定 `_scrollContainer`（避免早于 React 插入父链时锁成 HTML），首次 tab 切换时再 latch。
    this._prepareStickyScrollForInit();

    let topOffset = parseInt(window.getComputedStyle(this).top, 10) || 0;
    // 未 latch 前用视口高度近似布局高度，供 IO rootMargin 使用
    const layoutHeight =
      this._scrollContainer?.clientHeight ??
      (typeof window !== "undefined"
        ? window.innerHeight
        : document.documentElement.clientHeight);
    // Correctly calculate the bottom offset to define the intersection boundary
    const bottomOffset = layoutHeight - this.offsetHeight - topOffset - 2;
    topOffset = topOffset - 2;
    const topOffsetPx = topOffset <= 0 ? `${Math.abs(topOffset)}px` : `-${topOffset}px`;
    const rootMargin = `${topOffsetPx} 0px -${bottomOffset}px 0px`;
    this._windowWidth = winodwEl.clientWidth;

    this._intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        // When isIntersecting is false, the element is outside the viewport (stuck at the top)
        this._stickyState.isSticky = !entry.isIntersecting;
      },
      {
        // root: this._scrollContainer,
        rootMargin,
        threshold: 1,
      },
    );
    this._intersectionObserver.observe(this);

    // Debounced re-initialization for responsive changes
    const debouncedReinit = () => {
      if (!this.isConnected) return;

      const currentWidth = winodwEl.clientWidth;
      if (
        currentWidth === this._windowWidth) {
        // Dimensions have not changed, so no need to re-initialize.
        return;
      }

      this._destroyStickyScroll();
      this._initializeStickyScroll();
    };

    this._viewportResizeObserver = new ResizeObserver((entries) => {
      clearTimeout(this._reinitializeTimer);
      this._reinitializeTimer = setTimeout(debouncedReinit, 500);
    });
    this._viewportResizeObserver.observe(winodwEl);
  }

  /**
   * @private
   * @description Destroys all observers and restores original styles for the sticky scroll feature.
   */
  _destroyStickyScroll() {
    this._intersectionObserver?.disconnect();
    this._intersectionObserver = null;

    this._viewportResizeObserver?.disconnect();
    this._viewportResizeObserver = null;

    clearTimeout(this._reinitializeTimer);

    this._detachScrollContainerListener();

    if (this._scrollContainer && this._scrollContainer !== (window as unknown as HTMLElement)) {
      this._scrollContainer.style.scrollPaddingTop = this._originalScrollPadding;
    }
    this._scrollContainer = null;
    this._stickyScrollContainerLatched = false;
  }

  /**
   * @private
   * @description Executes the scroll-into-view action if conditions are met.
   */
  _executeScroll(activeTab: HTMLElement, hasTabChanged: boolean) {
    if (!hasTabChanged) {
      return;
    }
    const stuckSync = this._isTabStripStuckSync();
    const stuckIo = this._stickyState.isSticky;
    const stuck = stuckSync || stuckIo;

    if (!stuck) {
      return;
    }
    if (!this._scrollTarget || !this._scrollContainer) {
      return;
    }

    this._scrollContainer.style.scrollPaddingTop = this._calculatedScrollPadding;

    const cacheHit = this._scrollPositionCache.has(activeTab);
    const cachedValue = cacheHit ? this._scrollPositionCache.get(activeTab) : undefined;

    if (cacheHit) {
      this._scrollContainer.scrollTop = cachedValue;
    } else {
      // 新 tab 无缓存时，回到顶部。
      this._scrollContainer.scrollTop = 0;
    }

    // Use requestAnimationFrame to restore padding after the scroll action has likely completed
    requestAnimationFrame(() => {
      this._scrollContainer!.style.scrollPaddingTop = this._originalScrollPadding;
    });
  }

  /**
   * @private
   * @description Finds the nearest scrollable ancestor or defaults to the document's scrolling element.
   * @param {HTMLElement} element - The starting element for the search.
   * @returns {HTMLElement} The scroll container.
   */
  _findScrollContainer(element: HTMLElement | null): HTMLElement {
    if (!element) {
      return (document.scrollingElement as HTMLElement) || document.documentElement;
    }

    let parent = element.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      if (style.overflowY === "auto" || style.overflowY === "scroll") {
        return parent;
      }
      if (parent === document.documentElement) {
        break; // Stop at the root
      }
      parent = parent.parentElement;
    }

    return (document.scrollingElement as HTMLElement) || document.documentElement;
  }

  /**
   * @private
   * sticky 初始化：不解析 `_scrollContainer`（推迟到首次 tab 切换时 latch），只准备 `scrollPadding` 表达式。
   */
  _prepareStickyScrollForInit() {
    this._scrollContainer = null;
    this._originalScrollPadding = "";
    this._stickyScrollContainerLatched = false;

    const topValue = window.getComputedStyle(this).top;
    const height = this.offsetHeight;

    if (topValue && height > 0) {
      this._calculatedScrollPadding = `calc(${topValue} + ${height}px)`;
    } else {
      this._calculatedScrollPadding = "";
    }
  }

  /**
   * @private
   * 解析并锁定滚动容器（首次 updateEffect 时），并挂载 scroll 监听以实时写入 cache。
   */
  _ensureScrollContainerLatched() {
    if (this._stickyScrollContainerLatched) {
      return;
    }
    const el = this._findScrollContainer(this);
    if (!el) {
      return;
    }
    this._scrollContainer = el;
    this._originalScrollPadding = el.style.scrollPaddingTop;

    const topValue = window.getComputedStyle(this).top;
    const height = this.offsetHeight;
    if (topValue && height > 0) {
      this._calculatedScrollPadding = `calc(${topValue} + ${height}px)`;
    } else {
      this._calculatedScrollPadding = "";
    }

    this._scrollContainer.addEventListener(
      "scroll",
      this._boundOnScrollContainerScroll,
      { passive: true },
    );

    this._stickyScrollContainerLatched = true;
  }

  /**
   * @private
   * @description rAF 节流：将当前激活 tab 的 scrollTop 写入 cache。
   */
  _onScrollContainerScroll() {
    if (this._scrollRafId) {
      return;
    }
    this._scrollRafId = requestAnimationFrame(() => {
      this._scrollRafId = 0;
      if (!this._scrollContainer) {
        return;
      }

      const activeTab = this.getSlottedTabs().find(
        (tab) => tab.getAttribute("data-actived") === "true",
      );
      if (!activeTab) {
        return;
      }

      this._scrollPositionCache.set(
        activeTab,
        this._scrollContainer.scrollTop,
      );
    });
  }

  /**
   * @private
   */
  _detachScrollContainerListener() {
    if (this._scrollRafId) {
      cancelAnimationFrame(this._scrollRafId);
      this._scrollRafId = 0;
    }
    if (this._scrollContainer) {
      this._scrollContainer.removeEventListener(
        "scroll",
        this._boundOnScrollContainerScroll,
      );
    }
  }

  /**
   *  修复bug https://alidocs.dingtalk.com/notable/record?dentryUuid=dpYLaezmVNLL7NXdCkeDGwYx8rMqPxX6&rowId=USuEtpQGxu&sheetId=5c6B6ay&viewId=KxPjM3I
   * `smart-horizontal-scroll` 取值约定（与 React `boolean` / 原生 HTML 布尔属性兼容）：
   * - 未设置属性：关闭
   * - 仅出现属性无值（HTML `<tab-indicator smart-horizontal-scroll>`）：开启
   * - 字符串（不区分大小写）：`true` | `1` | `on` | `yes` 为开启；`false` | `0` | `off` | `no` 为关闭
   * - 其它非空字符串：关闭（避免歧义）
   */
  _isSmartHorizontalScrollEnabled() {
    if (!this.hasAttribute("smart-horizontal-scroll")) {
      return false;
    }
    const v = this.getAttribute("smart-horizontal-scroll");
    if (v === null || v === "") {
      return true;
    }
    const normalized = String(v).trim().toLowerCase();
    if (
      normalized === "false" ||
      normalized === "0" ||
      normalized === "off" ||
      normalized === "no"
    ) {
      return false;
    }
    if (
      normalized === "true" ||
      normalized === "1" ||
      normalized === "on" ||
      normalized === "yes"
    ) {
      return true;
    }
    return false;
  }

  /**
   * @private
   * @description Ensures the active tab is visible within any horizontal scroll container.
   */

  _scrollActiveTabIntoView(activeTab: HTMLElement | undefined) {
    if (!activeTab) {
      return;
    }

    const smartScroll = this._isSmartHorizontalScrollEnabled();

    // Use requestAnimationFrame so the DOM updates (like underline position) apply before scrolling.
    requestAnimationFrame(() => {
      if (!activeTab || !activeTab.isConnected) {
        return;
      }

      const host = this;
      const tabs = this.getSlottedTabs();
      const activeIndex = tabs.indexOf(activeTab);
      if (activeIndex === -1) {
        return;
      }

      const hasHorizontalOverflow = host.scrollWidth > host.clientWidth;
      if (!hasHorizontalOverflow) {
        if (smartScroll) {
          this._lastActiveTabIndex = activeIndex;
        }
        return;
      }

      const hostRect = host.getBoundingClientRect();
      const activeRect = activeTab.getBoundingClientRect();
      const isFullyVisible =
        activeRect.left >= hostRect.left && activeRect.right <= hostRect.right;

      if (isFullyVisible) {
        if (smartScroll) {
          this._lastActiveTabIndex = activeIndex;
        }
        return;
      }

      const targetScrollLeft =
        activeTab.offsetLeft - (host.clientWidth - activeTab.offsetWidth) / 2;

      let behavior: ScrollBehavior = "auto";
      if (smartScroll) {
        const hadPreviousActive = this._lastActiveTabIndex !== null;
        const tabIndexChanged =
          hadPreviousActive && this._lastActiveTabIndex !== activeIndex;
        behavior =
          tabIndexChanged && this.isInitialized ? "smooth" : "auto";
        this._lastActiveTabIndex = activeIndex;
      } else {
        behavior = this.isInitialized ? "smooth" : "auto";
      }

      host.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior,
      });
    });
  }
}

// 兼容源包的默认导出（命名导出为主）
export default TabIndicator;
