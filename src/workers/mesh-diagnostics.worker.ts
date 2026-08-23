/// <reference lib="webworker" />

import type { AssetIssue, GeometryPayload, MeshDiagnostics, RepairOptions, RepairResult } from '../core/types';

interface Point { x: number; y: number; z: number }
interface Triangle { a: number; b: number; c: number; source: [Point, Point, Point] }
interface EdgeRecord { count: number; forward: number; reverse: number; faces: number[] }

type WorkerRequest =
  | { id: string; type: 'analyze'; payloads: GeometryPayload[]; scanLimited: boolean }
  | { id: string; type: 'repair'; payloads: GeometryPayload[]; options: RepairOptions };

type WorkerResponse =
  | { id: string; ok: true; type: 'analyze'; result: MeshDiagnostics }
  | { id: string; ok: true; type: 'repair'; result: RepairResult }
  | { id: string; ok: false; error: string };

const worker = typeof self === 'undefined' ? null : self as unknown as DedicatedWorkerGlobalScope;

const subtract = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: Point, b: Point): Point => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const length = (point: Point): number => Math.hypot(point.x, point.y, point.z);
const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y + a.z * b.z;
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (point: Point, value: number): Point => ({ x: point.x * value, y: point.y * value, z: point.z * value });

function transformPoint(x: number, y: number, z: number, matrix: Float32Array): Point {
  const w = matrix[3]! * x + matrix[7]! * y + matrix[11]! * z + matrix[15]!;
  const reciprocal = w ? 1 / w : 1;
  return {
    x: (matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!) * reciprocal,
    y: (matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!) * reciprocal,
    z: (matrix[2]! * x + matrix[6]! * y + matrix[10]! * z + matrix[14]!) * reciprocal,
  };
}

function readPoint(payload: GeometryPayload, vertexIndex: number): Point {
  const offset = vertexIndex * 3;
  return transformPoint(payload.positions[offset]!, payload.positions[offset + 1]!, payload.positions[offset + 2]!, payload.matrix);
}

function forEachTriangle(payloads: GeometryPayload[], callback: (a: Point, b: Point, c: Point) => void): number {
  let count = 0;
  for (const payload of payloads) {
    const elementCount = payload.indices?.length ?? payload.positions.length / 3;
    for (let offset = 0; offset + 2 < elementCount; offset += 3) {
      const a = payload.indices?.[offset] ?? offset;
      const b = payload.indices?.[offset + 1] ?? offset + 1;
      const c = payload.indices?.[offset + 2] ?? offset + 2;
      callback(readPoint(payload, a), readPoint(payload, b), readPoint(payload, c));
      count += 1;
    }
  }
  return count;
}

function getBounds(payloads: GeometryPayload[]): { min: Point; max: Point; diagonal: number } {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const payload of payloads) {
    for (let offset = 0; offset < payload.positions.length; offset += 3) {
      const point = transformPoint(payload.positions[offset]!, payload.positions[offset + 1]!, payload.positions[offset + 2]!, payload.matrix);
      min.x = Math.min(min.x, point.x); min.y = Math.min(min.y, point.y); min.z = Math.min(min.z, point.z);
      max.x = Math.max(max.x, point.x); max.y = Math.max(max.y, point.y); max.z = Math.max(max.z, point.z);
    }
  }
  const diagonal = Math.hypot(max.x - min.x, max.y - min.y, max.z - min.z);
  return { min, max, diagonal: Number.isFinite(diagonal) ? diagonal : 0 };
}

