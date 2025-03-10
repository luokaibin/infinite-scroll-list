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

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| on-end-reached-threshold | Number | 0 | 距离底部多少像素时触发加载事件 |
| has-next-page | Boolean | false | 是否还有下一页数据 |

### 事件

| 事件名 | 说明 |
| --- | --- |
| end-reached | 滚动到底部时触发，只有当has-next-page为true时才会触发 |

### 插槽

| 插槽名 | 说明 |
| --- | --- |
| default | 默认插槽，用于放置列表内容 |
| loading | 加载中状态的显示内容 |
| no-data | 没有更多数据时的显示内容 |

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
