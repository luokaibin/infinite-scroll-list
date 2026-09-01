import type { Page } from '@playwright/test';

export type { Page };

/**
 * 基于 CDP 的可信触摸序列：事件走 Chromium 真实输入管线（isTrusted: true），
 * 与真人手指操作对页面不可区分。组件的真实 touch handler、阻尼计算、
 * rAF 合帧都在真实管线事件上运行。
 */
export class TouchSequencer {
  private started = false;

  constructor(
    private session: any,
    private x: number,
    private y: number,
  ) {}

  async start(): Promise<void> {
    await this.session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: this.x, y: this.y }],
    });
    this.started = true;
  }

  async moveTo(x: number, y: number): Promise<void> {
    if (!this.started) throw new Error('TouchSequencer: call start() first');
    await this.session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y }],
    });
  }

  async end(): Promise<void> {
    await this.session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    this.started = false;
  }
}

/** 等待两帧，确保组件 rAF 合帧更新已完成 */
export async function rafSettled(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      ),
  );
}

export interface PullGestureOptions {
  x: number;
  startY: number;
  /** 向下拉动的总像素距离 */
  distance: number;
  steps?: number;
  /** 每步移动后回调（已等待 rAF 合帧），用于中间态断言 */
  onStep?: (step: number, total: number) => Promise<void>;
}

/** 在页面上执行一次完整的下拉手势（touchStart → N×touchMove → touchEnd） */
export async function pullGesture(
  page: Page,
  opts: PullGestureOptions,
): Promise<void> {
  const session: any = await page.context().newCDPSession(page);
  const seq = new TouchSequencer(session, opts.x, opts.startY);
  const steps = opts.steps ?? 10;

  await seq.start();
  for (let i = 1; i <= steps; i++) {
    await seq.moveTo(opts.x, opts.startY + (opts.distance * i) / steps);
    await rafSettled(page);
    await opts.onStep?.(i, steps);
  }
  await seq.end();
  session.detach().catch(() => {});
}