function createTopology(payloads: GeometryPayload[], requestedTolerance?: number) {
  const bounds = getBounds(payloads);
  const epsilon = Math.max(requestedTolerance ?? bounds.diagonal * 1e-6, 1e-8);
  const pointIds = new Map<string, number>();
  const points: Point[] = [];
  const edges = new Map<string, EdgeRecord>();
  const triangles: Triangle[] = [];
  const degenerateTriangles: Array<[Point, Point, Point]> = [];
  const faces = new Map<string, number>();
  let degenerateFaces = 0;
  let duplicateFaces = 0;
  let surfaceArea = 0;
  let signedVolume = 0;

  const pointKey = (point: Point) => `${Math.round(point.x / epsilon)},${Math.round(point.y / epsilon)},${Math.round(point.z / epsilon)}`;
  const getPointId = (point: Point): number => {
    const key = pointKey(point);
    const existing = pointIds.get(key);
    if (existing !== undefined) return existing;
    const id = points.length;
    pointIds.set(key, id);
    points.push(point);
    return id;
  };
  const addEdge = (from: number, to: number, faceIndex: number): void => {
    const key = from < to ? `${from}:${to}` : `${to}:${from}`;
    const record = edges.get(key) ?? { count: 0, forward: 0, reverse: 0, faces: [] };
    record.count += 1;
    if (from < to) record.forward += 1; else record.reverse += 1;
    record.faces.push(faceIndex);
    edges.set(key, record);
  };

  const triangleCount = forEachTriangle(payloads, (a, b, c) => {
    const ids = [getPointId(a), getPointId(b), getPointId(c)] as const;
    const doubleArea = length(cross(subtract(b, a), subtract(c, a)));
    if (new Set(ids).size < 3 || doubleArea <= epsilon * epsilon) {
      degenerateFaces += 1;
      degenerateTriangles.push([a, b, c]);
      return;
    }
    const faceKey = [...ids].sort((left, right) => left - right).join(':');
    if (faces.has(faceKey)) duplicateFaces += 1;
    else faces.set(faceKey, triangles.length);
    const faceIndex = triangles.length;
    triangles.push({ a: ids[0], b: ids[1], c: ids[2], source: [a, b, c] });
    addEdge(ids[0], ids[1], faceIndex);
    addEdge(ids[1], ids[2], faceIndex);
    addEdge(ids[2], ids[0], faceIndex);
    surfaceArea += doubleArea / 2;
    signedVolume += dot(a, cross(b, c)) / 6;
  });

  return { bounds, epsilon, points, edges, triangles, degenerateTriangles, triangleCount, degenerateFaces, duplicateFaces, surfaceArea, signedVolume };
}

