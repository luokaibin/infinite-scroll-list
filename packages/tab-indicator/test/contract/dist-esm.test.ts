import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pkgDir = fileURLToPath(new URL('../../', import.meta.url));
const dist = (f: string) => pathToFileURL(pkgDir + 'dist/' + f).href;
const pkg = JSON.parse(readFileSync(pkgDir + 'package.json', 'utf-8'));

describe('ESM 产物（npm 主通道）', () => {
  it('Node/SSR 导入为 no-op：不抛错、不触碰浏览器 API', async () => {
    const m = await import(dist('index.esm.js'));

    expect(typeof (globalThis as any).HTMLElement).toBe('undefined');
    expect(typeof (globalThis as any).customElements).toBe('undefined');

    expect(m.version).toBe(pkg.version);
    expect(typeof m.TabIndicator).toBe('function');
    expect(typeof m.registerTabIndicator).toBe('function');
  });
});
