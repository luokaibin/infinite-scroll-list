# Web Components 组件库

基于 Web Component 技术构建的通用组件集合，采用 pnpm workspace 管理的 monorepo。每个组件独立开发、独立构建、独立发布到 npm（`@wc-lib/*` scope）。

所有组件采用 **npm ESM 为主、CDN IIFE 兜底**的双产物分发策略：工程化项目通过 npm 导入（组件随业务 bundle 打包，无脚本加载竞态，入口 SSR 安全）；非工程化页面通过 `<script>` 引用 IIFE 产物。

## 组件列表

| 组件 | 包名 | 说明 | 文档 |
| --- | --- | --- | --- |
| `<infinite-scroll-list>` | `@wc-lib/infinite-scroll-list` | 无限滚动加载组件，支持下拉刷新 | [文档](packages/infinite-scroll-list/README.md) |

## 仓库结构

```
.
├── packages/                  # 组件目录，每个子目录一个独立组件（对外发布）
│   └── infinite-scroll-list/  # 无限滚动加载组件
│       ├── src/               # 组件源码
│       │   ├── element.ts     # 元素类定义（SSR-safe 基类）
│       │   ├── register.ts    # 注册逻辑（防重复注册守卫）
│       │   ├── index.ts       # 入口（服务端导入为 no-op）
│       │   └── version.ts     # 版本常量
│       ├── example/           # 示例页面
│       ├── rollup.config.js   # 构建配置（使用共享工厂）
│       └── package.json       # 组件包配置（独立发布）
├── internal/                  # 内部共享基建（private，不发布）
│   ├── build-config/          # 共享 Rollup 配置工厂（ESM + IIFE 双产物）
│   └── runtime/               # 共享运行时工具（defineCustomElement 防重复注册守卫，
│                              #   以源码形式内联进各组件产物）
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
2. 参考 `packages/infinite-scroll-list/` 搭建骨架：
   - `package.json`：包名 `@wc-lib/your-component`，devDependencies 引入 `@wc-lib/build-config` 与 `@wc-lib/runtime`（`workspace:*`）
   - `src/`：`element.ts`（元素类）+ `register.ts`（注册）+ `index.ts`（SSR-safe 入口）+ `version.ts`
   - `rollup.config.js`：调用共享工厂
     ```js
     import { createConfig } from '@wc-lib/build-config';

     export default createConfig({
       input: 'src/index.ts',
       esmFile: 'dist/index.esm.js',
       iifeFile: 'dist/your-component.min.js',
       iifeName: 'YourComponent',
     });
     ```
3. 根目录执行 `pnpm install` 注册新包
4. 在上方组件列表中添加条目

组件会被 `pnpm build`（`pnpm -r run build`）自动纳入批量构建，发布时通过 Release 触发 `pnpm -r publish` 自动发布。

## 浏览器兼容性

所有组件基于标准 Web Component 技术，支持所有现代浏览器（Chrome / Firefox / Safari / Edge）。

## 许可证

MIT
