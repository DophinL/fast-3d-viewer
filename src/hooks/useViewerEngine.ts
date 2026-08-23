import { useEffect, useRef, useState } from 'react';
import type { Object3D } from 'three';
import type { RendererTelemetry, ViewerSettings } from '../core/types';
import { ViewerEngine } from '../viewer/ViewerEngine';

export function useViewerEngine() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ViewerEngine | null>(null);
  const [telemetry, setTelemetry] = useState<RendererTelemetry | null>(null);
  const [selection, setSelection] = useState<Object3D | null>(null);
  const [rendererError, setRendererError] = useState<string | null>(null);

  useEffect(() => {
    if (!viewportRef.current || !canvasRef.current) return;
    let engine: ViewerEngine | null = null;
    try {
      engine = new ViewerEngine(viewportRef.current, canvasRef.current);
      engine.setTelemetryListener(setTelemetry);
      engine.setSelectionListener(setSelection);
      engineRef.current = engine;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'This browser could not create a WebGL renderer.';
      queueMicrotask(() => setRendererError(message));
    }
    return () => {
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  const applySettings = (settings: Partial<ViewerSettings>) => engineRef.current?.applySettings(settings);
  return { viewportRef, canvasRef, engineRef, telemetry, selection, rendererError, applySettings };
}
