# 使用web component技术开发一个滚动加载组件

## 功能描述
1. 支持传入距离底部的距离
2. 支持外部传入是否还有下一页

## 技术需求
1. 使用web component技术开发
2. 支持以属性的方式传入一个参数，告诉内部是否还有下一页
3. 支持两个 slot，一个用于加载中的状态，一个用于没有数据的状态；**不需要有默认值**
4. 当外部传入没有下一页的时候，展示没有数据的状态；当外部传入还有下一页的时候，展示加载中的状态
5. 支持在body中使用，也支持在在父或祖先元素overflow-y: auto的元素中使用
6. 需要自适应大小，即由于它父元素的宽高变化，它自身也会随着变化,自适应由webComponent组件内部自行处理
7. 不需要特别考虑浏览器兼容性
8. 项目结构为单文件组件，使用rollup对这个文件进行打包压缩；打包格式为 iife
9. 提供一个演示页面，用于展示组件的用法的使用方法
10. 演示页面可以使用http-server进行启动，http-server已经全局安装了
11. 包管理工具使用pnpm
12. 使用typescript进行开发
13. 可以参考scroll-view/index.js的代码，但是这个仅实现了滚动加载没有实现虚拟列表，另外也不完全满足需求
14. 设计文档和参考代码不一致的地方，以文档为主
15. 组件只在has-next-page为true时触发end-reached事件，避免在没有更多数据时重复触发加载事件

## 用户使用设计
```
<infinite-scroll-list
  id="scrollView"
  on-end-reached-threshold="10"
  has-next-page="true"
>
  <div id="list-container">
    <!-- 初始数据将通过 JS 加载 -->
  </div>
  
  <!-- 自定义加载中显示 (可选) -->
  <div slot="loading" class="custom-loading">正在加载更多数据...</div>
  
  <!-- 自定义无数据显示 (可选) -->
  <div slot="no-data" class="custom-no-data">已经到底啦，没有更多数据了！</div>
</infinite-scroll-list>
<script>
const scrollView = document.getElementById('scrollView');
scrollView.addEventListener('end-reached', async () => {
  // TODO: 加载更多数据
  // 注意：只有当has-next-page为true时才会触发此事件
});
</script>