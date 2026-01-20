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
declare const template = "\n<style>\n  :host {\n    display: block;\n    width: 100%;\n    height: 100%;\n    overscroll-behavior-y: contain;\n  }\n\n  .bottom-ref {\n    width: 0;\n    height: 0;\n    pointer-events: none;\n  }\n\n  /* \u72B6\u6001\u9A71\u52A8 UI\uFF1A\u5229\u7528 CSS \u9009\u62E9\u5668\u54CD\u5E94\u5C5E\u6027\u53D8\u5316 */\n  .slot-wrapper {\n    display: none;\n  }\n  :host([has-next-page=\"true\"]) .loading-slot {\n    display: contents;\n  }\n  :host([has-next-page=\"false\"]) .no-data-slot {\n    display: contents;\n  }\n\n  .refresh-container {\n    overflow: hidden;\n    height: 0;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    transition: height 0.3s ease;\n    flex-shrink: 0;\n    background-color: transparent;\n  }\n</style>\n\n<div class=\"refresh-container\">\n  <slot name=\"refresh\"></slot>\n</div>\n<slot></slot>\n<div class=\"bottom-ref\"></div>\n<div class=\"slot-wrapper loading-slot\">\n  <slot name=\"loading\"></slot>\n</div>\n<div class=\"slot-wrapper no-data-slot\">\n  <slot name=\"no-data\"></slot>\n</div>\n";
declare class InfiniteScrollList extends HTMLElement {
    private _observerRef;
    private _resizeObserverRef;
    private _bottomRef;
    private _scrollContainer;
    private _onEndReachedThreshold;
    private _hasNextPage;
    private _refreshContainer;
    private _enableRefresh;
    private _refreshThreshold;
    private _isRefreshing;
    private _startY;
    private _isPulling;
    private _isScrollingToTop;
    constructor();
    /**
     * 定义需要观察的属性列表
     * 当这些属性发生变化时，会触发 attributeChangedCallback
     * @returns 需要观察的属性名称数组
     */
    static get observedAttributes(): string[];
    /**
     * 属性变化时的回调函数
     * 当 observedAttributes 中定义的属性发生变化时，浏览器会自动调用此方法
     * @param name - 发生变化的属性名称
     * @param oldValue - 属性的旧值
     * @param newValue - 属性的新值
     */
    attributeChangedCallback(name: string, oldValue: string, newValue: string): void;
    /**
     * 组件连接到 DOM 时的生命周期回调
     * 当组件被插入到 DOM 树中时，浏览器会自动调用此方法
     * 在此方法中初始化观察器、事件监听器等资源
     */
    connectedCallback(): void;
    /**
     * 组件从 DOM 断开连接时的生命周期回调
     * 当组件从 DOM 树中移除时，浏览器会自动调用此方法
     * 在此方法中清理观察器、事件监听器等资源，防止内存泄漏
     */
    disconnectedCallback(): void;
    /**
     * 查找滚动容器
     * 从组件自身开始，向上遍历元素，查找第一个设置了 overflow-y: auto 或 overflow-y: scroll 的元素
     * 如果找不到，返回 null，表示滚动发生在 body 上
     * @returns 滚动容器元素，如果未找到则返回 null
     */
    private _findScrollContainer;
    /**
     * IntersectionObserver 的回调函数
     * 当底部观察元素进入视口时触发，用于检测是否滚动到底部
     * @param entries - IntersectionObserver 的观察条目数组
     */
    private _intersectionCallback;
    /**
     * 设置 IntersectionObserver
     * 创建或重新创建 IntersectionObserver，用于观察底部元素是否进入视口
     * @param container - 滚动容器元素，如果为 null 则使用 viewport 作为根
     */
    private _setupObserver;
    /**
     * ResizeObserver 的回调函数
     * 当父元素大小发生变化时触发
     * 只有当滚动容器发生变化时，才重新设置 IntersectionObserver，避免不必要的性能开销
     * @param entries - ResizeObserver 的观察条目数组
     */
    private _resizeCallback;
    /**
     * 检测当前环境是否为移动端
     */
    private get _isMobile();
    /**
     * 设置下拉刷新的事件监听器
     */
    private _setupRefreshListeners;
    /**
     * 清理下拉刷新的事件监听器
     */
    private _cleanupRefreshListeners;
    /**
     * 处理 touchstart 事件
     * 检测是否在滚动容器顶部，如果是则开始下拉刷新流程
     * @param e - TouchEvent 对象
     */
    private _handleTouchStart;
    /**
     * 处理 touchmove 事件
     * 计算下拉距离，应用阻尼效果，更新刷新容器高度
     * 派发 refresh-pulling 事件，让外部感知下拉进度
     * @param e - TouchEvent 对象
     */
    private _handleTouchMove;
    /**
     * 处理 touchend 事件
     * 判断下拉距离是否达到阈值，如果达到则触发刷新事件，否则回弹
     * @param e - TouchEvent 对象
     */
    private _handleTouchEnd;
    /**
     * 滚动到顶部并触发刷新
     * 用于程序化触发刷新，例如点击导航菜单时
     * 使用平滑滚动动画
     * @returns Promise，滚动完成后 resolve
     */
    scrollToTopAndRefresh(): Promise<void>;
    /**
     * 滚动到顶部
     * 使用平滑滚动动画，并等待滚动结束
     * @returns Promise，滚动完成后 resolve
     */
    scrollToTop(): Promise<void>;
    /**
     * 触发刷新（内部方法，供下拉刷新和程序化刷新共用）
     * 显示刷新容器并触发刷新事件
     */
    private _triggerRefresh;
}
