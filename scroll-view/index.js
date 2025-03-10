// 原生 Web Component 实现的滚动加载组件

// 定义组件的样式
const style = `
/* 基础样式 */
.absolute {
  position: absolute;
}

.relative {
  position: relative;
}

.bottom-0 {
  bottom: 0px;
}

.z-\\[-1\\] {
  z-index: -1;
}

.inline {
  display: inline;
}

.w-6 {
  width: var(--loading-w, 1.5rem);
}

.h-6 {
  height: var(--loading-h, 1.5rem);
}

.w-full {
  width: 100%;
}

.flex {
  display: flex;
}

.justify-center {
  justify-content: center;
}

.items-center {
  align-items: center;
}

.py-3 {
  padding-top: var(--loading-py, 0.75rem);
  padding-bottom: var(--loading-py, 0.75rem);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.animate-spin {
  animation: spin 1s linear infinite;
}

.text-sm {
  font-size: 0.875rem;
  line-height: 1.25rem;
}

.text-center {
  text-align: center;
}

.py-6 {
  padding-top: 1.5rem;
  padding-bottom: 1.5rem;
}

.hidden {
  display: none;
}

.contents {
  display: contents;
}

.text-gray-600 {
  --tw-text-opacity: 1;
  color: rgb(75 85 99 / var(--tw-text-opacity));
}
`;

class ScrollView extends HTMLElement {
  constructor() {
    super();
    
    // 创建 Shadow DOM
    this.attachShadow({ mode: 'open' });
    
    // 创建观察器引用
    this._observerRef = null;
    
    // 创建底部元素引用
    this._bottomRef = null;
    
    // 绑定回调函数
    this._callback = this._callback.bind(this);
  }

  // 定义观察的属性
  static get observedAttributes() {
    return ['on-end-reached-threshold', 'has-next-page'];
  }

  // 属性变化时的回调
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    
    if (name === 'on-end-reached-threshold') {
      this._onEndReachedThreshold = Number(newValue) || 0;
      if (this._bottomRef) {
        this._bottomRef.style.height = `${this._onEndReachedThreshold}rem`;
      }
    } else if (name === 'has-next-page') {
      this._hasNextPage = newValue !== null && newValue !== 'false';
      this._updateSlotVisibility();
    }
  }

  // 组件连接到 DOM 时
  connectedCallback() {
    // 初始化属性默认值
    this._onEndReachedThreshold = Number(this.getAttribute('on-end-reached-threshold')) || 0;
    this._hasNextPage = this.getAttribute('has-next-page') !== 'false';
    
    // 渲染组件
    this._render();
    
    // 初始化 IntersectionObserver
    this._observerRef = new IntersectionObserver(this._callback, {
      threshold: 0.0,
    });
    
    if (this._bottomRef) {
      this._observerRef.observe(this._bottomRef);
    }
  }

  // 组件从 DOM 断开连接时
  disconnectedCallback() {
    // 清理 IntersectionObserver
    if (this._observerRef) {
      this._observerRef.disconnect();
      this._observerRef = null;
    }
  }

  // IntersectionObserver 回调
  _callback(entries) {
    const [target] = entries;
    if (!(target.intersectionRatio > 0)) return;
    
    // 触发自定义事件
    this.dispatchEvent(new CustomEvent('endreached', {
      bubbles: true,
      composed: true
    }));
  }

  // 更新插槽可见性
  _updateSlotVisibility() {
    const loadingSlot = this.shadowRoot.querySelector('.loading-slot');
    const noDataSlot = this.shadowRoot.querySelector('.no-data-slot');
    
    if (loadingSlot && noDataSlot) {
      loadingSlot.className = this._hasNextPage ? 'loading-slot contents' : 'loading-slot hidden';
      noDataSlot.className = this._hasNextPage ? 'no-data-slot hidden' : 'no-data-slot contents';
    }
  }

  // 渲染组件
  _render() {
    // 添加样式
    const styleElement = document.createElement('style');
    styleElement.textContent = style;
    this.shadowRoot.appendChild(styleElement);
    
    // 创建容器
    const container = document.createElement('div');
    container.setAttribute('part', 'container');
    container.className = 'relative';
    
    // 创建底部观察元素
    this._bottomRef = document.createElement('div');
    this._bottomRef.className = 'absolute bottom-0 z-[-1]';
    this._bottomRef.style.height = `${this._onEndReachedThreshold}rem`;
    
    // 创建内容插槽
    const defaultSlot = document.createElement('slot');
    
    // 创建加载中插槽
    const loadingSlot = document.createElement('div');
    loadingSlot.className = this._hasNextPage ? 'loading-slot contents' : 'loading-slot hidden';
    
    const loadingContent = document.createElement('div');
    loadingContent.className = 'flex items-center justify-center py-3';
    loadingContent.innerHTML = `
      <svg class="w-6 h-6 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
        <circle cx="7" cy="7" r="6" stroke="var(--storke-circle,#DDF7CC)" stroke-width="2"/>
        <path stroke="var(--storke-path, #5DB443)" stroke-width="2" d="M7 1a6 6 0 0 1 5.313 3.21"/>
      </svg>
    `;
    
    const loadingNamedSlot = document.createElement('slot');
    loadingNamedSlot.setAttribute('name', 'loading');
    
    loadingSlot.appendChild(loadingNamedSlot);
    loadingSlot.appendChild(loadingContent);
    
    // 创建无数据插槽
    const noDataSlot = document.createElement('div');
    noDataSlot.className = this._hasNextPage ? 'no-data-slot hidden' : 'no-data-slot contents';
    
    const noDataContent = document.createElement('div');
    noDataContent.className = 'text-sm text-gray-600 text-center py-6';
    noDataContent.textContent = 'no more content ～';
    
    const noDataNamedSlot = document.createElement('slot');
    noDataNamedSlot.setAttribute('name', 'no-data');
    
    noDataSlot.appendChild(noDataNamedSlot);
    noDataSlot.appendChild(noDataContent);
    
    // 组装组件
    container.appendChild(this._bottomRef);
    container.appendChild(defaultSlot);
    container.appendChild(loadingSlot);
    container.appendChild(noDataSlot);
    
    this.shadowRoot.appendChild(container);
  }
}

// 注册自定义元素
customElements.define('osp-scroll-view', ScrollView);
