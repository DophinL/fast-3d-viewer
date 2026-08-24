import { Vector3 } from 'three';

export type MeasurementKind = 'distance' | 'angle' | 'radius';
export type MeasurementUnit = 'unit' | 'millimeter' | 'centimeter' | 'meter' | 'inch' | 'foot';

export interface MeasurementPoint {
  x: number;
  y: number;
  z: number;
}

export interface MeasurementResult {
  kind: MeasurementKind;
  points: MeasurementPoint[];
  value: number;
  secondaryValue?: number;
}

export interface CircumcircleResult {
  center: MeasurementPoint;
  radius: number;
  normal: MeasurementPoint;
}

export const MEASUREMENT_POINT_COUNTS: Readonly<Record<MeasurementKind, number>> = Object.freeze({
  distance: 2,
  angle: 3,
  radius: 3,
});

export const MEASUREMENT_UNIT_LABELS: Readonly<Record<MeasurementUnit, string>> = Object.freeze({
  unit: 'units',
  millimeter: 'mm',
  centimeter: 'cm',
  meter: 'm',
  inch: 'in',
  foot: 'ft',
});

const unitScale: Readonly<Record<MeasurementUnit, number>> = Object.freeze({
  unit: 1,
  millimeter: 1,
  centimeter: 0.1,
  meter: 0.001,
  inch: 1 / 25.4,
  foot: 1 / 304.8,
});

function asVector(point: MeasurementPoint): Vector3 {
  return new Vector3(point.x, point.y, point.z);
}

function asPoint(vector: Vector3): MeasurementPoint {
  return { x: vector.x, y: vector.y, z: vector.z };
}

export function measureDistance(points: readonly MeasurementPoint[]): number | null {
  if (points.length < 2) return null;
  return asVector(points[0]!).distanceTo(asVector(points[1]!));
}

export function measureAngle(points: readonly MeasurementPoint[]): number | null {
  if (points.length < 3) return null;
  const vertex = asVector(points[1]!);
  const first = asVector(points[0]!).sub(vertex);
  const second = asVector(points[2]!).sub(vertex);
  if (first.lengthSq() < Number.EPSILON || second.lengthSq() < Number.EPSILON) return null;
  return first.angleTo(second) * 180 / Math.PI;
}

export function findCircumcircle(points: readonly MeasurementPoint[]): CircumcircleResult | null {
  if (points.length < 3) return null;
  const a = asVector(points[0]!);
  const b = asVector(points[1]!);
  const c = asVector(points[2]!);
  const ab = b.clone().sub(a);
  const ac = c.clone().sub(a);
  const normal = ab.clone().cross(ac);
  const denominator = 2 * normal.lengthSq();
  if (denominator < 1e-14) return null;

  const first = ac.clone().cross(normal).multiplyScalar(ab.lengthSq());
  const second = normal.clone().cross(ab).multiplyScalar(ac.lengthSq());
  const center = a.clone().add(first.add(second).multiplyScalar(1 / denominator));
  return {
    center: asPoint(center),
    radius: center.distanceTo(a),
    normal: asPoint(normal.normalize()),
  };
}

export function createMeasurement(kind: MeasurementKind, points: readonly MeasurementPoint[]): MeasurementResult | null {
  if (points.length < MEASUREMENT_POINT_COUNTS[kind]) return null;
  if (kind === 'distance') {
    const value = measureDistance(points);
    return value === null ? null : { kind, points: points.slice(0, 2), value };
  }
  if (kind === 'angle') {
    const value = measureAngle(points);
    return value === null ? null : { kind, points: points.slice(0, 3), value };
  }
  const circle = findCircumcircle(points);
  return circle ? { kind, points: points.slice(0, 3), value: circle.radius, secondaryValue: circle.radius * 2 } : null;
}

export function formatMeasurement(result: MeasurementResult, unit: MeasurementUnit): string {
  if (result.kind === 'angle') return `${formatNumber(result.value)}°`;
  const scaled = result.value * unitScale[unit];
  return `${formatNumber(scaled)} ${MEASUREMENT_UNIT_LABELS[unit]}`;
}

export function formatNumber(value: number): string {
  const absolute = Math.abs(value);
  const maximumFractionDigits = absolute >= 1000 ? 1 : absolute >= 10 ? 2 : absolute >= 1 ? 3 : 4;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value);
}
