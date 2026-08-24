import { parseDotBim } from './loaders/dotbim';
import { disposeObject } from './inspect';

export interface BenchmarkCaseResult {
  id: string;
  label: string;
  fixture: string;
  iterations: number;
  samplesMs: number[];
  medianMs: number;
  p95Ms: number;
  minimumMs: number;
  maximumMs: number;
  output: Record<string, number | string | boolean>;
}

export interface ViewerBenchmarkReport {
  schema: 'modern-3d-workbench/benchmark@1';
  startedAt: string;
  completedAt: string;
  environment: {
    userAgent: string;
    language: string;
    logicalProcessors: number | null;
    deviceMemoryGb: number | null;
    crossOriginIsolated: boolean;
    webgl2: boolean;
    renderer: string | null;
  };
  protocol: {
    warmupIterations: number;
    measuredIterations: number;
    timer: 'performance.now';
    note: string;
  };
  cases: BenchmarkCaseResult[];
}

export type BenchmarkProgress = (completed: number, total: number, label: string) => void;

const WARMUP_ITERATIONS = 2;
const MEASURED_ITERATIONS = 7;

function percentile(samples: readonly number[], ratio: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
}

function summarize(id: string, label: string, fixture: string, samplesMs: number[], output: BenchmarkCaseResult['output']): BenchmarkCaseResult {
  return {
    id,
    label,
    fixture,
    iterations: samplesMs.length,
    samplesMs: samplesMs.map((sample) => Number(sample.toFixed(3))),
    medianMs: Number(percentile(samplesMs, 0.5).toFixed(3)),
    p95Ms: Number(percentile(samplesMs, 0.95).toFixed(3)),
    minimumMs: Number(Math.min(...samplesMs).toFixed(3)),
    maximumMs: Number(Math.max(...samplesMs).toFixed(3)),
    output,
  };
}

function createBinaryStl(triangleCount: number): ArrayBuffer {
  const buffer = new ArrayBuffer(84 + triangleCount * 50);
  const view = new DataView(buffer);
  view.setUint32(80, triangleCount, true);
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = 84 + triangle * 50;
    const x = triangle % 200;
    const y = Math.floor(triangle / 200) % 200;
    const z = (triangle % 17) * 0.01;
    view.setFloat32(offset + 8, 1, true);
    const vertices = [x, y, z, x + 0.8, y, z, x, y + 0.8, z];
    vertices.forEach((value, index) => view.setFloat32(offset + 12 + index * 4, value, true));
  }
  return buffer;
}

function createObj(triangleCount: number): string {
  const lines: string[] = ['# deterministic triangle soup fixture'];
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const x = triangle % 150;
    const y = Math.floor(triangle / 150);
    lines.push(`v ${x} ${y} 0`, `v ${x + 0.8} ${y} 0`, `v ${x} ${y + 0.8} 0`);
  }
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const vertex = triangle * 3 + 1;
    lines.push(`f ${vertex} ${vertex + 1} ${vertex + 2}`);
  }
  return lines.join('\n');
}

function createDotBim(elementCount: number): string {
  return JSON.stringify({
    schema_version: '1.1.0',
    meshes: [{
      mesh_id: 1,
      coordinates: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
      indices: [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0],
    }],
    elements: Array.from({ length: elementCount }, (_, index) => ({
      mesh_id: 1,
      vector: { x: index % 100, y: Math.floor(index / 100), z: 0 },
      rotation: { qx: 0, qy: 0, qz: 0, qw: 1 },
      guid: `fixture-${index}`,
      type: index % 5 === 0 ? 'Column' : 'Block',
      color: { r: 90 + index % 120, g: 145, b: 190, a: 255 },
      info: { Index: String(index) },
    })),
    info: { Fixture: 'modern-3d-workbench-benchmark-v1' },
  });
}