export function analyze(payloads: GeometryPayload[], scanLimited: boolean): MeshDiagnostics {
  const startedAt = performance.now();
  if (scanLimited) {
    return {
      scannedTriangles: 0, uniqueVertices: 0, boundaryEdges: 0, nonManifoldEdges: 0, inconsistentEdges: 0,
      degenerateFaces: 0, duplicateFaces: 0, isolatedFaces: 0, surfaceArea: 0, signedVolume: 0,
      watertight: false, durationMs: 0, scanLimited: true,
      issues: [{ code: 'scan-limit', severity: 'info', title: 'Topology scan deferred', detail: 'The model exceeds the interactive scan limit. Scene-level checks are still available.', fix: 'Export or isolate a smaller mesh before running topology diagnostics.' }],
    };
  }
  const topology = createTopology(payloads);
  if (topology.triangles.length === 0) {
    return {
      scannedTriangles: 0, uniqueVertices: topology.points.length, boundaryEdges: 0, nonManifoldEdges: 0, inconsistentEdges: 0,
      degenerateFaces: topology.degenerateFaces, duplicateFaces: 0, isolatedFaces: 0, surfaceArea: 0, signedVolume: 0,
      watertight: false, durationMs: Math.round(performance.now() - startedAt), scanLimited: false,
      issues: [{ code: 'empty-geometry', severity: 'error', title: 'No usable triangles', detail: 'The scene contains no triangle surface that can be checked.', fix: 'Choose a mesh asset or confirm that the parser produced geometry.' }],
    };
  }
  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  let inconsistentEdges = 0;
  const faceNeighbors = new Uint16Array(topology.triangles.length);
  for (const edge of topology.edges.values()) {
    if (edge.count === 1) boundaryEdges += 1;
    if (edge.count > 2) nonManifoldEdges += 1;
    if (edge.count === 2 && (edge.forward === 2 || edge.reverse === 2)) inconsistentEdges += 1;
    if (edge.faces.length > 1) for (const face of edge.faces) faceNeighbors[face]! += edge.faces.length - 1;
  }
  let isolatedFaces = 0;
  for (const count of faceNeighbors) if (count === 0) isolatedFaces += 1;
  const watertight = boundaryEdges === 0 && nonManifoldEdges === 0 && topology.degenerateFaces === 0;
  const issues: AssetIssue[] = [];
  if (boundaryEdges > 0) issues.push({ code: 'open-boundary', severity: 'error', title: 'Open boundary edges', detail: `${boundaryEdges.toLocaleString()} edges belong to only one face, so the surface is open.`, fix: 'Fill intentional holes and reconnect cracks.', count: boundaryEdges });
  if (nonManifoldEdges > 0) issues.push({ code: 'non-manifold', severity: 'error', title: 'Non-manifold edges', detail: `${nonManifoldEdges.toLocaleString()} edges are shared by more than two faces.`, fix: 'Separate overlapping shells or remove internal faces.', count: nonManifoldEdges });
  if (inconsistentEdges > 0) issues.push({ code: 'orientation', severity: 'warning', title: 'Inconsistent face orientation', detail: `${inconsistentEdges.toLocaleString()} paired edges run in the same direction.`, fix: 'Reorient connected faces and recalculate normals.', count: inconsistentEdges });
  if (topology.degenerateFaces > 0) issues.push({ code: 'degenerate', severity: 'warning', title: 'Degenerate triangles', detail: `${topology.degenerateFaces.toLocaleString()} triangles have no usable area.`, fix: 'Remove collapsed and repeated-index faces.', count: topology.degenerateFaces });
  if (topology.duplicateFaces > 0) issues.push({ code: 'duplicates', severity: 'warning', title: 'Duplicate triangles', detail: `${topology.duplicateFaces.toLocaleString()} faces occupy the same welded vertices.`, fix: 'Keep one copy of each duplicate face.', count: topology.duplicateFaces });
  if (isolatedFaces > 0) issues.push({ code: 'isolated', severity: 'info', title: 'Isolated triangles', detail: `${isolatedFaces.toLocaleString()} faces do not share an edge with another face.`, fix: 'Delete debris or join intended components.', count: isolatedFaces });
  if (issues.length === 0) issues.push({ code: 'topology-pass', severity: 'pass', title: 'Topology checks passed', detail: 'The scanned triangle surface is closed, two-manifold, and free of degenerate or duplicate faces.' });
  return {
    scannedTriangles: topology.triangleCount,
    uniqueVertices: topology.points.length,
    boundaryEdges,
    nonManifoldEdges,
    inconsistentEdges,
    degenerateFaces: topology.degenerateFaces,
    duplicateFaces: topology.duplicateFaces,
    isolatedFaces,
    surfaceArea: topology.surfaceArea,
    signedVolume: Math.abs(topology.signedVolume),
    watertight,
    durationMs: Math.round(performance.now() - startedAt),
    scanLimited: false,
    issues,
  };
}

function buildBoundaryLoops(topology: ReturnType<typeof createTopology>, maxEdges: number): number[][] {
  const adjacency = new Map<number, number[]>();
  for (const [key, edge] of topology.edges) {
    if (edge.count !== 1) continue;
    const [left, right] = key.split(':').map(Number) as [number, number];
    adjacency.set(left, [...(adjacency.get(left) ?? []), right]);
    adjacency.set(right, [...(adjacency.get(right) ?? []), left]);
  }
  const used = new Set<string>();
  const edgeKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;
  const loops: number[][] = [];
  for (const [start, neighbors] of adjacency) {
    for (const first of neighbors) {
      if (used.has(edgeKey(start, first))) continue;
      const loop = [start];
      let previous = start;
      let current = first;
      used.add(edgeKey(start, first));
      while (loop.length <= maxEdges) {
        loop.push(current);
        const next = (adjacency.get(current) ?? []).find((candidate) => candidate !== previous && (!used.has(edgeKey(current, candidate)) || candidate === start));
        if (next === undefined) break;
        if (next === start) { loops.push(loop); break; }
        used.add(edgeKey(current, next));
        previous = current;
        current = next;
      }
    }
  }
  return loops;
}

