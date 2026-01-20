# 无限滚动加载组件 (infinite-scroll-list)

这是一个基于Web Component技术开发的无限滚动加载组件，支持自定义加载状态和无数据状态，适用于各种滚动加载场景。

## 特性

- 使用Web Component技术，可在任何现代浏览器中使用
- 支持设置触发加载的距离阈值
- 支持外部控制是否还有下一页
- 支持自定义加载中和无数据状态的显示
- 支持在body或任何overflow-y: auto/scroll的容器中使用
- 自适应父元素大小变化
- 只在有下一页时触发加载事件，避免重复加载
- 支持下拉刷新功能（移动端专用）
- 支持自定义下拉刷新样式和动画

## 安装

```bash
# 使用pnpm安装依赖
pnpm install

# 构建组件
pnpm build
```

## 使用方法

### 基本用法

```html
<infinite-scroll-list
  id="scrollView"
  on-end-reached-threshold="100"
  has-next-page="true"
>
  <div id="list-container">
    <!-- 列表内容 -->
  </div>
  
  <!-- 自定义加载中显示 -->
  <div slot="loading">正在加载更多数据...</div>
  
  <!-- 自定义无数据显示 -->
  <div slot="no-data">已经到底啦，没有更多数据了！</div>
</infinite-scroll-list>

<script>
  const scrollView = document.getElementById('scrollView');
  scrollView.addEventListener('end-reached', async () => {
    // 加载更多数据的逻辑
    // 注意：只有当has-next-page为true时才会触发此事件
    const moreData = await fetchMoreData();
    
    // 更新列表内容
    updateListContent(moreData);
    
    // 如果没有更多数据，更新has-next-page属性
    if (!hasMoreData) {
      scrollView.setAttribute('has-next-page', 'false');
    }
  });
</script>
```

### 下拉刷新用法

```html
<infinite-scroll-list
  id="scrollView"
  on-end-reached-threshold="100"
  has-next-page="true"
  enable-refresh="true"
  refresh-threshold="80"
  is-refreshing="false"
>
  <!-- 下拉刷新插槽 -->
  <div slot="refresh" class="my-refresh-spinner">
    <svg class="refresh-icon" viewBox="0 0 24 24">
      <!-- 刷新图标 -->
    </svg>
    <span>下拉刷新</span>
  </div>

  <div id="list-container">
    <!-- 列表内容 -->
  </div>
  
  <div slot="loading">加载中...</div>
  <div slot="no-data">没有更多了</div>
</infinite-scroll-list>

<script>
  const scrollView = document.getElementById('scrollView');
  
  // 监听下拉进度（可选，用于动画效果）
  scrollView.addEventListener('refresh-pulling', (e) => {
    const { progress } = e.detail;
    const icon = scrollView.querySelector('.refresh-icon');
    if (icon) {
      icon.style.transform = `rotate(${progress * 360}deg)`;
    }
  });
  
  // 监听下拉刷新事件
  scrollView.addEventListener('refresh', async () => {
    scrollView.setAttribute('is-refreshing', 'true');
    
    try {
      await reloadData(); // 调用接口刷新数据
    } finally {
      scrollView.setAttribute('is-refreshing', 'false'); // 刷新完成后收回
    }
  });

  // 监听触底加载
  scrollView.addEventListener('end-reached', () => {
    loadMoreData();
  });

  // 程序化触发刷新（例如点击顶部 Logo）
  const logo = document.getElementById('logo');
  logo.addEventListener('click', () => {
    // 自动平滑滚动到顶部并同步展开刷新容器
    scrollView.scrollToTopAndRefresh();
  });
</script>
```

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| on-end-reached-threshold | Number | 0 | 距离底部多少像素时触发加载事件 |
| has-next-page | Boolean | false | 是否还有下一页数据 |
| enable-refresh | Boolean | false | 是否启用下拉刷新功能（移动端专用） |
| refresh-threshold | Number | 60 | 下拉多少像素时触发刷新事件 |
| is-refreshing | Boolean | false | 是否正在刷新中，刷新完成后应设置为 false |

### 事件

| 事件名 | 说明 |
| --- | --- |
| end-reached | 滚动到底部时触发，只有当has-next-page为true时才会触发 |
| refresh | 下拉刷新时触发，只有当enable-refresh为true且达到refresh-threshold时才会触发 |
| refresh-pulling | 下拉过程中触发，用于显示下拉进度（detail包含distance、threshold、progress） |

### 方法

| 方法名 | 参数 | 返回值 | 说明 |
| --- | --- | --- | --- |
| scrollToTop | 无 | `Promise<void>` | 平滑滚动到顶部，并等待滚动结束。 |
| scrollToTopAndRefresh | 无 | `Promise<void>` | **原子化刷新**：平滑滚动到顶部的同时并行展开刷新容器，并触发 `refresh` 事件。 |

### 插槽

| 插槽名 | 说明 |
| --- | --- |
| default | 默认插槽，用于放置列表内容 |
| loading | 加载中状态的显示内容（当 `has-next-page="true"` 且滚动到底部时显示） |
| no-data | 没有更多数据时的显示内容（当 `has-next-page="false"` 时显示） |
| refresh | 下拉刷新时显示的内容（仅在移动端且 `enable-refresh="true"` 时显示） |

## 核心优化点说明

本项目近期通过以下深度优化提升了性能和体验：

1.  **状态驱动 UI**：完全移除手动 DOM 修改逻辑，利用 CSS 选择器响应属性变化，渲染效率更高。
2.  **原子化刷新**：`scrollToTopAndRefresh` 采用并行化设计，滚动与容器展开动画同步进行，视觉反馈更灵敏。
3.  **智能容器查找**：利用 `ResizeObserver` 实时监听布局变化并缓存滚动容器引用，大幅减少高频事件中的 DOM 遍历开销。
4.  **事件绑定简化**：采用类字段箭头函数，消除内存泄露隐患并精简样板代码。

## 示例

查看 `example/index.html` 获取完整示例。

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式（监听文件变化自动构建）
pnpm dev

# 启动示例服务器
pnpm serve
```

## 浏览器兼容性

支持所有现代浏览器，包括：

- Chrome
- Firefox
- Safari
- Edge

## 许可证

MIT
