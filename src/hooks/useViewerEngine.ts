import { useEffect, useRef, useState } from 'react';
import type { Object3D } from 'three';
import type { MeasurementPoint, MeasurementResult, RendererTelemetry, ViewerSettings } from '../core/types';
import { ViewerEngine } from '../viewer/ViewerEngine';

export function useViewerEngine() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ViewerEngine | null>(null);
  const [telemetry, setTelemetry] = useState<RendererTelemetry | null>(null);
  const [selection, setSelection] = useState<Object3D | null>(null);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [measurement, setMeasurement] = useState<{ result: MeasurementResult | null; collected: number; required: number }>({ result: null, collected: 0, required: 0 });
  const [annotationPoint, setAnnotationPoint] = useState<MeasurementPoint | null>(null);

  useEffect(() => {
    if (!viewportRef.current || !canvasRef.current) return;
    let engine: ViewerEngine | null = null;
    try {
      engine = new ViewerEngine(viewportRef.current, canvasRef.current);
      engine.setTelemetryListener(setTelemetry);
      engine.setSelectionListener(setSelection);
      engine.setMeasurementListener((result, collected, required) => setMeasurement({ result, collected, required }));
      engine.setAnnotationPointListener(setAnnotationPoint);
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
  return {
    viewportRef,
    canvasRef,
    engineRef,
    telemetry,
    selection,
    rendererError,
    measurement,
    annotationPoint,
    clearAnnotationPoint: () => setAnnotationPoint(null),
    applySettings,
  };
}
