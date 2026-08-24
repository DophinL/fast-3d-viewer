import type { AnimationClip, Object3D } from 'three';

export type LoadPhase =
  | 'idle'
  | 'reading'
  | 'unpacking'
  | 'parsing'
  | 'assembling'
  | 'framing'
  | 'ready'
  | 'error';

export type IssueSeverity = 'error' | 'warning' | 'info' | 'pass';
export type RenderMode = 'material' | 'matcap' | 'normals' | 'wireframe' | 'xray';
export type ToneMappingMode = 'neutral' | 'aces' | 'agx' | 'linear';
export type UpAxis = 'x' | 'y' | 'z';

export interface LoadProgress {
  phase: LoadPhase;
  progress: number;
  label: string;
  bytesRead?: number;
  bytesTotal?: number;
}

export interface FileEntry {
  file: File;
  name: string;
  normalizedPath: string;
  extension: string;
  size: number;
  source: 'upload' | 'archive' | 'remote' | 'sample';
}

export interface FileBundle {
  entries: FileEntry[];
  mainFile: FileEntry;
  totalBytes: number;
  archiveName?: string;
  remoteBaseUrl?: string;
  warnings: string[];
}

export interface FormatDefinition {
  id: string;
  label: string;
  extensions: string[];
  family: 'web' | 'mesh' | 'cad' | 'bim' | 'point-cloud' | 'print' | 'scene' | 'toolpath';
  packageSupport: boolean;
  animations: boolean;
  materials: boolean;
  repair: boolean;
  loader: 'native' | 'cad';
  description: string;
}

export interface ModelDimensions {
  x: number;
  y: number;
  z: number;
  diagonal: number;
}

export interface AssetStats {
  fileName: string;
  format: string;
  totalBytes: number;
  fileCount: number;
  meshes: number;
  points: number;
  lines: number;
  vertices: number;
  triangles: number;
  materials: number;
  textures: number;
  bones: number;
  animations: number;
  drawCalls: number;
  dimensions: ModelDimensions;
  hasNormals: boolean;
  hasTangents: boolean;
  hasUV: boolean;
  hasVertexColors: boolean;
  hasPbr: boolean;
  loadDurationMs: number;
  parseDurationMs: number;
  estimatedGpuBytes: number;
}

export interface AssetIssue {
  code: string;
  severity: IssueSeverity;
  title: string;
  detail: string;
  fix?: string;
  count?: number;
}

export interface GeometryPayload {
  id: string;
  positions: Float32Array;
  indices: Uint32Array | null;
  matrix: Float32Array;
}

export interface MeshDiagnostics {
  scannedTriangles: number;
  uniqueVertices: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
  inconsistentEdges: number;
  degenerateFaces: number;
  duplicateFaces: number;
  isolatedFaces: number;
  surfaceArea: number;
  signedVolume: number;
  watertight: boolean;
  durationMs: number;
  scanLimited: boolean;
  issues: AssetIssue[];
}

export interface RepairOptions {
  removeDegenerate: boolean;
  removeDuplicates: boolean;
  mergeTolerance: number;
  fillSimpleHoles: boolean;
  maxHoleEdges: number;
  centerGeometry: boolean;
}

export interface RepairResult {
  positions: Float32Array;
  removedFaces: number;
  filledHoles: number;
  mergedVertices: number;
  beforeTriangles: number;
  afterTriangles: number;
  durationMs: number;
  warnings: string[];
}

export interface LoadedAsset {
  root: Object3D;
  animations: AnimationClip[];
  bundle: FileBundle;
  format: FormatDefinition;
  stats: AssetStats;
  issues: AssetIssue[];
  parser: 'Fast native loader' | 'Native OCCT worker';
  cleanup: () => void;
}

export interface ViewerSettings {
  renderMode: RenderMode;
  background: string;
  environmentIntensity: number;
  keyLightIntensity: number;
  exposure: number;
  toneMapping: ToneMappingMode;
  showGrid: boolean;
  showAxes: boolean;
  showBounds: boolean;
  autoRotate: boolean;
  autoRotateSpeed: number;
  shadows: boolean;
  transparentBackground: boolean;
  adaptiveQuality: boolean;
}

export interface RendererTelemetry {
  fps: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  pixelRatio: number;
  renderer: string;
  webglVersion: string;
}

export interface ExportRequest {
  format: 'glb' | 'gltf' | 'obj' | 'stl' | 'ply' | 'usdz';
  binary?: boolean;
  onlyVisible?: boolean;
  includeAnimations?: boolean;
}
