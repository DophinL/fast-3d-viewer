import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { buildAssetIssues, collectGeometryPayloads, inspectAsset } from '../../src/core/inspect';
import { createFileBundle } from '../../src/core/file-bundle';

describe('asset inspection', () => {
  it('counts render cost and dimensions from real Three.js geometry', async () => {
    const root = new Group();
    const material = new MeshStandardMaterial({ map: new Texture() });
    root.add(new Mesh(new BoxGeometry(2, 4, 6), material));
    const bundle = await createFileBundle([new File(['solid box'], 'box.stl')]);
    const stats = inspectAsset(root, bundle, 0, 24, 18);

    expect(stats.meshes).toBe(1);
    expect(stats.triangles).toBe(12);
    expect(stats.vertices).toBe(24);
    expect(stats.textures).toBe(1);
    expect(stats.hasNormals).toBe(true);
    expect(stats.dimensions).toMatchObject({ x: 2, y: 4, z: 6 });
    expect(stats.loadDurationMs).toBe(24);
  });

  it('creates topology payloads with world transforms applied by the worker', () => {
    const root = new Group();
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial());
    mesh.position.set(10, 20, 30);
    root.add(mesh);
    const result = collectGeometryPayloads(root, 20);

    expect(result.scanLimited).toBe(false);
    expect(result.triangleCount).toBe(12);
    expect(result.payloads).toHaveLength(1);
    expect(result.payloads[0]?.matrix[12]).toBe(10);
  });

  it('reports scene-level risks with actionable severity', async () => {
    const root = new Group();
    root.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
    const bundle = await createFileBundle([new File(['solid box'], 'box.stl')]);
    const issues = buildAssetIssues(inspectAsset(root, bundle, 0, 1, 1));

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'stl-units', severity: 'info' }),
    ]));
  });
});
