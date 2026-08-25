import type { AnimationClip, Object3D } from 'three';
import { createFileBundle, fetchRemoteBundle } from '../../../src/core/file-bundle';
import { loadModel } from '../../../src/core/load-model';
import type {
  ClippingSettings,
  AvatarMetadata,
  LoadedAsset,
  LoadProgress,
  MeasurementPoint,
  MeasurementResult,
  ModelAnnotation,
  ViewerInteractionMode,
  ViewerSettings,
} from '../../../src/core/types';
import type { ModelTransformState, ViewerCameraState } from '../../../src/core/view-state';
import { ViewerEngine } from '../../../src/viewer/ViewerEngine';

export type {
  ClippingSettings,
  AvatarMetadata,
  LoadedAsset,
  LoadProgress,
  MeasurementPoint,
  MeasurementResult,
  ModelAnnotation,
  ModelTransformState,
  ViewerCameraState,
  ViewerInteractionMode,
  ViewerSettings,
};

export interface Modern3DViewerOptions {
  canvas?: HTMLCanvasElement;
  settings?: Partial<ViewerSettings>;
  className?: string;
}

export interface ViewerEventMap {
  progress: LoadProgress;
  load: LoadedAsset;
  error: Error;
  select: Object3D | null;
  measurement: { result: MeasurementResult | null; collected: number; required: number };
  'annotation-point': MeasurementPoint;
}

type ViewerEventName = keyof ViewerEventMap;
type ViewerEventListener<K extends ViewerEventName> = (detail: ViewerEventMap[K]) => void;

export class Modern3DViewer {
  readonly container: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly engine: ViewerEngine;
  private readonly events = new EventTarget();
  private asset: LoadedAsset | null = null;
  private operation = 0;
  private disposed = false;

  constructor(container: HTMLElement, options: Modern3DViewerOptions = {}) {
    if (!(container instanceof HTMLElement)) throw new TypeError('Modern3DViewer requires an HTMLElement container.');
    this.container = container;
    this.canvas = options.canvas ?? document.createElement('canvas');
    this.canvas.className = options.className ?? 'modern-3d-viewer-canvas';
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.touchAction = 'none';
    if (!options.canvas) container.append(this.canvas);
    this.engine = new ViewerEngine(container, this.canvas);
    if (options.settings) this.engine.applySettings(options.settings);
    this.engine.setSelectionListener((selection) => this.emit('select', selection));
    this.engine.setMeasurementListener((result, collected, required) => this.emit('measurement', { result, collected, required }));
    this.engine.setAnnotationPointListener((point) => this.emit('annotation-point', point));
  }

  on<K extends ViewerEventName>(name: K, listener: ViewerEventListener<K>): () => void {
    const handler = (event: Event) => listener((event as CustomEvent<ViewerEventMap[K]>).detail);
    this.events.addEventListener(name, handler);
    return () => this.events.removeEventListener(name, handler);
  }

  async openFiles(files: Iterable<File>): Promise<LoadedAsset> {
    this.assertActive();
    const list = [...files];
    if (list.some((file) => file.name.toLowerCase().endsWith('.zip'))) {
      throw new Error('ZIP packages require the optional SDK archive worker, which is not part of the 0.3.0 core bundle. Pass extracted package files instead.');
    }
    return this.openBundle(createFileBundle(list));
  }

  async openUrl(url: string, signal?: AbortSignal): Promise<LoadedAsset> {
    this.assertActive();
    return this.openBundle(fetchRemoteBundle(url, signal));
  }

  setObject(root: Object3D, animations: AnimationClip[] = []): void {
    this.assertActive();
    this.asset?.cleanup();
    this.asset = null;
    this.engine.setModel(root, animations);
  }

  getAsset(): LoadedAsset | null { return this.asset; }
  setSettings(settings: Partial<ViewerSettings>): void { this.engine.applySettings(settings); }
  setInteractionMode(mode: ViewerInteractionMode): void { this.engine.setInteractionMode(mode); }
  setClipping(settings: Partial<ClippingSettings>): ClippingSettings { return this.engine.setClipping(settings); }
  setAnnotations(annotations: readonly ModelAnnotation[]): void { this.engine.setAnnotations(annotations); }
  fitToView(animate = true): void { this.engine.fitToView(animate); }
  setView(view: Parameters<ViewerEngine['setView']>[0]): void { this.engine.setView(view); }
  setProjection(mode: 'perspective' | 'orthographic'): void { this.engine.setProjection(mode); }
  rotateModel(axis: 'x' | 'y' | 'z', degrees: number): void { this.engine.rotateModel(axis, degrees); }
  placeModelOnGround(): void { this.engine.placeModelOnGround(); }
  resetModelTransform(): void { this.engine.resetModelTransform(); }
  snapshot(scale = 2, transparent = false): string { return this.engine.snapshot(scale, transparent); }
  getCameraState(): ViewerCameraState { return this.engine.getCameraState(); }
  applyCameraState(state: ViewerCameraState): void { this.engine.applyCameraState(state); }
  getModelTransform(): ModelTransformState | null { return this.engine.getModelTransform(); }
  applyModelTransform(state: ModelTransformState): void { this.engine.applyModelTransform(state); }

  clear(): void {
    this.operation += 1;
    this.asset?.cleanup();
    this.asset = null;
    this.engine.clearModel();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    this.engine.dispose();
    if (this.canvas.parentElement === this.container) this.canvas.remove();
  }

  private async openBundle(bundlePromise: Promise<Awaited<ReturnType<typeof createFileBundle>>>): Promise<LoadedAsset> {
    const generation = ++this.operation;
    try {
      const bundle = await bundlePromise;
      const loaded = await loadModel(bundle, (progress) => this.emit('progress', progress));
      if (generation !== this.operation || this.disposed) {
        loaded.cleanup();
        throw new DOMException('The model load was superseded.', 'AbortError');
      }
      this.asset?.cleanup();
      this.asset = loaded;
      this.engine.setModel(loaded.root, loaded.animations);
      this.emit('load', loaded);
      return loaded;
    } catch (reason) {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      if (!(error instanceof DOMException && error.name === 'AbortError')) this.emit('error', error);
      throw error;
    }
  }

  private emit<K extends ViewerEventName>(name: K, detail: ViewerEventMap[K]): void {
    this.events.dispatchEvent(new CustomEvent(name, { detail }));
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('This Modern3DViewer instance has been disposed.');
  }
}

export { ViewerEngine } from '../../../src/viewer/ViewerEngine';
export { FORMAT_DEFINITIONS, SUPPORTED_EXTENSIONS, findFormat, getAcceptValue, isSupportedFile } from '../../../src/core/formats';
export { createFileBundle, fetchRemoteBundle } from '../../../src/core/file-bundle';
export { loadModel } from '../../../src/core/load-model';
export { getVrmAvatar } from '../../../src/core/vrm-runtime';
