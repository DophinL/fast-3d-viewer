import { describe, expect, it } from 'vitest';
import { createShareUrl, decodeViewerState, encodeViewerState, type SharedViewerState } from '../../src/core/view-state';

const state: SharedViewerState = {
  version: 1,
  modelUrl: 'https://assets.example.test/model.glb',
  camera: { projection: 'perspective', position: [1, 2, 3], target: [0, 0, 0], up: [0, 1, 0] },
  transform: { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] },
  settings: { renderMode: 'material', background: '#101317', showGrid: true, showAxes: false, shadows: true, toneMapping: 'neutral', exposure: 1 },
  clipping: { enabled: true, axis: 'y', position: 0.42, inverted: false },
  measurementUnit: 'millimeter',
  annotations: [{ id: 'one', label: '门框', point: { x: 1, y: 2, z: 3 }, createdAt: '2026-08-24T00:00:00.000Z' }],
};

describe('shared viewer state', () => {
  it('round-trips unicode labels through URL-safe base64', () => {
    expect(decodeViewerState(encodeViewerState(state))).toEqual(state);
  });

  it('replaces stale query parameters when creating a share URL', () => {
    const url = new URL(createShareUrl('https://example.test/stl-viewer/?old=1#section', state));
    expect(url.hash).toBe('');
    expect(url.searchParams.has('old')).toBe(false);
    expect(url.searchParams.get('view')).toBeTruthy();
  });

  it('rejects credentials and non-web model protocols', () => {
    expect(() => encodeViewerState({ ...state, modelUrl: 'file:///secret/model.glb' })).not.toThrow();
    const invalid = { ...state, modelUrl: 'file:///secret/model.glb' };
    expect(() => decodeViewerState(encodeViewerState(invalid))).toThrow(/HTTP and HTTPS/i);
  });
});
