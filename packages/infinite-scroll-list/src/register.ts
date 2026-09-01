import { defineCustomElement } from '@wc-lib/runtime';
import { InfiniteScrollList } from './element.js';
import { version } from './version.js';

/**
 * 注册自定义元素
 * defineCustomElement 内部自带环境与重复注册守卫：
 * - 服务端（SSR/Node）调用为 no-op
 * - 同名元素已存在时跳过注册并输出多版本并存告警
 * 可安全地被多个入口多次调用
 */
export function registerInfiniteScrollList(): void {
  defineCustomElement('infinite-scroll-list', InfiniteScrollList, {
    onDuplicate: () => {
      console.warn(
        `[@wc-lib/infinite-scroll-list] v${version} 注册被跳过：同名自定义元素已存在，页面可能存在多个版本并存`
      );
    },
  });
}
