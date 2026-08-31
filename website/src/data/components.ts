/**
 * 组件注册表：文档站所有组件列表的唯一来源
 * 新增组件时在此添加条目，首页卡片自动更新
 */
export interface ComponentMeta {
  /** 自定义元素标签名 */
  name: string;
  /** npm 包名 */
  pkg: string;
  /** packages/ 下的目录名（同时是 public/components/ 下的产物目录名） */
  dir: string;
  desc: Record<'zh-CN' | 'en', string>;
  /** 文档页相对链接（相对当前语言根路径，浏览器按页面 URL 解析，自动兼容 base） */
  docs: Record<'zh-CN' | 'en', string>;
}

export const components: ComponentMeta[] = [
  {
    name: '<infinite-scroll-list>',
    pkg: '@wc-lib/infinite-scroll-list',
    dir: 'infinite-scroll-list',
    desc: {
      'zh-CN':
        '无限滚动加载组件：滚动触底自动加载、移动端下拉刷新、自定义加载与空态插槽。',
      en: 'Infinite scroll loading with pull-to-refresh and custom loading / no-data slots.',
    },
    docs: {
      'zh-CN': 'components/infinite-scroll-list/',
      en: 'components/infinite-scroll-list/',
    },
  },
];
