# Web Components 组件库

基于 Web Component 技术构建的通用组件集合，采用 pnpm workspace 管理的 monorepo。每个组件独立开发、独立构建、独立发布到 npm（`@wc-lib/*` scope）。

## 组件列表

| 组件 | 包名 | 说明 | 文档 |
| --- | --- | --- | --- |
| `<infinite-scroll-list>` | `@wc-lib/infinite-scroll-list` | 无限滚动加载组件，支持下拉刷新 | [文档](packages/infinite-scroll-list/README.md) |

## 仓库结构

```
.
├── packages/                  # 组件目录，每个子目录一个独立组件
│   └── infinite-scroll-list/  # 无限滚动加载组件
│       ├── src/               # 组件源码
│       ├── example/           # 示例页面
│       ├── rollup.config.js   # 构建配置
│       └── package.json       # 组件包配置（独立发布）
├── .github/workflows/         # CI：npm 发布 / GitHub Pages 部署
├── pnpm-workspace.yaml        # workspace 定义
└── package.json               # 根配置（私有，不发布）
```

## 开发

```bash
# 安装依赖（首次克隆后执行，会生成 pnpm-lock.yaml）
pnpm install

# 构建所有组件
pnpm build

# 监听模式构建所有组件
pnpm dev

# 启动组件示例服务器
cd packages/infinite-scroll-list && pnpm serve
```

## 新增组件

1. 在 `packages/` 下新建目录，如 `packages/your-component/`
2. 参考 `packages/infinite-scroll-list/` 创建 `package.json`（命名 `@wc-lib/your-component`）、`src/`、`rollup.config.js`、`tsconfig.json`
3. 根目录执行 `pnpm install` 注册新包
4. 在上方组件列表中添加条目

新组件会被 `pnpm build`（`pnpm -r run build`）自动纳入批量构建；发布通过 Release 触发 `pnpm -r publish` 自动发布到 npm。

## 浏览器兼容性

所有组件基于标准 Web Component 技术，支持所有现代浏览器（Chrome / Firefox / Safari / Edge）。

## 许可证

MIT
