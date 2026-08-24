import type {
  ClippingSettings,
  MeasurementUnit,
  ModelAnnotation,
  ViewerSettings,
} from './types';

export interface ViewerCameraState {
  projection: 'perspective' | 'orthographic';
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  orthographicZoom?: number;
}

export interface ModelTransformState {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
}

export interface SharedViewerState {
  version: 1;
  modelUrl: string;
  camera: ViewerCameraState;
  transform: ModelTransformState | null;
  settings: Pick<ViewerSettings, 'renderMode' | 'background' | 'showGrid' | 'showAxes' | 'shadows' | 'toneMapping' | 'exposure'>;
  clipping: ClippingSettings;
  measurementUnit: MeasurementUnit;
  annotations: ModelAnnotation[];
}

const MAX_STATE_BYTES = 24_000;
const MAX_ANNOTATIONS = 200;
const allowedProtocols = new Set(['http:', 'https:']);
const renderModes = new Set(['material', 'matcap', 'normals', 'wireframe', 'xray']);
const toneMappings = new Set(['neutral', 'aces', 'agx', 'linear']);
const clippingAxes = new Set(['x', 'y', 'z']);
const measurementUnits = new Set(['unit', 'millimeter', 'centimeter', 'meter', 'inch', 'foot']);

export function validateRemoteModelUrl(value: string): string {
  const url = new URL(value);
  if (!allowedProtocols.has(url.protocol)) throw new Error('Only HTTP and HTTPS model URLs can be shared.');
  if (url.username || url.password) throw new Error('Share links cannot contain URL credentials.');
  return url.toString();
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decodeBase64Url(value: string): string {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function finiteTuple(value: unknown, length: number): value is number[] {
  return Array.isArray(value) && value.length === length && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validAnnotation(value: unknown): value is ModelAnnotation {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length > 128 || typeof value.label !== 'string' || value.label.length > 500 || typeof value.createdAt !== 'string' || value.createdAt.length > 64) return false;
  return isRecord(value.point) && finiteTuple([value.point.x, value.point.y, value.point.z], 3);
}

export function encodeViewerState(state: SharedViewerState): string {
  const serialized = JSON.stringify(state);
  if (new TextEncoder().encode(serialized).byteLength > MAX_STATE_BYTES) {
    throw new Error('This view has too many annotations to fit safely in a share URL. Download the view manifest instead.');
  }
  return encodeBase64Url(serialized);
}

export function decodeViewerState(encoded: string): SharedViewerState {
  if (encoded.length > MAX_STATE_BYTES * 2) throw new Error('The shared view state is larger than the supported limit.');
  const parsed = JSON.parse(decodeBase64Url(encoded)) as Partial<SharedViewerState>;
  if (parsed.version !== 1 || typeof parsed.modelUrl !== 'string') throw new Error('This share link uses an unsupported view-state version.');
  validateRemoteModelUrl(parsed.modelUrl);
  if (!parsed.camera || !['perspective', 'orthographic'].includes(parsed.camera.projection) || !finiteTuple(parsed.camera.position, 3) || !finiteTuple(parsed.camera.target, 3) || !finiteTuple(parsed.camera.up, 3) || (parsed.camera.orthographicZoom !== undefined && (typeof parsed.camera.orthographicZoom !== 'number' || !Number.isFinite(parsed.camera.orthographicZoom) || parsed.camera.orthographicZoom <= 0))) {
    throw new Error('The shared camera state is invalid.');
  }
  if (parsed.transform !== null && (!parsed.transform || !finiteTuple(parsed.transform.position, 3) || !finiteTuple(parsed.transform.quaternion, 4) || !finiteTuple(parsed.transform.scale, 3))) {
    throw new Error('The shared model transform is invalid.');
  }
  const settings = parsed.settings;
  if (!settings || !renderModes.has(settings.renderMode) || typeof settings.background !== 'string' || !/^#[0-9a-f]{6}$/i.test(settings.background) || typeof settings.showGrid !== 'boolean' || typeof settings.showAxes !== 'boolean' || typeof settings.shadows !== 'boolean' || !toneMappings.has(settings.toneMapping) || typeof settings.exposure !== 'number' || !Number.isFinite(settings.exposure) || settings.exposure < 0 || settings.exposure > 10) {
    throw new Error('The shared viewer settings are invalid.');
  }
  const clipping = parsed.clipping;
  if (!clipping || typeof clipping.enabled !== 'boolean' || !clippingAxes.has(clipping.axis) || typeof clipping.position !== 'number' || !Number.isFinite(clipping.position) || clipping.position < 0 || clipping.position > 1 || typeof clipping.inverted !== 'boolean') {
    throw new Error('The shared clipping state is invalid.');
  }
  if (!measurementUnits.has(parsed.measurementUnit ?? '') || !Array.isArray(parsed.annotations) || parsed.annotations.length > MAX_ANNOTATIONS || !parsed.annotations.every(validAnnotation)) {
    throw new Error('The shared annotations or measurement unit are invalid.');
  }
  return parsed as SharedViewerState;
}

export function createShareUrl(baseUrl: string, state: SharedViewerState): string {
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('view', encodeViewerState(state));
  return url.toString();
}

export function readViewerStateFromUrl(url = window.location.href): SharedViewerState | null {
  const encoded = new URL(url).searchParams.get('view');
  return encoded ? decodeViewerState(encoded) : null;
}

export function serializeViewManifest(state: SharedViewerState): Blob {
  return new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
}
