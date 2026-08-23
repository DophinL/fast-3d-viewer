import type { ViewerSettings } from './types';

export const DEFAULT_VIEWER_SETTINGS: ViewerSettings = Object.freeze({
  renderMode: 'material',
  background: '#dcd8cd',
  environmentIntensity: 0.8,
  keyLightIntensity: 3.2,
  exposure: 1,
  toneMapping: 'neutral',
  showGrid: true,
  showAxes: false,
  showBounds: false,
  autoRotate: false,
  autoRotateSpeed: 1.4,
  shadows: true,
  transparentBackground: false,
  adaptiveQuality: true,
});
