import { expect, test, type Download, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function downloadFrom(page: Page, buttonName: RegExp): Promise<{ download: Download; bytes: Buffer }> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: buttonName }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error(`Playwright did not retain ${download.suggestedFilename()}.`);
  return { download, bytes: await readFile(path) };
}

test('downloads non-empty, recognizable files from every exporter', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /calibration sample/i }).click();
  await expect(page.locator('.viewport-badge')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('tab', { name: 'export' }).click();

  const glb = await downloadFrom(page, /Download GLB/);
  expect(glb.download.suggestedFilename()).toMatch(/\.glb$/);
  expect(glb.bytes.subarray(0, 4).toString('ascii')).toBe('glTF');

  const gltf = await downloadFrom(page, /Download glTF/);
  expect(JSON.parse(gltf.bytes.toString('utf8')).asset.version).toBe('2.0');

  const obj = await downloadFrom(page, /Download OBJ/);
  expect(obj.bytes.toString('utf8')).toMatch(/^o |\nv /m);
  expect(obj.bytes.toString('utf8')).toMatch(/\nf /);

  const stl = await downloadFrom(page, /Download STL/);
  expect(stl.bytes.byteLength).toBeGreaterThanOrEqual(84);

  const ply = await downloadFrom(page, /Download PLY/);
  expect(ply.bytes.subarray(0, 3).toString('ascii')).toBe('ply');

  const usdz = await downloadFrom(page, /Download USDZ/);
  expect(usdz.bytes.subarray(0, 2).toString('ascii')).toBe('PK');
});