async function runCase<T>(options: {
  id: string;
  label: string;
  fixture: string;
  execute: () => T | Promise<T>;
  inspect: (value: T) => BenchmarkCaseResult['output'];
  dispose?: (value: T) => void;
  progress?: BenchmarkProgress;
  offset: number;
  total: number;
}): Promise<BenchmarkCaseResult> {
  let last: T | null = null;
  for (let warmup = 0; warmup < WARMUP_ITERATIONS; warmup += 1) {
    last = await options.execute();
    options.dispose?.(last);
    last = null;
  }
  const samples: number[] = [];
  for (let iteration = 0; iteration < MEASURED_ITERATIONS; iteration += 1) {
    const started = performance.now();
    last = await options.execute();
    samples.push(performance.now() - started);
    options.progress?.(options.offset + iteration + 1, options.total, options.label);
    if (iteration < MEASURED_ITERATIONS - 1) {
      options.dispose?.(last);
      last = null;
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  const output = options.inspect(last!);
  options.dispose?.(last!);
  return summarize(options.id, options.label, options.fixture, samples, output);
}

function environment(): ViewerBenchmarkReport['environment'] {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  const debug = gl?.getExtension('WEBGL_debug_renderer_info');
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    logicalProcessors: navigator.hardwareConcurrency || null,
    deviceMemoryGb: navigatorWithMemory.deviceMemory ?? null,
    crossOriginIsolated: window.crossOriginIsolated,
    webgl2: Boolean(gl),
    renderer: gl && debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : null,
  };
}

export async function runViewerBenchmark(progress?: BenchmarkProgress): Promise<ViewerBenchmarkReport> {
  const startedAt = new Date().toISOString();
  const total = MEASURED_ITERATIONS * 3;
  const stlFixture = createBinaryStl(50_000);
  const objFixture = createObj(15_000);
  const dotBimFixture = createDotBim(2_500);
  const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
  const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');

  const cases: BenchmarkCaseResult[] = [];
  cases.push(await runCase({
    id: 'stl-50k-binary-parse',
    label: 'Binary STL parse',
    fixture: '50,000 deterministic triangles · 2.50 MB payload',
    execute: () => new STLLoader().parse(stlFixture.slice(0)),
    inspect: (geometry) => ({ vertices: geometry.getAttribute('position').count, indexed: Boolean(geometry.getIndex()) }),
    dispose: (geometry) => geometry.dispose(),
    progress,
    offset: 0,
    total,
  }));
  cases.push(await runCase({
    id: 'obj-15k-ascii-parse',
    label: 'ASCII OBJ parse',
    fixture: `15,000 deterministic triangles · ${(new Blob([objFixture]).size / 1_000_000).toFixed(2)} MB payload`,
    execute: () => new OBJLoader().parse(objFixture),
    inspect: (object) => ({ sceneChildren: object.children.length }),
    progress,
    offset: MEASURED_ITERATIONS,
    total,
  }));
  cases.push(await runCase({
    id: 'dotbim-2500-elements-parse',
    label: 'DotBIM element assembly',
    fixture: `2,500 elements · ${(new Blob([dotBimFixture]).size / 1_000_000).toFixed(2)} MB payload`,
    execute: () => parseDotBim(dotBimFixture),
    inspect: (result) => ({ elements: result.elementCount, meshDefinitions: result.meshDefinitions, warnings: result.warnings.length }),
    dispose: (result) => disposeObject(result.root),
    progress,
    offset: MEASURED_ITERATIONS * 2,
    total,
  }));

  return {
    schema: 'modern-3d-workbench/benchmark@1',
    startedAt,
    completedAt: new Date().toISOString(),
    environment: environment(),
    protocol: {
      warmupIterations: WARMUP_ITERATIONS,
      measuredIterations: MEASURED_ITERATIONS,
      timer: 'performance.now',
      note: 'Parser and scene-assembly timings only. Network, React startup, GPU upload, and first frame are separate boundaries.',
    },
    cases,
  };
}
