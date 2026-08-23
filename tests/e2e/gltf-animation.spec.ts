import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';

function animatedTriangleGltf(): string {
  const bytes = Buffer.alloc(76);
  const positions = new Float32Array([-1, 0, 0, 1, 0, 0, 0, 1.5, 0]);
  Buffer.from(positions.buffer).copy(bytes, 0);
  const indices = new Uint16Array([0, 1, 2]);
  Buffer.from(indices.buffer).copy(bytes, 36);
  const times = new Float32Array([0, 1]);
  Buffer.from(times.buffer).copy(bytes, 44);
  const translations = new Float32Array([0, 0, 0, 0, 0.5, 0]);
  Buffer.from(translations.buffer).copy(bytes, 52);

  return JSON.stringify({
    asset: { version: '2.0', generator: 'Fast 3D Viewer regression fixture' },
    buffers: [{ byteLength: bytes.byteLength, uri: `data:application/octet-stream;base64,${bytes.toString('base64')}` }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
      { buffer: 0, byteOffset: 44, byteLength: 8 },
      { buffer: 0, byteOffset: 52, byteLength: 24 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-1, 0, 0], max: [1, 1.5, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
      { bufferView: 2, componentType: 5126, count: 2, type: 'SCALAR', min: [0], max: [1] },
      { bufferView: 3, componentType: 5126, count: 2, type: 'VEC3' },
    ],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.72, 0.47, 0.22, 1], roughnessFactor: 0.7 } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    nodes: [{ name: 'animated-triangle', mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
    animations: [{
      name: 'rise',
      samplers: [{ input: 2, output: 3, interpolation: 'LINEAR' }],
      channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }],
    }],
  });
}

test('uses the fast glTF path and retains animation clips', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'animated-triangle.gltf',
    mimeType: 'model/gltf+json',
    buffer: Buffer.from(animatedTriangleGltf()),
  });

  await expect(page.locator('.viewport-badge')).toContainText('animated-triangle.gltf', { timeout: 20_000 });
  await expect(page.getByText('Fast native loader', { exact: true })).toBeVisible();
  await expect(page.getByText('Animations').locator('..').getByText('1', { exact: true })).toBeVisible();
});
