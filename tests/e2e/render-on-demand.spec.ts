import { expect, test } from '@playwright/test';

test('stops scheduling animation frames after a static scene settles', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as Window & { __fastViewerRafCount?: number };
    state.__fastViewerRafCount = 0;
    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback: FrameRequestCallback) => nativeRequestAnimationFrame((time) => {
      state.__fastViewerRafCount = (state.__fastViewerRafCount ?? 0) + 1;
      callback(time);
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: /calibration model/i }).click();
  await expect(page.locator('.viewport-badge')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1_000);

  const before = await page.evaluate(() => (window as Window & { __fastViewerRafCount?: number }).__fastViewerRafCount ?? 0);
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => (window as Window & { __fastViewerRafCount?: number }).__fastViewerRafCount ?? 0);

  expect(after - before).toBeLessThanOrEqual(2);
});

test('never clears the drawing buffer after rendering an interaction frame', async ({ page }) => {
  await page.addInitScript(() => {
    type RenderTrace = { callback: number; event: 'draw' | 'resize' };
    const state = window as Window & { __fastViewerRenderTrace?: RenderTrace[] };
    state.__fastViewerRenderTrace = [];
    let activeCallback = 0;
    let callbackSequence = 0;

    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback: FrameRequestCallback) => nativeRequestAnimationFrame((time) => {
      activeCallback = ++callbackSequence;
      const startedAt = performance.now();
      while (performance.now() - startedAt < 38) { /* Simulate a slow interaction frame. */ }
      try {
        callback(time);
      } finally {
        activeCallback = 0;
      }
    });

    for (const property of ['width', 'height'] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, property);
      if (!descriptor?.get || !descriptor.set) continue;
      Object.defineProperty(HTMLCanvasElement.prototype, property, {
        configurable: descriptor.configurable,
        enumerable: descriptor.enumerable,
        get() {
          // The original DOM accessor must receive the canvas as `this`.
          // eslint-disable-next-line @typescript-eslint/unbound-method
          return Reflect.apply(descriptor.get!, this, []);
        },
        set(value: number) {
          state.__fastViewerRenderTrace?.push({ callback: activeCallback, event: 'resize' });
          // eslint-disable-next-line @typescript-eslint/unbound-method
          Reflect.apply(descriptor.set!, this, [value]);
        },
      });
    }

    const instrumentDraws = (prototype: object) => {
      for (const method of ['drawArrays', 'drawElements'] as const) {
        const original = (prototype as Record<string, unknown>)[method];
        if (typeof original !== 'function') continue;
        (prototype as Record<string, unknown>)[method] = function (...args: unknown[]) {
          state.__fastViewerRenderTrace?.push({ callback: activeCallback, event: 'draw' });
          return (original as (...parameters: unknown[]) => unknown).apply(this, args);
        };
      }
    };
    instrumentDraws(WebGLRenderingContext.prototype);
    if ('WebGL2RenderingContext' in window) instrumentDraws(WebGL2RenderingContext.prototype);
  });

  await page.goto('/');
  await page.getByRole('button', { name: /calibration model/i }).click();
  await expect(page.locator('.viewport-badge')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Auto rotate' }).click();
  await page.waitForTimeout(2_200);
  await page.getByRole('button', { name: 'Auto rotate' }).click();

  const callbacks = await page.evaluate(() => {
    const trace = (window as Window & { __fastViewerRenderTrace?: Array<{ callback: number; event: 'draw' | 'resize' }> }).__fastViewerRenderTrace ?? [];
    const grouped = new Map<number, Array<'draw' | 'resize'>>();
    for (const item of trace) grouped.set(item.callback, [...(grouped.get(item.callback) ?? []), item.event]);
    return [...grouped.entries()];
  });
  const clearsAfterDraw = callbacks.filter(([, events]) => {
    const lastDraw = events.lastIndexOf('draw');
    return lastDraw >= 0 && events.slice(lastDraw + 1).includes('resize');
  }).filter(([callback]) => callback > 0);

  expect(clearsAfterDraw).toEqual([]);
});
