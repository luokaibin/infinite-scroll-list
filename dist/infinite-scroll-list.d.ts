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
declare const style = "\n:host {\n  display: block;\n  width: 100%;\n  height: 100%;\n}\n\n.bottom-ref {\n  width: 0;\n  height: 0;\n  pointer-events: none;\n}\n\n.w-full {\n  width: 100%;\n}\n\n.hidden {\n  display: none;\n}\n\n.contents {\n  display: contents;\n}\n";
declare class InfiniteScrollList extends HTMLElement {
    private _observerRef;
    private _resizeObserverRef;
    private _bottomRef;
    private _onEndReachedThreshold;
    private _hasNextPage;
    constructor();
    static get observedAttributes(): string[];
    attributeChangedCallback(name: string, oldValue: string, newValue: string): void;
    connectedCallback(): void;
    disconnectedCallback(): void;
    private _findScrollContainer;
    private _intersectionCallback;
    private _resizeCallback;
    private _updateSlotVisibility;
    private _render;
}
