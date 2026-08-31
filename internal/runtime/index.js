/**
 * 注册自定义元素（带防重复注册守卫）
 *
 * - 非浏览器环境（SSR / Node）直接跳过
 * - 已存在同名元素时不再注册（避免 "already defined" 崩溃），
 *   并回调 onDuplicate 供调用方输出版本冲突告警
 *
 * @param {string} tagName 自定义元素标签名
 * @param {CustomElementConstructor} ctor 元素构造器
 * @param {{ onDuplicate?: () => void }} [options]
 */
export function defineCustomElement(tagName, ctor, options = {}) {
  if (typeof customElements === 'undefined') return;

  if (customElements.get(tagName)) {
    if (options.onDuplicate) options.onDuplicate();
    return;
  }

  customElements.define(tagName, ctor);
}
