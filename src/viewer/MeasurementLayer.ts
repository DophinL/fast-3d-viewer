import {
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import {
  createMeasurement,
  findCircumcircle,
  MEASUREMENT_POINT_COUNTS,
  type MeasurementKind,
  type MeasurementPoint,
  type MeasurementResult,
} from '../core/measurements';

const markerGeometry = new SphereGeometry(1, 16, 10);

export class MeasurementLayer {
  readonly group = new Group();
  private readonly markerMaterial = new MeshBasicMaterial({ color: new Color(0x7ddcff), depthTest: false });
  private readonly lineMaterial = new LineBasicMaterial({ color: new Color(0x7ddcff), depthTest: false });
  private points: MeasurementPoint[] = [];
  private kind: MeasurementKind | null = null;
  private markerScale = 0.01;
  private onResult?: (result: MeasurementResult | null, collected: number, required: number) => void;

  constructor() {
    this.group.name = 'Measurement overlay';
    this.group.renderOrder = 999;
  }

  setResultListener(listener: (result: MeasurementResult | null, collected: number, required: number) => void): void {
    this.onResult = listener;
  }

  setMarkerScale(scale: number): void {
    this.markerScale = Math.max(scale, 0.000001);
    this.group.children.forEach((child) => {
      if (child instanceof Mesh) child.scale.setScalar(this.markerScale);
    });
  }

  setKind(kind: MeasurementKind | null): void {
    if (this.kind === kind) return;
    this.kind = kind;
    this.clear();
  }

  addPoint(point: Vector3): MeasurementResult | null {
    if (!this.kind) return null;
    const required = MEASUREMENT_POINT_COUNTS[this.kind];
    if (this.points.length >= required) this.clearVisuals();
    this.points.push({ x: point.x, y: point.y, z: point.z });
    this.render();
    const result = createMeasurement(this.kind, this.points);
    this.onResult?.(result, this.points.length, required);
    return result;
  }

  clear(): void {
    this.points = [];
    this.clearVisuals();
    this.onResult?.(null, 0, this.kind ? MEASUREMENT_POINT_COUNTS[this.kind] : 0);
  }

  private render(): void {
    this.clearVisuals();
    for (const point of this.points) {
      const marker = new Mesh(markerGeometry, this.markerMaterial);
      marker.position.set(point.x, point.y, point.z);
      marker.scale.setScalar(this.markerScale);
      marker.renderOrder = 1000;
      this.group.add(marker);
    }
    if (this.points.length >= 2) {
      if (this.kind === 'angle' && this.points.length >= 3) {
        this.addLine([this.points[0]!, this.points[1]!, this.points[2]!]);
      } else {
        this.addLine(this.points.slice(0, 2));
      }
    }
    if (this.kind === 'radius' && this.points.length >= 3) this.addRadiusCircle();
  }

  private addLine(points: readonly MeasurementPoint[]): void {
    const geometry = new BufferGeometry().setFromPoints(points.map((point) => new Vector3(point.x, point.y, point.z)));
    const line = new Line(geometry, this.lineMaterial);
    line.renderOrder = 999;
    this.group.add(line);
  }

  private addRadiusCircle(): void {
    const circle = findCircumcircle(this.points);
    if (!circle) return;
    const center = new Vector3(circle.center.x, circle.center.y, circle.center.z);
    const normal = new Vector3(circle.normal.x, circle.normal.y, circle.normal.z);
    const basisX = new Vector3(1, 0, 0);
    if (Math.abs(normal.dot(basisX)) > 0.9) basisX.set(0, 1, 0);
    basisX.sub(normal.clone().multiplyScalar(basisX.dot(normal))).normalize();
    const basisY = normal.clone().cross(basisX).normalize();
    const segments = 64;
    const points: Vector3[] = [];
    for (let index = 0; index <= segments; index += 1) {
      const angle = index / segments * Math.PI * 2;
      points.push(center.clone()
        .addScaledVector(basisX, Math.cos(angle) * circle.radius)
        .addScaledVector(basisY, Math.sin(angle) * circle.radius));
    }
    const geometry = new BufferGeometry().setFromPoints(points);
    const line = new Line(geometry, this.lineMaterial);
    line.renderOrder = 999;
    this.group.add(line);
    this.addLine([circle.center, this.points[0]!]);
  }

  private clearVisuals(): void {
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      if (child instanceof Line) child.geometry.dispose();
    }
  }

  dispose(): void {
    this.clearVisuals();
    this.markerMaterial.dispose();
    this.lineMaterial.dispose();
  }
}
