import { expect, test } from '@playwright/test';

test('switches display materials and restores the source material', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await page.getByRole('button', { name: /calibration sample/i }).click();
  await expect(page.locator('.viewport-badge')).toBeVisible({ timeout: 20_000 });

  const style = page.getByRole('button', { name: 'Rendering style' });
  await style.click();
  await page.getByRole('button', { name: 'normals', exact: true }).click();
  await style.click();
  await page.getByRole('button', { name: 'wireframe', exact: true }).click();
  await style.click();
  await page.getByRole('button', { name: 'material', exact: true }).click();

  await expect(page.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