function loopNormal(points: Point[]): Point {
  let normal = { x: 0, y: 0, z: 0 };
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    normal = add(normal, { x: (current.y - next.y) * (current.z + next.z), y: (current.z - next.z) * (current.x + next.x), z: (current.x - next.x) * (current.y + next.y) });
  }
  const magnitude = length(normal);
  return magnitude > 0 ? scale(normal, 1 / magnitude) : normal;
}

function isPlanarEnough(points: Point[], tolerance: number): boolean {
  if (points.length < 3) return false;
  const normal = loopNormal(points);
  const origin = points[0]!;
  return points.every((point) => Math.abs(dot(subtract(point, origin), normal)) <= tolerance * 4);
}

export function repair(payloads: GeometryPayload[], options: RepairOptions): RepairResult {
  const startedAt = performance.now();
  const topology = createTopology(payloads, options.mergeTolerance > 0 ? options.mergeTolerance : undefined);
  const faceKeys = new Set<string>();
  const output: number[] = [];
  let removedFaces = 0;

  for (const triangle of topology.triangles) {
    const faceKey = [triangle.a, triangle.b, triangle.c].sort((a, b) => a - b).join(':');
    if (options.removeDuplicates && faceKeys.has(faceKey)) { removedFaces += 1; continue; }
    faceKeys.add(faceKey);
    const [a, b, c] = triangle.source;
    const area = length(cross(subtract(b, a), subtract(c, a))) / 2;
    if (options.removeDegenerate && area <= topology.epsilon * topology.epsilon) { removedFaces += 1; continue; }
    output.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  if (!options.removeDegenerate) {
    for (const [a, b, c] of topology.degenerateTriangles) {
      output.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
  }
  removedFaces += options.removeDegenerate ? topology.degenerateFaces : 0;

  let filledHoles = 0;
  const warnings: string[] = [];
  if (options.fillSimpleHoles) {
    const loops = buildBoundaryLoops(topology, options.maxHoleEdges);
    for (const loop of loops) {
      const points = loop.map((id) => topology.points[id]!);
      if (!isPlanarEnough(points, topology.epsilon)) { warnings.push(`Skipped a non-planar boundary with ${points.length} edges.`); continue; }
      const center = scale(points.reduce(add, { x: 0, y: 0, z: 0 }), 1 / points.length);
      for (let index = 0; index < points.length; index += 1) {
        const a = points[index]!;
        const b = points[(index + 1) % points.length]!;
        output.push(a.x, a.y, a.z, b.x, b.y, b.z, center.x, center.y, center.z);
      }
      filledHoles += 1;
    }
  }
  if (options.centerGeometry && output.length > 0) {
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (let offset = 0; offset < output.length; offset += 3) {
      min.x = Math.min(min.x, output[offset]!); min.y = Math.min(min.y, output[offset + 1]!); min.z = Math.min(min.z, output[offset + 2]!);
      max.x = Math.max(max.x, output[offset]!); max.y = Math.max(max.y, output[offset + 1]!); max.z = Math.max(max.z, output[offset + 2]!);
    }
    const center = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
    for (let offset = 0; offset < output.length; offset += 3) {
      output[offset] = output[offset]! - center.x;
      output[offset + 1] = output[offset + 1]! - center.y;
      output[offset + 2] = output[offset + 2]! - center.z;
    }
  }
  return {
    positions: new Float32Array(output),
    removedFaces,
    filledHoles,
    mergedVertices: Math.max(0, topology.triangleCount * 3 - topology.points.length),
    beforeTriangles: topology.triangleCount,
    afterTriangles: output.length / 9,
    durationMs: Math.round(performance.now() - startedAt),
    warnings,
  };
}

worker?.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'analyze') {
      const response: WorkerResponse = { id: request.id, ok: true, type: 'analyze', result: analyze(request.payloads, request.scanLimited) };
      worker.postMessage(response);
    } else {
      const result = repair(request.payloads, request.options);
      const response: WorkerResponse = { id: request.id, ok: true, type: 'repair', result };
      worker.postMessage(response, [result.positions.buffer]);
    }
  } catch (error) {
    const response: WorkerResponse = { id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) };
    worker.postMessage(response);
  }
});

export {};
