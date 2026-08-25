import {
  ArrowUpRight,
  Boxes,
  GitFork,
  Menu,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Object3D } from 'three';
import { DiagnosticsService } from './core/diagnostics';
import { createFileBundle, fetchRemoteBundle } from './core/file-bundle';
import { buildAssetIssues, collectGeometryPayloads, disposeObject, inspectAsset } from './core/inspect';
import { loadModel } from './core/load-model';
import { createCalibrationSample } from './core/samples';
import { createRepairedObject, downloadExport, exportModel } from './core/export-model';
import { findFormat, FORMAT_DEFINITIONS } from './core/formats';
import { DEFAULT_VIEWER_SETTINGS } from './core/settings';
import {
  createShareUrl,
  readViewerStateFromUrl,
  type SharedViewerState,
} from './core/view-state';
import {
  applyProductMetadata,
  getProductRoute,
  PRODUCT_NAME,
  PRODUCT_SHORT_NAME,
  REPOSITORY_URL,
} from './core/product';
import type {
  ExportRequest,
  LoadedAsset,
  LoadProgress,
  MeshDiagnostics,
  RepairOptions,
  RepairResult,
  ClippingSettings,
  MeasurementUnit,
  ModelAnnotation,
  ViewerInteractionMode,
  ViewerSettings,
} from './core/types';
import { DropZone } from './components/DropZone';
import { FormatDrawer } from './components/FormatDrawer';
import { Inspector } from './components/Inspector';
import { LoadingOverlay } from './components/LoadingOverlay';
import { SceneRail } from './components/SceneRail';
import { StatusBar } from './components/StatusBar';
import { ViewerToolbar } from './components/ViewerToolbar';
import { ProductPageContent } from './components/ProductPageContent';
import { ModelToolsPanel } from './components/ModelToolsPanel';
import { BenchmarkPage } from './components/BenchmarkPage';
import { AvatarStudioPanel } from './components/AvatarStudioPanel';
import { useViewerEngine } from './hooks/useViewerEngine';

function demoAvatarUrl(): string {
  const path = '../demo/avatar-sample-b.vrm';
  return new URL(path, import.meta.url).toString();
}

function vrmViewerUrl(): string {
  const path = '../vrm-viewer/';
  return new URL(path, import.meta.url).toString();
}

