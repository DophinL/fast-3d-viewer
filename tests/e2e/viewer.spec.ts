import { expect, test } from '@playwright/test';

test('opens the calibration model, renders WebGL, and exposes diagnostics', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /See the model/ })).toBeVisible();
  await page.getByRole('button', { name: /calibration model/i }).click();
  await expect(page.locator('.viewport-badge')).toContainText('fast-viewer-calibration.stl', { timeout: 20_000 });
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'scene' })).toBeVisible();
  await page.getByRole('tab', { name: 'health' }).click();
  await page.getByRole('button', { name: /Run topology scan/i }).click();
  await expect(page.getByText(/Topology checks passed|Open boundary edges/)).toBeVisible({ timeout: 10_000 });
  expect(errors).toEqual([]);
});

test('adapts the workbench for mobile without losing core controls', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'Mobile-only layout assertion');
  await page.goto('/');
  await page.getByRole('button', { name: /calibration model/i }).click();
  await expect(page.locator('.viewport-badge')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Frame model' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'health' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Open another/i })).toBeVisible();
});
