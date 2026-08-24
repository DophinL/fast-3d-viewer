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
const allowedProtocols = new Set(['http:', 'https:']);

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
  if (!parsed.camera || !finiteTuple(parsed.camera.position, 3) || !finiteTuple(parsed.camera.target, 3) || !finiteTuple(parsed.camera.up, 3)) {
    throw new Error('The shared camera state is invalid.');
  }
  if (!parsed.settings || !parsed.clipping || !Array.isArray(parsed.annotations)) throw new Error('The shared viewer state is incomplete.');
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
