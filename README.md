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
│       ├── test/              # 测试
│       │   ├── contract/      # 契约测试（Vitest/Node：dist/SSR/packaging）
│       │   ├── browser/       # 组件测试（Playwright + CDP 可信输入）
│       │   └── fixtures/      # 测试宿主页
│       ├── example/           # 示例页面
│       ├── rollup.config.js   # 构建配置（使用共享工厂）
│       └── package.json       # 组件包配置（独立发布）
├── internal/                  # 内部共享基建（private，不发布）
│   ├── build-config/          # 共享 Rollup 配置工厂（ESM + IIFE 双产物）
│   ├── runtime/               # 共享运行时工具（defineCustomElement 防重复注册守卫，
│   │                          #   以源码形式内联进各组件产物）
│   └── test-utils/            # 共享测试工具（CDP 触摸手势序列封装）
├── .github/workflows/         # CI：测试 / npm 发布 / GitHub Pages 部署
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

## 测试

两层测试体系（无单元测试层，行为验证由真实浏览器承担）：

- **契约测试**（`test/contract/`，Vitest/Node）：从构建产物视角守护分发承诺——ESM 产物 Node/SSR 导入为 no-op、IIFE 加载即注册、exports 映射与类型完整、publint 零 error、版本号一致性
- **组件测试**（`test/browser/`，Playwright + CDP 可信输入）：真实 Chromium 中验证行为——真实滚动触底（IntersectionObserver）、CDP 触摸手势的下拉刷新全流程（含 progress 中间态断言）、ResizeObserver 容器切换重建

```bash
pnpm test:contract   # 构建产物 + 契约测试
pnpm test:browser    # 构建产物 + 组件测试（自动拉起静态服务器）
pnpm test            # 全部
```

共享手势工具库见 `internal/test-utils/`（CDP 触摸序列封装，新组件测试直接复用）。

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
   - 测试：`test/contract/` 契约用例可直接复用（替换包名即可），行为用例参考 `test/browser/`
3. 根目录执行 `pnpm install` 注册新包
4. 在上方组件列表中添加条目

组件会被 `pnpm build`（`pnpm -r run build`）自动纳入批量构建，发布时通过 Release 触发 `pnpm -r publish` 自动发布。

## 浏览器兼容性

所有组件基于标准 Web Component 技术，支持所有现代浏览器（Chrome / Firefox / Safari / Edge）。

## 许可证

MIT
