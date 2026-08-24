import { expect, test } from '@playwright/test';

// Regression: ISSUE-002 — Inspector min-content height pushed the model below the viewport
// Found by /qa on 2026-08-24
// Report: .gstack/qa-reports/qa-report-127-0-0-1-2026-08-24.md
test('keeps the workbench canvas inside the visible application row', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /calibration model/i }).click();
  await expect(page.locator('.viewport-badge')).toBeVisible({ timeout: 20_000 });

  const layout = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>('.app-main')!;
    const workbench = document.querySelector<HTMLElement>('.workbench')!;
    const viewport = document.querySelector<HTMLElement>('.viewport')!;
    return { main: main.clientHeight, workbench: workbench.clientHeight, viewport: viewport.clientHeight };
  });

  expect(layout.workbench).toBeLessThanOrEqual(layout.main);
  expect(layout.viewport).toBeLessThan(layout.main);
  expect(layout.viewport).toBeGreaterThan(400);
});
