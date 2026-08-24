import {
  Modern3DViewer,
  type LoadedAsset,
  type LoadProgress,
  type Modern3DViewerOptions,
  type ViewerSettings,
} from '@fast-3d-viewer/core';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
} from 'react';

export interface Modern3DViewerHandle {
  getViewer(): Modern3DViewer | null;
  openFiles(files: Iterable<File>): Promise<LoadedAsset>;
  openUrl(url: string, signal?: AbortSignal): Promise<LoadedAsset>;
  fitToView(animate?: boolean): void;
  snapshot(scale?: number, transparent?: boolean): string | null;
}

export interface Modern3DViewerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onError' | 'onLoad' | 'onProgress' | 'children'> {
  src?: string;
  files?: Iterable<File>;
  settings?: Partial<ViewerSettings>;
  viewerOptions?: Omit<Modern3DViewerOptions, 'settings'>;
  onReady?: (viewer: Modern3DViewer) => void;
  onLoad?: (asset: LoadedAsset) => void;
  onProgress?: (progress: LoadProgress) => void;
  onError?: (error: Error) => void;
}

const defaultStyle: CSSProperties = { minHeight: 320, position: 'relative', overflow: 'hidden' };

export const Modern3DViewerComponent = forwardRef<Modern3DViewerHandle, Modern3DViewerProps>(function Modern3DViewerComponent(props, ref) {
  const { src, files, settings, viewerOptions, onReady, onLoad, onProgress, onError, style, ...elementProps } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Modern3DViewer | null>(null);
  const initialOptionsRef = useRef({ viewerOptions, settings });
  const callbacksRef = useRef({ onReady, onLoad, onProgress, onError });

  useEffect(() => {
    callbacksRef.current = { onReady, onLoad, onProgress, onError };
  }, [onError, onLoad, onProgress, onReady]);

  useImperativeHandle(ref, () => ({
    getViewer: () => viewerRef.current,
    openFiles: (nextFiles) => viewerRef.current?.openFiles(nextFiles) ?? Promise.reject(new Error('The viewer is not mounted.')),
    openUrl: (url, signal) => viewerRef.current?.openUrl(url, signal) ?? Promise.reject(new Error('The viewer is not mounted.')),
    fitToView: (animate) => viewerRef.current?.fitToView(animate),
    snapshot: (scale, transparent) => viewerRef.current?.snapshot(scale, transparent) ?? null,
  }), []);

  useEffect(() => {
    if (!containerRef.current) return;
    const initial = initialOptionsRef.current;
    const viewer = new Modern3DViewer(containerRef.current, { ...initial.viewerOptions, settings: initial.settings });
    viewerRef.current = viewer;
    const cleanup = [
      viewer.on('load', (asset) => callbacksRef.current.onLoad?.(asset)),
      viewer.on('progress', (progress) => callbacksRef.current.onProgress?.(progress)),
      viewer.on('error', (error) => callbacksRef.current.onError?.(error)),
    ];
    callbacksRef.current.onReady?.(viewer);
    return () => {
      cleanup.forEach((unsubscribe) => unsubscribe());
      viewer.dispose();
      viewerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (settings) viewerRef.current?.setSettings(settings);
  }, [settings]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (files) void viewer.openFiles(files).catch(() => undefined);
    else if (src) void viewer.openUrl(src).catch(() => undefined);
  }, [files, src]);

  return <div {...elementProps} ref={containerRef} style={{ ...defaultStyle, ...style }} />;
});

export { Modern3DViewer } from '@fast-3d-viewer/core';
