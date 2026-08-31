import { expect, test } from '@playwright/test';
import { pullGesture } from '../../../../internal/test-utils/index.js';

const HOST = '/packages/infinite-scroll-list/test/fixtures/host.html';
const TOUCH_X = 300;
const START_Y = 200;

async function setup(
  page: import('@playwright/test').Page,
  attrs: Record<string, string> = {},
) {
  await page.goto(HOST);
  await page.evaluate((a) => __h.setup({ attrs: a }), attrs);
}

test.describe('下拉刷新（CDP 可信触摸手势）', () => {
  test('下拉超过阈值：触发 refresh、容器保持阈值高度、is-refreshing 置位', async ({
    page,
  }) => {
    await setup(page, { 'enable-refresh': 'true', 'refresh-threshold': '60' });

    await pullGesture(page, {
      x: TOUCH_X,
      startY: START_Y,
      distance: 160, // pow(160, 0.85) ≈ 74 > 60，达到阈值
      steps: 16,
    });

    expect(await page.evaluate(() => __h.count('refresh'))).toBe(1);
    expect(await page.evaluate(() => __h.refreshHeight())).toBe(60);
    expect(
      await page.evaluate(() => __h.el.getAttribute('is-refreshing')),
    ).toBe('true');
  });

  test('下拉未达阈值：回弹到 0、不触发 refresh', async ({ page }) => {
    await setup(page, { 'enable-refresh': 'true', 'refresh-threshold': '60' });

    await pullGesture(page, {
      x: TOUCH_X,
      startY: START_Y,
      distance: 80, // pow(80, 0.85) ≈ 46 < 60，未达阈值
      steps: 8,
    });

    expect(await page.evaluate(() => __h.count('refresh'))).toBe(0);
    await expect
      .poll(() => page.evaluate(() => __h.refreshHeight()))
      .toBe(0);
  });

  test('手势中间态：refresh-pulling progress 单调不减且 ≤ 1', async ({
    page,
  }) => {
    await setup(page, { 'enable-refresh': 'true', 'refresh-threshold': '60' });

    const progress: number[] = [];
    await pullGesture(page, {
      x: TOUCH_X,
      startY: START_Y,
      distance: 160,
      steps: 16,
      onStep: async () => {
        const last = await page.evaluate(() => {
          const pulls = __h.state.events.filter(
            (e) => e.type === 'refresh-pulling',
          );
          return pulls.length ? pulls[pulls.length - 1].progress : null;
        });
        if (last !== null) progress.push(last);
      },
    });

    expect(progress.length).toBeGreaterThan(3);
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1]);
      expect(progress[i]).toBeLessThanOrEqual(1);
    }
  });

  test('未启用 enable-refresh：刷新容器 display:none 且拖拽无任何刷新事件', async ({
    page,
  }) => {
    await setup(page); // enable-refresh 默认 false

    expect(await page.evaluate(() => __h.refreshDisplay())).toBe('none');

    await pullGesture(page, {
      x: TOUCH_X,
      startY: START_Y,
      distance: 160,
      steps: 16,
    });

    expect(await page.evaluate(() => __h.count('refresh'))).toBe(0);
    expect(await page.evaluate(() => __h.count('refresh-pulling'))).toBe(0);
  });

  test('scrollToTopAndRefresh：滚动归零并触发 refresh', async ({ page }) => {
    await setup(page, { 'enable-refresh': 'true', 'refresh-threshold': '60' });

    await page.evaluate(() => __h.setScrollTop(99999));
    await page.evaluate(() => __h.el.scrollToTopAndRefresh());

    await expect
      .poll(() => page.evaluate(() => __h.container.scrollTop), {
        timeout: 5000,
      })
      .toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => __h.count('refresh'))).toBeGreaterThanOrEqual(1);
  });
});
