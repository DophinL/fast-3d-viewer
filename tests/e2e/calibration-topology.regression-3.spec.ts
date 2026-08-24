import { expect, test } from '@playwright/test';

// Regression: ISSUE-003 — Calibration sample had four inconsistent directed edges
// Found by /qa on 2026-08-24
// Report: .gstack/qa-reports/qa-report-127-0-0-1-2026-08-24.md
test('uses a consistently wound watertight calibration mesh', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /calibration model/i }).click();
  await expect(page.locator('.viewport-badge')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('tab', { name: 'health' }).click();
  await page.getByRole('button', { name: /Run topology scan/i }).click();
  await expect(page.getByText('WATERTIGHT')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Topology checks passed')).toBeVisible();
  await expect(page.getByText('Inconsistent face orientation')).toHaveCount(0);
});