function downloadDataUrl(url: string, name: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function App() {
  const route = getProductRoute();
  const embedParameters = route.id === 'embed' ? new URLSearchParams(window.location.search) : null;
  const embedControls = embedParameters?.get('controls') !== 'false';
  const {
    viewportRef,
    canvasRef,
    engineRef,
    telemetry,
    selection,
    rendererError,
    measurement,
    annotationPoint,
    clearAnnotationPoint,
    applySettings,
  } = useViewerEngine();
  const diagnosticsService = useRef(new DiagnosticsService());
  const activeAssetRef = useRef<LoadedAsset | null>(null);
  const operationGeneration = useRef(0);
  const activeLoadAbort = useRef<AbortController | null>(null);
  const pendingSharedState = useRef<SharedViewerState | null>(null);
  const shareUrlHandled = useRef(false);
  const [asset, setAsset] = useState<LoadedAsset | null>(null);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<MeshDiagnostics | null>(null);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);
  const [repairBusy, setRepairBusy] = useState(false);
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [animationPlaying, setAnimationPlaying] = useState(false);
  const [settings, setSettings] = useState<ViewerSettings>(() => ({ ...DEFAULT_VIEWER_SETTINGS }));
  const [formatDrawer, setFormatDrawer] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [interactionMode, setInteractionMode] = useState<ViewerInteractionMode>('select');
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>('unit');
  const [clipping, setClipping] = useState<ClippingSettings>({ enabled: false, axis: 'x', position: 0.5, inverted: false });
  const [annotations, setAnnotations] = useState<ModelAnnotation[]>([]);
  const [remoteSourceUrl, setRemoteSourceUrl] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  useEffect(() => () => {
    diagnosticsService.current.dispose();
    activeLoadAbort.current?.abort();
    activeAssetRef.current?.cleanup();
  }, []);

  useEffect(() => {
    applyProductMetadata(route);
  }, [route]);

  useEffect(() => {
    if (asset) engineRef.current?.setAnnotations(annotations);
  }, [annotations, asset, engineRef]);

  const updateSettings = useCallback((next: Partial<ViewerSettings>) => {
    setSettings((current) => ({ ...current, ...next }));
    applySettings(next);
  }, [applySettings]);

  const runDiagnostics = useCallback(async (target = activeAssetRef.current) => {
    if (!target) return;
    setDiagnosticsBusy(true);
    try {
      const geometry = collectGeometryPayloads(target.root);
      const result = await diagnosticsService.current.analyze(geometry.payloads, geometry.scanLimited);
      if (activeAssetRef.current === target) setDiagnostics(result);
    } catch (reason) {
      if (activeAssetRef.current === target && !(reason instanceof Error && reason.message === 'Mesh diagnostics were cancelled.')) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    } finally {
      setDiagnosticsBusy(false);
    }
  }, []);

  const commitAsset = useCallback((next: LoadedAsset, completedRepair: RepairResult | null = null, completedDiagnostics: MeshDiagnostics | null = null) => {
    const engine = engineRef.current;
    engine?.setModel(next.root, next.animations);
    const shared = pendingSharedState.current;
    if (engine && shared) {
      engine.applySettings(shared.settings);
      engine.applyModelTransform(shared.transform ?? engine.getModelTransform()!);
      engine.setClipping(shared.clipping);
      engine.setAnnotations(shared.annotations);
      window.requestAnimationFrame(() => engine.applyCameraState(shared.camera));
      setSettings((current) => ({ ...current, ...shared.settings }));
      setClipping(shared.clipping);
      setMeasurementUnit(shared.measurementUnit);
      setAnnotations(shared.annotations);
      pendingSharedState.current = null;
    }
    activeAssetRef.current?.cleanup();
    activeAssetRef.current = next;
    setAsset(next);
    setDiagnostics(completedDiagnostics);
    setRepairResult(completedRepair);
    setAnimationPlaying(false);
    setInspectorOpen(!(next.avatar && route.id === 'vrm'));
    if (next.avatar) window.requestAnimationFrame(() => engine?.frameAvatar());
  }, [engineRef, route.id]);

  const loadBundle = useCallback(async (bundlePromise: ReturnType<typeof createFileBundle>, controller: AbortController | null = null) => {
    if (activeLoadAbort.current !== controller) activeLoadAbort.current?.abort();
    activeLoadAbort.current = controller;
    const generation = ++operationGeneration.current;
    diagnosticsService.current.dispose();
    setError(null);
    setProgress({ phase: 'reading', progress: 0.03, label: 'Preparing model package' });
    try {
      const bundle = await bundlePromise;
      if (generation !== operationGeneration.current) return;
      const next = await loadModel(bundle, (nextProgress) => {
        if (generation === operationGeneration.current) setProgress(nextProgress);
      });
      if (generation !== operationGeneration.current) {
        next.cleanup();
        return;
      }
      commitAsset(next);
    } catch (reason) {
      if (generation !== operationGeneration.current) return;
      if (activeLoadAbort.current === controller) activeLoadAbort.current = null;
      if (reason instanceof DOMException && reason.name === 'AbortError') {
        setProgress(null);
        return;
      }
      setError(reason instanceof Error ? reason.message : String(reason));
      setProgress(null);
      return;
    }
    // The loaded scene is already committed and interactive. Clear the blocking
    // overlay synchronously so slow mobile GPUs never leave controls covered by
    // a cosmetic hand-off delay.
    if (generation === operationGeneration.current) setProgress(null);
    if (activeLoadAbort.current === controller) activeLoadAbort.current = null;
  }, [commitAsset]);

  const openFiles = useCallback((files: File[]) => {
    if (rendererError) {
      setError('3D rendering is unavailable in this browser session. Enable hardware acceleration or try a current Chrome, Edge, Firefox, or Safari browser.');
      return;
    }
    pendingSharedState.current = null;
    setRemoteSourceUrl(null);
    void loadBundle(createFileBundle(files));
  }, [loadBundle, rendererError]);

  const openUrl = useCallback((url: string) => {
    if (rendererError) {
      setError('3D rendering is unavailable in this browser session. Enable hardware acceleration before opening a model.');
      return;
    }
    setRemoteSourceUrl(url);
    const controller = new AbortController();
    void loadBundle(fetchRemoteBundle(url, controller.signal, ({ receivedBytes, totalBytes }) => {
      const ratio = totalBytes ? Math.min(receivedBytes / totalBytes, 1) : 0;
      setProgress({
        phase: 'reading',
        progress: totalBytes ? 0.04 + ratio * 0.18 : 0.08,
        label: totalBytes
          ? `Downloading model · ${(receivedBytes / 1_000_000).toFixed(1)} / ${(totalBytes / 1_000_000).toFixed(1)} MB`
          : `Downloading model · ${(receivedBytes / 1_000_000).toFixed(1)} MB`,
        bytesRead: receivedBytes,
        bytesTotal: totalBytes ?? undefined,
      });
    }), controller);
  }, [loadBundle, rendererError]);

  useEffect(() => {
    if (shareUrlHandled.current) return;
    shareUrlHandled.current = true;
    try {
      const shared = readViewerStateFromUrl();
      if (shared) {
        pendingSharedState.current = shared;
        setRemoteSourceUrl(shared.modelUrl);
        openUrl(shared.modelUrl);
        return;
      }
      if (route.id === 'vrm') {
        openUrl(demoAvatarUrl());
        return;
      }
      if (route.id !== 'embed') return;
      const parameters = new URLSearchParams(window.location.search);
      const modelUrl = parameters.get('model') ?? parameters.get('src');
      const embeddedSettings: Partial<ViewerSettings> = {};
      if (parameters.has('grid')) embeddedSettings.showGrid = parameters.get('grid') !== 'false';
      if (parameters.has('shadows')) embeddedSettings.shadows = parameters.get('shadows') !== 'false';
      if (parameters.has('autorotate')) embeddedSettings.autoRotate = parameters.get('autorotate') === 'true';
      const background = parameters.get('background');
      if (background && /^#[0-9a-f]{6}$/i.test(background)) embeddedSettings.background = background;
      if (Object.keys(embeddedSettings).length > 0) updateSettings(embeddedSettings);
      if (modelUrl) openUrl(modelUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The shared view link is invalid.');
    }
  }, [openUrl, route.id, updateSettings]);

  const repair = useCallback(async (options: RepairOptions) => {
    const current = activeAssetRef.current;
    if (!current) return;
    const generation = ++operationGeneration.current;
    setRepairBusy(true);
    setError(null);
    try {
      const geometry = collectGeometryPayloads(current.root);
      if (geometry.scanLimited) throw new Error('This mesh is above the interactive repair limit. Isolate or reduce it first.');
      const result = await diagnosticsService.current.repair(geometry.payloads, options);
      const root = createRepairedObject(result, `${current.stats.fileName.replace(/\.[^.]+$/, '')} repaired`);
      const repairedGeometry = collectGeometryPayloads(root);
      const repairedDiagnostics = await diagnosticsService.current.analyze(repairedGeometry.payloads, repairedGeometry.scanLimited);
      if (result.filledHoles > 0 && (repairedDiagnostics.nonManifoldEdges > 0 || repairedDiagnostics.inconsistentEdges > 0)) {
        disposeObject(root);
        throw new Error('The proposed hole fill did not pass the post-repair topology check, so no working copy was created.');
      }
      const sourceName = `${current.stats.fileName.replace(/\.[^.]+$/, '')}-repaired.stl`;
      const serialized = await exportModel(root, sourceName, {
        format: 'stl',
        binary: true,
        onlyVisible: true,
      });
      const sourceFile = new File([serialized.blob], sourceName, { type: serialized.mimeType });
      const bundle = await createFileBundle([sourceFile]);
      const stats = inspectAsset(root, bundle, 0, result.durationMs, result.durationMs);
      const next: LoadedAsset = {
        root,
        bundle,
        format: findFormat('stl')!,
        stats,
        issues: buildAssetIssues(stats),
        animations: [],
        parser: 'Modern native loader',
        cleanup: () => disposeObject(root),
      };
      if (generation !== operationGeneration.current || activeAssetRef.current !== current) {
        next.cleanup();
        return;
      }
      commitAsset(next, result, repairedDiagnostics);
    } catch (reason) {
      if (generation !== operationGeneration.current || activeAssetRef.current !== current) return;
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setRepairBusy(false);
    }
  }, [commitAsset]);

  const runExport = useCallback(async (request: ExportRequest) => {
    const current = activeAssetRef.current;
    if (!current) return;
    setExportBusy(request.format);
    setError(null);
    try {
      const result = await exportModel(current.root, current.stats.fileName, request, current.animations);
      downloadExport(result);
    } catch (reason) {
      console.error('Model export failed.', reason);
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setExportBusy(null);
    }
  }, []);

  const snapshot = () => {
    if (!asset) return;
    try {
      const data = engineRef.current?.snapshot(2, false);
      if (data) downloadDataUrl(data, `${asset.stats.fileName.replace(/\.[^.]+$/, '')}-view.png`);
    } catch (reason) {
      setError(reason instanceof Error ? `Could not create the PNG snapshot: ${reason.message}` : 'Could not create the PNG snapshot.');
    }
  };

  const fullscreen = async () => {
    if (!viewportRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await viewportRef.current.requestFullscreen();
  };

  const reset = () => {
    operationGeneration.current += 1;
    activeLoadAbort.current?.abort();
    activeLoadAbort.current = null;
    diagnosticsService.current.dispose();
    activeAssetRef.current?.cleanup();
    activeAssetRef.current = null;
    engineRef.current?.clearModel();
    setAsset(null);
    setDiagnostics(null);
    setRepairResult(null);
    setProgress(null);
    setAnimationPlaying(false);
    setToolsOpen(false);
    setInteractionMode('select');
    setClipping({ enabled: false, axis: 'x', position: 0.5, inverted: false });
    setAnnotations([]);
    setRemoteSourceUrl(null);
    setShareStatus(null);
    clearAnnotationPoint();
    setError(null);
  };

  const chooseInteractionMode = (mode: ViewerInteractionMode) => {
    setInteractionMode(mode);
    clearAnnotationPoint();
    engineRef.current?.setInteractionMode(mode);
  };

  const updateClipping = (next: Partial<ClippingSettings>) => {
    setClipping((current) => {
      const updated = { ...current, ...next };
      engineRef.current?.setClipping(updated);
      return updated;
    });
  };

  const transformModel = (operation: (engine: NonNullable<typeof engineRef.current>) => void) => {
    const engine = engineRef.current;
    if (!engine) return;
    operation(engine);
    setAnnotations([]);
    clearAnnotationPoint();
  };

  const buildSharedState = (): SharedViewerState | null => {
    const engine = engineRef.current;
    if (!engine || !remoteSourceUrl) return null;
    return {
      version: 1,
      modelUrl: remoteSourceUrl,
      camera: engine.getCameraState(),
      transform: engine.getModelTransform(),
      settings: {
        renderMode: settings.renderMode,
        background: settings.background,
        showGrid: settings.showGrid,
        showAxes: settings.showAxes,
        shadows: settings.shadows,
        toneMapping: settings.toneMapping,
        exposure: settings.exposure,
      },
      clipping,
      measurementUnit,
      annotations,
    };
  };

  const copyShareLink = async () => {
    const state = buildSharedState();
    if (!state) {
      setShareStatus('Local files cannot become a working share link unless the model is hosted at a CORS-enabled URL.');
      return;
    }
    try {
      const url = createShareUrl(window.location.href, state);
      await navigator.clipboard.writeText(url);
      setShareStatus('Share link copied. The model URL and current view settings are included.');
    } catch (reason) {
      setShareStatus(reason instanceof Error ? reason.message : 'Could not copy the share link.');
    }
  };

  const downloadViewManifest = () => {
    const engine = engineRef.current;
    if (!engine || !asset) return;
    const manifest = {
      schema: 'modern-3d-workbench/view-manifest@1',
      source: remoteSourceUrl ? { kind: 'remote', url: remoteSourceUrl } : { kind: 'local', fileName: asset.stats.fileName, included: false },
      camera: engine.getCameraState(),
      transform: engine.getModelTransform(),
      settings,
      clipping,
      measurementUnit,
      annotations,
    };
    downloadBlob(new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }), `${asset.stats.fileName.replace(/\.[^.]+$/, '')}.view.json`);
    setShareStatus('View manifest downloaded. Local source geometry is not included.');
  };

  const sceneChanged = (object: Object3D, visible: boolean) => {
    object.visible = visible;
    engineRef.current?.applySettings({});
  };

  const openRouteSample = () => {
    if (route.id === 'vrm') openUrl(demoAvatarUrl());
    else openFiles([createCalibrationSample()]);
  };

  return (
    <div className={`app-shell ${asset && !inspectorOpen ? 'inspector-collapsed' : ''} ${asset?.avatar ? 'app-shell--avatar' : ''} ${route.id === 'embed' ? 'app-shell--embed' : ''}`}>
      <header className="app-header">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label={`${PRODUCT_NAME} home`}>
          <span className="brand__mark"><Boxes /></span>
          <span><strong>{PRODUCT_SHORT_NAME}</strong><em>WORKBENCH</em></span>
        </a>
        <nav className={mobileMenu ? 'is-open' : ''} aria-label="Primary navigation">
          <button type="button" onClick={() => setFormatDrawer(true)}>Formats <span>{FORMAT_DEFINITIONS.length}</span></button>
          <a href={vrmViewerUrl()}>VRM Studio</a>
          <a href="#capabilities">Capabilities</a>
          <a href={`${REPOSITORY_URL}#readme`} target="_blank" rel="noreferrer">Docs <ArrowUpRight /></a>
        </nav>
        <div className="header-actions">
          <span className="privacy-badge"><ShieldCheck /> Files stay local</span>
          <a className="github-link" href={REPOSITORY_URL} target="_blank" rel="noreferrer"><GitFork /><span>GitHub</span></a>
          <button type="button" className="mobile-menu" aria-label="Toggle menu" onClick={() => setMobileMenu((value) => !value)}>{mobileMenu ? <X /> : <Menu />}</button>
        </div>
      </header>

      <main id="main-content" className="app-main">
        {!asset && route.id === 'benchmark' && <BenchmarkPage />}
        {!asset && route.id !== 'benchmark' && (
          <div className="welcome-layout">
            <div className="welcome-copy">
              <p className="eyebrow"><Zap /> {route.eyebrow}</p>
              <h1>{route.headline} <em>{route.emphasizedHeadline}</em></h1>
              <p>{route.introduction}</p>
              <button type="button" className="sample-link" onClick={openRouteSample}><Sparkles /> {route.primaryAction}</button>
              {rendererError && <div className="compatibility-notice" role="status"><strong>3D rendering is unavailable in this session.</strong><span>Your files are untouched. Enable browser hardware acceleration or switch to a current browser, then reload.</span></div>}
            </div>
            <DropZone onFiles={openFiles} onUrl={openUrl} />
            <div id="capabilities" className="capability-strip">
              <article><strong>{FORMAT_DEFINITIONS.length}</strong><span>format families</span><p>CAD, print, web, point clouds, scenes, and toolpaths.</p></article>
              <article><strong>0</strong><span>server uploads</span><p>Parsing, diagnosis, repair, and export run locally.</p></article>
              <article><strong>&lt; 17 ms</strong><span>frame target</span><p>Adaptive pixel ratio and render-on-demand protect interaction.</p></article>
            </div>
            <div className="format-ribbon" aria-label="Popular supported formats">
              {route.formats.map((format) => <span key={format}>{format}</span>)}
            </div>
            <ProductPageContent route={route} />
          </div>
        )}

        <section className={`workbench ${asset ? 'has-asset' : ''}`} aria-hidden={!asset}>
          {asset && <SceneRail asset={asset} selection={selection} onSceneChange={sceneChanged} />}
          <div className="viewer-column">
            <div ref={viewportRef} className="viewport">
              <canvas ref={canvasRef} aria-label="Interactive 3D viewport" />
              {asset && (route.id !== 'embed' || embedControls) && <ViewerToolbar
                engineRef={engineRef}
                settings={settings}
                updateSettings={updateSettings}
                onSnapshot={snapshot}
                onFullscreen={() => void fullscreen()}
                hasAnimations={asset.animations.length > 0}
                animationPlaying={animationPlaying}
                onToggleAnimation={() => setAnimationPlaying(engineRef.current?.toggleAnimation() ?? false)}
                toolsOpen={toolsOpen}
                onTools={() => setToolsOpen((value) => !value)}
              />}
              {asset?.avatar && route.id !== 'embed' && <AvatarStudioPanel avatar={asset.avatar} engineRef={engineRef} demo={asset.stats.fileName === 'avatar-sample-b.vrm'} />}
              {asset && <ModelToolsPanel
                engineRef={engineRef}
                open={toolsOpen}
                onClose={() => setToolsOpen(false)}
                mode={interactionMode}
                onMode={chooseInteractionMode}
                measurement={measurement}
                unit={measurementUnit}
                onUnit={setMeasurementUnit}
                clipping={clipping}
                onClipping={updateClipping}
                annotationPoint={annotationPoint}
                onAnnotationPointHandled={clearAnnotationPoint}
                annotations={annotations}
                onAnnotations={setAnnotations}
                onTransform={transformModel}
                remoteSourceUrl={remoteSourceUrl}
                shareStatus={shareStatus}
                onCopyShare={() => void copyShareLink()}
                onDownloadManifest={downloadViewManifest}
              />}
              {progress && <LoadingOverlay progress={progress} />}
              {asset && <div className="viewport-badge"><span>{asset.stats.format}</span><strong>{asset.stats.fileName}</strong></div>}
              {asset && <button className="replace-button" type="button" onClick={reset}><Plus /> Open another</button>}
            </div>
            {asset && <StatusBar stats={asset.stats} telemetry={telemetry} />}
          </div>
          {asset && inspectorOpen && (
            <Inspector
              asset={asset}
              diagnostics={diagnostics}
              diagnosticsBusy={diagnosticsBusy}
              repairBusy={repairBusy}
              repairResult={repairResult}
              exportBusy={exportBusy}
              selection={selection}
              telemetry={telemetry}
              settings={settings}
              onSceneChange={sceneChanged}
              onAnalyze={() => void runDiagnostics()}
              onRepair={(options) => void repair(options)}
              onExport={(request) => void runExport(request)}
              onSettings={updateSettings}
            />
          )}
          {asset && <button className="inspector-toggle" type="button" aria-label={inspectorOpen ? 'Close inspector' : 'Open inspector'} onClick={() => setInspectorOpen((value) => !value)}>{inspectorOpen ? <PanelRightClose /> : <PanelRightOpen />}</button>}
        </section>
      </main>

      {error && <div className="error-toast" role="alert"><XCircleIcon /><div><strong>That model did not complete.</strong><p>{error}</p></div><button type="button" aria-label="Dismiss error" onClick={() => setError(null)}><X /></button></div>}
      {asset && progress && <progress className="global-progress" max="1" value={progress.progress} aria-label={progress.label} />}
      <FormatDrawer open={formatDrawer} onClose={() => setFormatDrawer(false)} />
      {formatDrawer && <button className="drawer-scrim" type="button" aria-label="Close format list" onClick={() => setFormatDrawer(false)} />}
    </div>
  );
}

function XCircleIcon() {
  return <RotateCcw />;
}
