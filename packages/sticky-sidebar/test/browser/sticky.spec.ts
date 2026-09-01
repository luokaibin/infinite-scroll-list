import { expect } from '@playwright/test';

import { test as base } from '@playwright/test';

const HOST = '/packages/sticky-sidebar/test/fixtures/host.html';
const VIEWPORT_H = 800;

// 项目级 devices['Desktop Chrome'] 会覆盖顶层 viewport，这里显式固定测试视口
const test = base.extend({});
test.use({ viewport: { width: 600, height: VIEWPORT_H } });

export { test };

async function setup(
  page: import('@playwright/test').Page,
  opts: { attrs?: Record<string, string>; innerHeight?: number } = {},
) {
  await page.goto(HOST);
  await page.evaluate((o) => __s.setup(o), opts);
}

test.describe('sticky-sidebar（真实浏览器 + matchMedia/ResizeObserver/rAF）', () => {
  test('加载即注册，默认断点 1024', async ({ page }) => {
    await setup(page, { innerHeight: 500 });
    expect(
      await page.evaluate(() => customElements.get('sticky-sidebar') !== undefined),
    ).toBe(true);

    const status = await page.evaluate(() => __s.status());
    expect(status.breakpoint).toBe(1024);
    // 视口 600 < 1024，低于断点
    expect(status.isAboveBreakpoint).toBe(false);
    expect(status.isStickyActive).toBe(false);
  });

  test('内容高于视口且高于断点：top 应用负偏移（内容高 - 视口高）', async ({ page }) => {
    await setup(page, { attrs: { 'min-width': '500' }, innerHeight: 1000 });
    const ch = await page.evaluate(() => __s.contentHeight());

    await expect
      .poll(() => page.evaluate(() => __s.top()), { timeout: 5000 })
      .toBe(`-${ch - VIEWPORT_H}px`);

    const status = await page.evaluate(() => __s.status());
    expect(status.isAboveBreakpoint).toBe(true);
    expect(status.isStickyActive).toBe(true);
  });

  test('内容低于视口：top 保持原始值（无偏移）', async ({ page }) => {
    await setup(page, { attrs: { 'min-width': '500' }, innerHeight: 500 });

    await page.waitForTimeout(600);
    expect(await page.evaluate(() => __s.top())).toBe('');
  });

  test('setBreakpoint 高于视口宽度：禁用吸顶并恢复 top', async ({ page }) => {
    await setup(page, { attrs: { 'min-width': '500' }, innerHeight: 1000 });
    const ch1 = await page.evaluate(() => __s.contentHeight());
    await expect
      .poll(() => page.evaluate(() => __s.top()), { timeout: 5000 })
      .toBe(`-${ch1 - VIEWPORT_H}px`);

    const returned = await page.evaluate(() => __s.setBreakpoint(1200));
    expect(returned).toBe(1200);

    await expect
      .poll(() => page.evaluate(() => __s.top()), { timeout: 5000 })
      .toBe('');
    const status = await page.evaluate(() => __s.status());
    expect(status.breakpoint).toBe(1200);
    expect(status.isAboveBreakpoint).toBe(false);
    expect(status.isStickyActive).toBe(false);
  });

  test('min-width 属性变化触发重新初始化', async ({ page }) => {
    await setup(page, { attrs: { 'min-width': '500' }, innerHeight: 1000 });
    const ch2 = await page.evaluate(() => __s.contentHeight());
    await expect
      .poll(() => page.evaluate(() => __s.top()), { timeout: 5000 })
      .toBe(`-${ch2 - VIEWPORT_H}px`);

    await page.evaluate(() => __s.setAttr('min-width', '1200'));
    await expect
      .poll(() => page.evaluate(() => __s.top()), { timeout: 5000 })
      .toBe('');
    expect(await page.evaluate(() => __s.status().breakpoint)).toBe(1200);
  });

  test('forceRecalculation 冒烟：重算后状态一致', async ({ page }) => {
    await setup(page, { attrs: { 'min-width': '500' }, innerHeight: 1000 });
    const ch3 = await page.evaluate(() => __s.contentHeight());
    await expect
      .poll(() => page.evaluate(() => __s.top()), { timeout: 5000 })
      .toBe(`-${ch3 - VIEWPORT_H}px`);

    await page.evaluate(() => __s.el.forceRecalculation());
    await expect
      .poll(() => page.evaluate(() => __s.top()), { timeout: 5000 })
      .toBe(`-${ch3 - VIEWPORT_H}px`);
    expect(await page.evaluate(() => __s.status().isStickyActive)).toBe(true);
  });
});
