// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

/** 中文侧边栏 */
const zhSidebar = [
  {
    label: '指南',
    items: [{ autogenerate: { directory: 'guides' } }],
  },
  {
    label: '组件',
    items: [{ autogenerate: { directory: 'components' } }],
  },
];

/** 英文侧边栏 */
const enSidebar = [
  {
    label: 'Guides',
    items: [{ autogenerate: { directory: 'guides' } }],
  },
  {
    label: 'Components',
    items: [{ autogenerate: { directory: 'components' } }],
  },
];

export default defineConfig({
  // GitHub Pages 项目站点：https://luokaibin.github.io/infinite-scroll-list/
  // 若仓库改名（如 web-components），同步修改 site 与 base
  site: 'https://luokaibin.github.io',
  base: '/infinite-scroll-list',
  integrations: [
    starlight({
      title: 'WC Lib',
      description: '基于 Web Component 的通用组件集合',
      defaultLocale: 'zh-CN',
      locales: {
        'zh-CN': {
          label: '简体中文',
          lang: 'zh-CN',
          root: true,
          sidebar: zhSidebar,
        },
        en: {
          label: 'English',
          lang: 'en',
          sidebar: enSidebar,
        },
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/luokaibin/infinite-scroll-list',
        },
      ],
      customCss: ['./src/custom.css'],
    }),
  ],
});
