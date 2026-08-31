import { expect, test } from '@playwright/test';

const HOST = '/packages/infinite-scroll-list/test/fixtures/host.html';

test.describe('触底加载（真实滚动 + 真实 IntersectionObserver）', () => {
  test('滚动到底触发 end-reached', async ({ page }) => {
    await page.goto(HOST);
    await page.evaluate(() =>
      __h.setup({ attrs: { 'has-next-page': 'true', 'on-end-reached-threshold': '50' } }),
    );

    await page.mouse.move(300, 200);
    await page.mouse.wheel(0, 3000);

    await expect
      .poll(
        () => page.evaluate(() => __h.count('end-reached')),
        { timeout: 5000 },
      )
      .toBeGreaterThanOrEqual(1);
  });

  test('has-next-page=false 时滚动到底不触发', async ({ page }) => {
    await page.goto(HOST);
    await page.evaluate(() =>
      __h.setup({ attrs: { 'has-next-page': 'false' } }),
    );

    await page.mouse.move(300, 200);
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(500);

    expect(await page.evaluate(() => __h.count('end-reached'))).toBe(0);
  });

  test('滚动容器切换：ResizeObserver 重建后可从 window 滚动触发', async ({ page }) => {
    await page.goto(HOST);
    await page.evaluate(() => __h.setup({ attrs: { 'has-next-page': 'true' } }));

    // 1) 初始：容器内滚动触发
    await page.evaluate(() => __h.setScrollTop(99999));
    await expect
      .poll(() => page.evaluate(() => __h.count('end-reached')))
      .toBeGreaterThanOrEqual(1);

    // 2) 容器高度自适应 + 取消滚动 → 真实 ResizeObserver 触发 → 重建探测（根变为 window）
    await page.evaluate(() => __h.expandContainer());
    await page.mouse.move(300, 400);
    await page.mouse.wheel(0, 5000);

    await expect
      .poll(
        () => page.evaluate(() => __h.count('end-reached')),
        { timeout: 5000 },
      )
      .toBeGreaterThanOrEqual(2);
  });
});
