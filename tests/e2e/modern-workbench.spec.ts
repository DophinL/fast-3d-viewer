import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';

test('renders the hero emphasis as text without an opaque gradient box', async ({ page }) => {
  await page.goto('/');
  const emphasis = page.locator('.welcome-copy h1 em');
  await expect(emphasis).toBeVisible();
  const style = await emphasis.evaluate((element) => {
    const computed = window.getComputedStyle(element);
    return {
      backgroundImage: computed.backgroundImage,
      color: computed.color,
      textFillColor: computed.getPropertyValue('-webkit-text-fill-color'),
    };
  });
  expect(style.backgroundImage).toBe('none');
  expect(style.color).not.toBe('rgba(0, 0, 0, 0)');
  expect(style.textFillColor).not.toBe('transparent');
});

test('serves independent task pages with route-specific metadata and content', async ({ page }) => {
  await page.goto('/stl-viewer/');
  await expect(page).toHaveTitle(/STL Viewer Online/);
  await expect(page.getByRole('heading', { name: /Open an STL/ })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /stl-viewer\/$/);
  await expect(page.getByText(/STL does not define a universal front or up axis/)).toBeAttached();
});

test('returns to the product home from an independent viewer route', async ({ page }) => {
  await page.goto('/vrm-viewer/');
  const brand = page.getByRole('link', { name: 'Modern 3D Workbench home' });
  const expectedHome = await page.evaluate(() => {
    const entry = document.querySelector<HTMLScriptElement>('script[type="module"]');
    if (!entry) throw new Error('Module entry script is missing');
    return new URL('../', entry.src).toString();
  });

  await expect(brand).toHaveAttribute('href', expectedHome);
  await brand.click();
  await expect(page).toHaveURL(expectedHome);
  await expect(page.locator('.welcome-copy h1')).toContainText('See the model');
});

test('opens an independently parsed DotBIM element scene', async ({ page }) => {
  const fixture = {
    schema_version: '1.1.0',
    meshes: [{ mesh_id: 1, coordinates: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] }],
    elements: [{
      mesh_id: 1,
      vector: { x: 0, y: 0, z: 0 },
      rotation: { qx: 0, qy: 0, qz: 0, qw: 1 },
      guid: 'fixture-wall',
      type: 'Wall',
      color: { r: 80, g: 160, b: 220, a: 255 },
      info: { Level: 'Ground' },
    }],
    info: { Source: 'Playwright fixture' },
  };
  await page.goto('/');
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'one-wall.bim',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await expect(page.locator('.viewport-badge')).toContainText('one-wall.bim', { timeout: 20_000 });
  await expect(page.getByText('DotBIM', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Modern native loader', { exact: false })).toBeVisible();
});

test('opens IFC through the self-hosted Web-IFC runtime and retains element identity', async ({ page }) => {
  test.setTimeout(120_000);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await page.locator('input[type="file"]').first().setInputFiles('tests/fixtures/minimal-triangle.ifc');
  await expect(page.locator('.viewport-badge')).toContainText('minimal-triangle.ifc', { timeout: 60_000 });
  await expect(page.getByText('IFC', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: /Scene graph/i }).click();
  await expect(page.locator('.inspector-panel').getByText('Triangle', { exact: true }).first()).toBeVisible();
  expect(requests.some((url) => url.includes('/runtime/web-ifc/web-ifc.wasm'))).toBe(true);
  expect(requests.some((url) => url.includes('unpkg.com') || url.includes('cdn.jsdelivr.net'))).toBe(false);
});

test('exposes measurement, orientation, annotation, and clipping controls', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /calibration model/i }).click();
  await expect(page.locator('.viewport-badge')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Measure, annotate, orient, and section/i }).click();
  const tools = page.locator('.model-tools');
  await expect(tools).toBeVisible();

  await tools.getByRole('button', { name: /Distance/ }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-interaction-mode', 'distance');
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  // The active tool collapses into a lower dock, leaving the model's upper area unobstructed.
  await page.mouse.click(box!.x + box!.width * 0.55, box!.y + box!.height * 0.3);
  await page.mouse.click(box!.x + box!.width * 0.65, box!.y + box!.height * 0.35);
  await expect(tools.locator('.measurement-readout')).not.toContainText('PICK 1 OF 2');

  await tools.getByRole('button', { name: /Show all model tools/i }).click();
  await tools.getByRole('checkbox', { name: /Enable clipping/i }).check();
  await expect(tools.getByRole('checkbox', { name: /Enable clipping/i })).toBeChecked();
  await tools.locator('.orientation-grid').getByRole('button', { name: '+90°' }).first().click();
  await expect(tools.getByText(/These transforms are explicit/)).toBeVisible();
});

test('runs the versioned public benchmark and exposes machine-readable results', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/benchmark/');
  await page.getByRole('button', { name: 'Run benchmark' }).click();
  await expect(page.locator('.benchmark-results')).toBeVisible({ timeout: 120_000 });
  const report = await page.evaluate(() => window.__MODERN_3D_BENCHMARK__);
  expect(report?.schema).toBe('modern-3d-workbench/benchmark@1');
  expect(report?.cases).toHaveLength(3);
  expect(report?.cases.every((result) => result.samplesMs.length === 7)).toBe(true);
});
