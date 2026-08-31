/**
 * 组件入口（SSR 安全）
 *
 * - 元素基类与注册逻辑均做了环境检测，服务端（Node / SSR）导入本模块
 *   不会执行任何浏览器代码，等同 no-op
 * - 浏览器环境下导入即完成 <tab-indicator> 注册
 *
 * 用法：`import '@wc-lib/tab-indicator'`
 */
import { registerTabIndicator } from './register.js';

export { TabIndicator } from './element.js';
export { registerTabIndicator } from './register.js';
export { version } from './version.js';

registerTabIndicator();
