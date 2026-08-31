import { describe, expect, it } from 'vitest';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pkgDir = fileURLToPath(new URL('../../', import.meta.url));
const dist = (f: string) => pathToFileURL(pkgDir + 'dist/' + f).href;

describe('IIFE 产物（CDN 兜底通道）', () => {
  it('加载即注册（以 stub 注册表模拟浏览器环境执行产物）', async () => {
    (globalThis as any).HTMLElement = class {};
    const defined: string[] = [];
    (globalThis as any).customElements = {
      get: () => undefined,
      define: (tag: string) => {
        defined.push(tag);
      },
    };
    (globalThis as any).window = {};

    await import(dist('sticky-sidebar.min.js'));

    expect(defined).toContain('sticky-sidebar');
  });
});
