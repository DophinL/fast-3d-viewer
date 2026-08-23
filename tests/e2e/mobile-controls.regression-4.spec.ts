import { expect, test } from '@playwright/test';

// Regression: ISSUE-004 — Mobile CSS removed camera recovery controls
// Found by /qa on 2026-08-24
// Report: .gstack/qa-reports/qa-report-127-0-0-1-2026-08-24.md
test('keeps camera recovery controls reachable on a phone', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'Mobile viewport regression');
  await page.goto('/');
  await page.getByRole('button', { name: /calibration sample/i }).click();
  await expect(page.locator('.viewport-badge')).toBeVisible({ timeout: 20_000 });

  const frame = page.getByRole('button', { name: 'Frame model' });
  await expect(frame).toBeAttached();
  await frame.scrollIntoViewIfNeeded();
  await expect(frame).toBeVisible();
  await frame.click();
  await expect(page.locator('canvas')).toBeVisible();
});
