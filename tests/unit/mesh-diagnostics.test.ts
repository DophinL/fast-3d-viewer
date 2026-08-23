import { describe, expect, it } from 'vitest';
import { analyze, repair } from '../../src/workers/mesh-diagnostics.worker';
import type { GeometryPayload, RepairOptions } from '../../src/core/types';

const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function payload(positions: number[]): GeometryPayload {
  return { id: 'fixture', positions: new Float32Array(positions), indices: null, matrix: identity };
}

const repairOptions: RepairOptions = {
  removeDegenerate: true,
  removeDuplicates: true,
  mergeTolerance: 0,
  fillSimpleHoles: false,
  maxHoleEdges: 128,
  centerGeometry: false,
};

describe('mesh diagnostics worker algorithms', () => {
  it('never labels an empty or all-degenerate scene as watertight', () => {
    const empty = analyze([], false);
    const degenerate = analyze([payload([0, 0, 0, 0, 0, 0, 1, 0, 0])], false);

    expect(empty.watertight).toBe(false);
    expect(empty.issues[0]?.code).toBe('empty-geometry');
    expect(degenerate.watertight).toBe(false);
    expect(degenerate.degenerateFaces).toBe(1);
    expect(degenerate.issues[0]?.code).toBe('empty-geometry');
  });

  it('reports open, isolated, duplicate, and non-manifold topology', () => {
    const open = analyze([payload([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
    ])], false);
    const duplicate = analyze([payload([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 0, 1, 0, 0, 0, 1, 0,
    ])], false);
    expect(open.boundaryEdges).toBe(3);
    expect(open.isolatedFaces).toBe(1);
    expect(duplicate.duplicateFaces).toBe(1);
    expect(duplicate.issues.some((issue) => issue.code === 'duplicates')).toBe(true);

    const nonManifold = analyze([payload([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      1, 0, 0, 0, 0, 0, 0, -1, 0,
      0, 0, 0, 1, 0, 0, 0, 0, 1,
    ])], false);
    expect(nonManifold.nonManifoldEdges).toBe(1);
    expect(nonManifold.issues.some((issue) => issue.code === 'non-manifold')).toBe(true);
  });

  it('returns the explicit scan-limit result without analyzing geometry', () => {
    const result = analyze([payload([0, 0, 0, 1, 0, 0, 0, 1, 0])], true);
    expect(result.scanLimited).toBe(true);
    expect(result.scannedTriangles).toBe(0);
    expect(result.issues[0]?.code).toBe('scan-limit');
  });

  it('adds absolute volume across closed shells with opposite winding', () => {
    const tetra = (offset: number, reverse: boolean) => {
      const vertices = [
        [offset, 0, 0], [offset + 1, 0, 0], [offset, 1, 0], [offset, 0, 1],
      ];
      const faces = [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]];
      return faces.flatMap((face) => (reverse ? [...face].reverse() : face).flatMap((index) => vertices[index]!));
    };
    const result = analyze([payload([...tetra(0, false), ...tetra(3, true)])], false);

    expect(result.watertight).toBe(true);
    expect(result.signedVolume).toBeCloseTo(1 / 3, 6);
  });

  it('honors degenerate and duplicate removal options', () => {
    const source = payload([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 0, 0, 0, 0, 1, 0, 0,
    ]);
    const cleaned = repair([source], repairOptions);
    const retained = repair([source], { ...repairOptions, removeDegenerate: false, removeDuplicates: false });

    expect(cleaned.removedFaces).toBe(2);
    expect(cleaned.afterTriangles).toBe(1);
    expect(retained.removedFaces).toBe(0);
    expect(retained.afterTriangles).toBe(3);
  });

  it('fills a simple planar boundary and centers the repaired copy', () => {
    const source = payload([2, 0, 0, 4, 0, 0, 2, 2, 0]);
    const result = repair([source], { ...repairOptions, fillSimpleHoles: true, centerGeometry: true });
    const values = [...result.positions];
    const xs = values.filter((_, index) => index % 3 === 0);
    const ys = values.filter((_, index) => index % 3 === 1);

    expect(result.filledHoles).toBe(1);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(0);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(0);
  });
});
