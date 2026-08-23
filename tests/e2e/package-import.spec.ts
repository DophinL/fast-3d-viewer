import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';

test('opens an OBJ and MTL together as one local package', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').first().setInputFiles([
    {
      name: 'package-test.obj',
      mimeType: 'text/plain',
      buffer: Buffer.from([
        'mtllib package-test.mtl',
        'o package_triangle',
        'v -1 0 0',
        'v 1 0 0',
        'v 0 1.5 0',
        'vn 0 0 1',
        'usemtl brass',
        'f 1//1 2//1 3//1',
      ].join('\n')),
    },
    {
      name: 'package-test.mtl',
      mimeType: 'text/plain',
      buffer: Buffer.from('newmtl brass\nKd 0.72 0.55 0.25\nNs 40\n'),
    },
  ]);

  await expect(page.locator('.viewport-badge')).toContainText('package-test.obj', { timeout: 20_000 });
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('2 files')).toBeVisible();
  await expect(page.getByText('Online3DViewer', { exact: false })).toBeVisible();
});

test('reports a recoverable error for a package without a model', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('This package does not contain a 3D model.'),
  });

  await expect(page.getByRole('alert')).toContainText('No supported 3D file was found');
  await expect(page.getByRole('heading', { name: /A 3D viewer/ })).toBeVisible();
});

test('shows the registered capability matrix without loading a model', async ({ page }) => {
  await page.goto('/');
  const formatsButton = page.getByRole('button', { name: /Formats 27/i });
  if (!(await formatsButton.isVisible())) {
    await page.getByRole('button', { name: 'Toggle menu' }).click();
  }
  await formatsButton.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('STEP', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Point Cloud Data', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: /Close format/i }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
});
