import { expect, test } from '@playwright/test';

const HOST = '/packages/tab-indicator/test/fixtures/host.html';

async function setup(
  page: import('@playwright/test').Page,
  attrs: Record<string, string> = {},
  tabCount = 4,
) {
  await page.goto(HOST);
  await page.evaluate(
    ({ a, n }) => __t.setup({ attrs: a, tabCount: n }),
    { a: attrs, n: tabCount },
  );
}

test.describe('tab-indicator（真实浏览器 + MutationObserver/ResizeObserver）', () => {
  test('加载即注册，默认 effect=underline', async ({ page }) => {
    await setup(page);
    expect(
      await page.evaluate(() => customElements.get('tab-indicator') !== undefined),
    ).toBe(true);
    expect(await page.evaluate(() => __t.effectAttr())).toBe('underline');
  });

  test('初始指示条定位到激活 tab（宽度与水平位移一致）', async ({ page }) => {
    await setup(page);
    await expect
      .poll(() => page.evaluate(() => __t.indicator().width))
      .toBeGreaterThan(0);

    const ind = await page.evaluate(() => __t.indicator());
    const tab0 = await page.evaluate(() => __t.tabRect(0));
    expect(ind.width).toBe(tab0.offsetWidth);
    expect(ind.transform).toContain(`translateX(${tab0.offsetLeft}px)`);
  });

  test('切换激活 tab 后指示条更新到新位置', async ({ page }) => {
    await setup(page);
    await expect
      .poll(() => page.evaluate(() => __t.indicator().width))
      .toBeGreaterThan(0);

    await page.evaluate(() => __t.activate(2));
    await expect
      .poll(() => page.evaluate(() => __t.indicator().transform))
      .toContain('translateX(');

    const ind = await page.evaluate(() => __t.indicator());
    const tab2 = await page.evaluate(() => __t.tabRect(2));
    expect(ind.width).toBe(tab2.offsetWidth);
    expect(ind.transform).toContain(`translateX(${tab2.offsetLeft}px)`);
  });

  test('capsule 效果：高度跟随 tab 高度', async ({ page }) => {
    await setup(page, { effect: 'capsule' });
    await expect
      .poll(() => page.evaluate(() => __t.indicator().width))
      .toBeGreaterThan(0);

    const ind = await page.evaluate(() => __t.indicator());
    const tab0 = await page.evaluate(() => __t.tabRect(0));
    expect(ind.height).toBe(tab0.offsetHeight);
  });

  test('无激活 tab 时指示条宽度归零', async ({ page }) => {
    await setup(page);
    await expect
      .poll(() => page.evaluate(() => __t.indicator().width))
      .toBeGreaterThan(0);

    await page.evaluate(() => __t.clearActive());
    await expect
      .poll(() => page.evaluate(() => __t.indicator().width))
      .toBe(0);
  });
});
