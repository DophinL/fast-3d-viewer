import { Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { parseDotBim } from '../../src/core/loaders/dotbim';

function document(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    schema_version: '1.1.0',
    meshes: [{ mesh_id: 7, coordinates: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2] }],
    elements: [{
      mesh_id: 7,
      vector: { x: 2, y: 3, z: 4 },
      rotation: { qx: 0, qy: 0, qz: 0, qw: 1 },
      guid: 'wall-guid',
      type: 'Wall',
      color: { r: 12, g: 34, b: 56, a: 128 },
      info: { Level: 'Ground' },
    }],
    info: { Author: 'Fixture' },
    ...overrides,
  });
}

describe('DotBIM parser', () => {
  it('builds transformed elements with data and RGBA material', () => {
    const parsed = parseDotBim(document());
    expect(parsed.schemaVersion).toBe('1.1.0');
    expect(parsed.meshDefinitions).toBe(1);
    expect(parsed.elementCount).toBe(1);
    expect(parsed.root.userData.info).toEqual({ Author: 'Fixture' });
    const wall = parsed.root.children[0] as Mesh;
    expect(wall.name).toBe('Wall');
    expect(wall.position.toArray()).toEqual([2, 3, 4]);
    expect(wall.userData.guid).toBe('wall-guid');
    expect(wall.userData.info).toEqual({ Level: 'Ground' });
    const material = wall.material as MeshStandardMaterial;
    expect(material.opacity).toBeCloseTo(128 / 255, 6);
    expect(material.transparent).toBe(true);
  });

  it('expands indexed geometry for per-face colors', () => {
    const source = JSON.parse(document()) as Record<string, unknown>;
    const elements = source.elements as Array<Record<string, unknown>>;
    elements[0] = { ...elements[0], face_colors: [255, 0, 0, 255] };
    const parsed = parseDotBim(JSON.stringify(source));
    const mesh = parsed.root.children[0] as Mesh;
    expect(mesh.geometry.getIndex()).toBeNull();
    expect(mesh.geometry.getAttribute('color').itemSize).toBe(4);
    expect(mesh.geometry.getAttribute('color').count).toBe(3);
  });

  it('rejects missing mesh references and unsafe indices', () => {
    const missing = JSON.parse(document()) as Record<string, unknown>;
    (missing.elements as Array<Record<string, unknown>>)[0]!.mesh_id = 99;
    expect(() => parseDotBim(JSON.stringify(missing))).toThrow(/missing mesh_id 99/i);

    const invalid = JSON.parse(document()) as Record<string, unknown>;
    const meshes = invalid.meshes as Array<Record<string, unknown>>;
    meshes[0]!.indices = [0, 1, 9];
    expect(() => parseDotBim(JSON.stringify(invalid))).toThrow(/outside its vertex table/i);
  });

  it('keeps newer schema support explicit instead of silently claiming conformance', () => {
    const parsed = parseDotBim(document({ schema_version: '2.0.0' }));
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings[0]).toMatch(/outside the tested/i);
  });
});
