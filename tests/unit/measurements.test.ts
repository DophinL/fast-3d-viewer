import { describe, expect, it } from 'vitest';
import {
  createMeasurement,
  findCircumcircle,
  formatMeasurement,
  measureAngle,
  measureDistance,
} from '../../src/core/measurements';

describe('measurement math', () => {
  it('measures a 3D segment without projecting it to the camera plane', () => {
    expect(measureDistance([{ x: 0, y: 0, z: 0 }, { x: 2, y: 3, z: 6 }])).toBe(7);
  });

  it('uses the middle point as the angle vertex', () => {
    const angle = measureAngle([
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    ]);
    expect(angle).toBeCloseTo(90, 8);
  });

  it('returns null for degenerate angle arms', () => {
    expect(measureAngle([
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ])).toBeNull();
  });

  it('finds a circumcircle in an arbitrarily oriented plane', () => {
    const circle = findCircumcircle([
      { x: 2, y: 0, z: 1 },
      { x: 1, y: 1, z: 1 },
      { x: 0, y: 0, z: 1 },
    ]);
    expect(circle?.center).toEqual({ x: 1, y: 0, z: 1 });
    expect(circle?.radius).toBeCloseTo(1, 8);
    expect(Math.abs(circle?.normal.z ?? 0)).toBeCloseTo(1, 8);
  });

  it('formats unit assumptions separately from angular results', () => {
    const distance = createMeasurement('distance', [{ x: 0, y: 0, z: 0 }, { x: 25.4, y: 0, z: 0 }])!;
    const angle = createMeasurement('angle', [{ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }])!;
    expect(formatMeasurement(distance, 'inch')).toBe('1 in');
    expect(formatMeasurement(angle, 'millimeter')).toBe('90°');
  });
});
