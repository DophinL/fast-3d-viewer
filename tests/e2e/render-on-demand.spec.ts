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
  await page.getByRole('button', { name: /calibration sample/i }).click();
  await expect(page.locator('.viewport-badge')).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1_000);

  const before = await page.evaluate(() => (window as Window & { __fastViewerRafCount?: number }).__fastViewerRafCount ?? 0);
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => (window as Window & { __fastViewerRafCount?: number }).__fastViewerRafCount ?? 0);

  expect(after - before).toBeLessThanOrEqual(2);
});
