import { expect, test } from '@playwright/test';

// Regression: ISSUE-001 — WebGL context failure unmounted the whole application
// Found by /qa on 2026-08-24
// Report: .gstack/qa-reports/qa-report-127-0-0-1-2026-08-24.md
test('keeps the landing page usable when WebGL cannot initialize', async ({ page }) => {
  await page.addInitScript(() => {
    // Intentionally preserve the native receiver and restore it with `call` below.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return original.call(this, type as never, ...(args as []));
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /See the model/ })).toBeVisible();
  await expect(page.getByText('3D rendering is unavailable in this session.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open files' })).toBeVisible();
});
