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

test('opens an XYZ point cloud without leaving the loading state stuck', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'points.xyz',
    mimeType: 'text/plain',
    buffer: Buffer.from('0 0 0\n1 0 0\n0 1 0\n'),
  });

  await expect(page.locator('.viewport-badge')).toContainText('points.xyz', { timeout: 20_000 });
  await expect(page.locator('canvas')).toBeVisible();
});

test('opens STEP through the npm compatibility engine using same-origin runtimes', async ({ page }) => {
  test.setTimeout(120_000);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await page.locator('input[type="file"]').first().setInputFiles('node_modules/occt-import-js/test/testfiles/simple-basic-cube/cube.stp');

  await expect(page.locator('.viewport-badge')).toContainText('cube.stp', { timeout: 60_000 });
  await expect(page.getByText('Online3DViewer', { exact: false })).toBeVisible();
  expect(requests.some((url) => url.includes('/runtime/occt/occt-import-js-worker.js'))).toBe(true);
  expect(requests.some((url) => url.includes('cdn.jsdelivr.net'))).toBe(false);
});

test('blocks absolute network companions declared by a local model', async ({ page }) => {
  let trackerRequested = false;
  await page.route('https://tracker.example/**', async (route) => {
    trackerRequested = true;
    await route.abort();
  });
  await page.goto('/');
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'private.gltf',
    mimeType: 'model/gltf+json',
    buffer: Buffer.from(JSON.stringify({
      asset: { version: '2.0' },
      buffers: [{ uri: 'https://tracker.example/model-opened.bin', byteLength: 42 }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
        { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
        { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
      ],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
      nodes: [{ mesh: 0 }],
      scenes: [{ nodes: [0] }],
      scene: 0,
    })),
  });

  await expect(page.getByRole('alert')).toContainText('Blocked external resource', { timeout: 20_000 });
  expect(trackerRequested).toBe(false);
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

test('resolves remote glTF companions against the source URL', async ({ page }) => {
  const geometry = Buffer.alloc(42);
  Buffer.from(new Float32Array([-1, 0, 0, 1, 0, 0, 0, 1.5, 0]).buffer).copy(geometry, 0);
  Buffer.from(new Uint16Array([0, 1, 2]).buffer).copy(geometry, 36);
  let companionRequested = false;
  await page.route('https://fixtures.example/**', async (route) => {
    if (route.request().url().endsWith('/models/geometry.bin')) {
      companionRequested = true;
      await route.fulfill({ body: geometry, contentType: 'application/octet-stream' });
      return;
    }
    await route.fulfill({
      contentType: 'model/gltf+json',
      body: JSON.stringify({
        asset: { version: '2.0' },
        buffers: [{ uri: 'geometry.bin', byteLength: 42 }],
        bufferViews: [
          { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
          { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
        ],
        accessors: [
          { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-1, 0, 0], max: [1, 1.5, 0] },
          { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
        ],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
        nodes: [{ mesh: 0 }],
        scenes: [{ nodes: [0] }],
        scene: 0,
      }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Open URL' }).click();
  await page.getByLabel('Public model URL').fill('https://fixtures.example/models/scene.gltf');
  await page.getByRole('button', { name: 'Load model' }).click();

  await expect(page.locator('.viewport-badge')).toContainText('scene.gltf', { timeout: 20_000 });
  expect(companionRequested).toBe(true);
});

test('keeps URL import recoverable after protocol and HTTP failures', async ({ page }) => {
  await page.route('https://fixtures.example/missing.glb', (route) => route.fulfill({ status: 503, body: 'offline' }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Open URL' }).click();
  const input = page.getByLabel('Public model URL');

  await input.fill('ftp://fixtures.example/model.glb');
  await page.getByRole('button', { name: 'Load model' }).click();
  await expect(page.getByRole('alert')).toContainText('Only HTTP and HTTPS');
  await page.getByRole('button', { name: 'Dismiss error' }).click();

  await input.fill('https://fixtures.example/missing.glb');
  await page.getByRole('button', { name: 'Load model' }).click();
  await expect(page.getByRole('alert')).toContainText('HTTP 503');
  await expect(page.getByRole('heading', { name: /A 3D viewer/ })).toBeVisible();
});

test('does not let a slower previous load replace the latest model', async ({ page }) => {
  const stl = 'solid race\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid race\n';
  await page.route('https://fixtures.example/race/**', async (route) => {
    if (route.request().url().endsWith('slow.stl')) await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fulfill({ body: stl, contentType: 'model/stl' });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open URL' }).click();
  const input = page.getByLabel('Public model URL');
  await input.fill('https://fixtures.example/race/slow.stl');
  await page.getByRole('button', { name: 'Load model' }).click();
  await input.fill('https://fixtures.example/race/latest.stl');
  await page.getByRole('button', { name: 'Load model' }).click();

  await expect(page.locator('.viewport-badge')).toContainText('latest.stl', { timeout: 20_000 });
  await page.waitForTimeout(800);
  await expect(page.locator('.viewport-badge')).toContainText('latest.stl');
});
