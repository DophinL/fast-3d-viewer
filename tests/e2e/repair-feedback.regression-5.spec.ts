import { expect, test } from '@playwright/test';

test('keeps the repair result visible after replacing the active model', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /calibration model/i }).click();
  await expect(page.locator('.viewport-badge')).toContainText('fast-viewer-calibration.stl', {
    timeout: 20_000,
  });

  await page.getByRole('tab', { name: 'health' }).click();
  await page.getByRole('button', { name: /Run topology scan/i }).click();
  await expect(page.getByText(/Topology checks passed|Open boundary edges/)).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole('button', { name: /Create repaired copy/i }).click();

  await expect(page.locator('.repair-result')).toContainText('Repaired in');
  await expect(page.locator('.viewport-badge')).toContainText('fast-viewer-calibration-repaired.stl');
});
