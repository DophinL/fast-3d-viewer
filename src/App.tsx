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
import type { AnimationClip, Object3D } from 'three';
import { DiagnosticsService } from './core/diagnostics';
import { createFileBundle, fetchRemoteBundle } from './core/file-bundle';
import { buildAssetIssues, collectGeometryPayloads, disposeObject, inspectAsset } from './core/inspect';
import { loadModel } from './core/load-model';
import { createCalibrationSample } from './core/samples';
import { createRepairedObject, downloadExport, exportModel } from './core/export-model';
import { findFormat } from './core/formats';
import type {
  ExportRequest,
  LoadedAsset,
  LoadProgress,
  MeshDiagnostics,
  RepairOptions,
  RepairResult,
  ViewerSettings,
} from './core/types';
import { DropZone } from './components/DropZone';
import { FormatDrawer } from './components/FormatDrawer';
import { Inspector } from './components/Inspector';
import { LoadingOverlay } from './components/LoadingOverlay';
import { StatusBar } from './components/StatusBar';
import { ViewerToolbar } from './components/ViewerToolbar';
import { useViewerEngine } from './hooks/useViewerEngine';

const INITIAL_SETTINGS: ViewerSettings = {
  renderMode: 'material',
  background: '#dcd8cd',
  environmentIntensity: 0.8,
  keyLightIntensity: 3.2,
  exposure: 1,
  toneMapping: 'neutral',
  showGrid: true,
  showAxes: false,
  showBounds: false,
  showStats: true,
  autoRotate: false,
  autoRotateSpeed: 1.4,
  shadows: true,
  transparentBackground: false,
  adaptiveQuality: true,
};

function downloadDataUrl(url: string, name: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
}

export function App() {
  const { viewportRef, canvasRef, engineRef, telemetry, selection, rendererError, applySettings } = useViewerEngine();
  const diagnosticsService = useRef(new DiagnosticsService());
  const activeAssetRef = useRef<LoadedAsset | null>(null);
  const [asset, setAsset] = useState<LoadedAsset | null>(null);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<MeshDiagnostics | null>(null);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);
  const [repairBusy, setRepairBusy] = useState(false);
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [settings, setSettings] = useState<ViewerSettings>(INITIAL_SETTINGS);
  const [formatDrawer, setFormatDrawer] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => () => {
    diagnosticsService.current.dispose();
    activeAssetRef.current?.cleanup();
  }, []);

  const updateSettings = useCallback((next: Partial<ViewerSettings>) => {
    setSettings((current) => {
      const merged = { ...current, ...next };
      applySettings(next);
      return merged;
    });
  }, [applySettings]);

  const runDiagnostics = useCallback(async (target = activeAssetRef.current) => {
    if (!target) return;
    setDiagnosticsBusy(true);
    try {
      const geometry = collectGeometryPayloads(target.root);
      const result = await diagnosticsService.current.analyze(geometry.payloads, geometry.scanLimited);
      if (activeAssetRef.current === target) setDiagnostics(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setDiagnosticsBusy(false);
    }
  }, []);

  const commitAsset = useCallback((next: LoadedAsset, completedRepair: RepairResult | null = null) => {
    engineRef.current?.setModel(next.root);
    activeAssetRef.current?.cleanup();
    activeAssetRef.current = next;
    setAsset(next);
    setDiagnostics(null);
    setRepairResult(completedRepair);
    setInspectorOpen(true);
    window.setTimeout(() => void runDiagnostics(next), 180);
  }, [engineRef, runDiagnostics]);

  const loadBundle = useCallback(async (bundlePromise: ReturnType<typeof createFileBundle>) => {
    setError(null);
    setProgress({ phase: 'reading', progress: 0.03, label: 'Preparing model package' });
    try {
      const bundle = await bundlePromise;
      const next = await loadModel(bundle, setProgress);
      commitAsset(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setProgress(null);
      return;
    }
    window.setTimeout(() => setProgress(null), 260);
  }, [commitAsset]);

  const openFiles = useCallback((files: File[]) => {
    if (rendererError) {
      setError('3D rendering is unavailable in this browser session. Enable hardware acceleration or try a current Chrome, Edge, Firefox, or Safari browser.');
      return;
    }
    void loadBundle(createFileBundle(files));
  }, [loadBundle, rendererError]);

  const openUrl = useCallback((url: string) => {
    if (rendererError) {
      setError('3D rendering is unavailable in this browser session. Enable hardware acceleration before opening a model.');
      return;
    }
    void loadBundle(fetchRemoteBundle(url));
  }, [loadBundle, rendererError]);

  const repair = useCallback(async (options: RepairOptions) => {
    const current = activeAssetRef.current;
    if (!current) return;
    setRepairBusy(true);
    setError(null);
    try {
      const geometry = collectGeometryPayloads(current.root);
      if (geometry.scanLimited) throw new Error('This mesh is above the interactive repair limit. Isolate or reduce it first.');
      const result = await diagnosticsService.current.repair(geometry.payloads, options);
      const root = createRepairedObject(result, `${current.stats.fileName.replace(/\.[^.]+$/, '')} repaired`);
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
        parser: 'Fast native loader',
        cleanup: () => disposeObject(root),
      };
      commitAsset(next, result);
    } catch (reason) {
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
      const result = await exportModel(current.root, current.stats.fileName, request, current.animations as AnimationClip[]);
      downloadExport(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setExportBusy(null);
    }
  }, []);

  const snapshot = () => {
    if (!asset) return;
    const data = engineRef.current?.snapshot(2, false);
    if (data) downloadDataUrl(data, `${asset.stats.fileName.replace(/\.[^.]+$/, '')}-view.png`);
  };

  const fullscreen = async () => {
    if (!viewportRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await viewportRef.current.requestFullscreen();
  };

  const reset = () => {
    activeAssetRef.current?.cleanup();
    activeAssetRef.current = null;
    engineRef.current?.clearModel();
    setAsset(null);
    setDiagnostics(null);
    setRepairResult(null);
    setError(null);
  };

  const sceneChanged = (object: Object3D, visible: boolean) => {
    object.visible = visible;
    engineRef.current?.applySettings({});
  };

  return (
    <div className={`app-shell ${asset && !inspectorOpen ? 'inspector-collapsed' : ''}`}>
      <header className="app-header">
        <a className="brand" href="./" aria-label="Fast 3D Viewer home">
          <span className="brand__mark"><Boxes /></span>
          <span><strong>FAST</strong><em>3D VIEWER</em></span>
        </a>
        <nav className={mobileMenu ? 'is-open' : ''} aria-label="Primary navigation">
          <button type="button" onClick={() => setFormatDrawer(true)}>Formats <span>27</span></button>
          <a href="#capabilities">Capabilities</a>
          <a href="https://github.com/DophinL/fast-3d-viewer#readme" target="_blank" rel="noreferrer">Docs <ArrowUpRight /></a>
        </nav>
        <div className="header-actions">
          <span className="privacy-badge"><ShieldCheck /> Files stay local</span>
          <a className="github-link" href="https://github.com/DophinL/fast-3d-viewer" target="_blank" rel="noreferrer"><GitFork /><span>GitHub</span></a>
          <button type="button" className="mobile-menu" aria-label="Toggle menu" onClick={() => setMobileMenu((value) => !value)}>{mobileMenu ? <X /> : <Menu />}</button>
        </div>
      </header>

      <main id="main-content" className="app-main">
        {!asset && (
          <div className="welcome-layout">
            <div className="welcome-copy">
              <p className="eyebrow"><Zap /> OPEN FASTER · FIND PROBLEMS EARLIER</p>
              <h1>A 3D viewer that tells you <em>what is wrong.</em></h1>
              <p>Open complete model packages, inspect real render cost, scan topology, repair common mesh defects, and export a clean working copy. Nothing is uploaded.</p>
              <button type="button" className="sample-link" onClick={() => openFiles([createCalibrationSample()])}><Sparkles /> Try the 3-second calibration sample</button>
              {rendererError && <div className="compatibility-notice" role="status"><strong>3D rendering is unavailable in this session.</strong><span>Your files are untouched. Enable browser hardware acceleration or switch to a current browser, then reload.</span></div>}
            </div>
            <DropZone onFiles={openFiles} onUrl={openUrl} />
            <div id="capabilities" className="capability-strip">
              <article><strong>27</strong><span>format families</span><p>CAD, BIM, print, web, point clouds, and toolpaths.</p></article>
              <article><strong>0</strong><span>server uploads</span><p>Parsing, diagnosis, repair, and export run locally.</p></article>
              <article><strong>&lt; 17 ms</strong><span>frame target</span><p>Adaptive pixel ratio and render-on-demand protect interaction.</p></article>
            </div>
            <div className="format-ribbon" aria-label="Popular supported formats">
              {['GLB', 'GLTF', 'OBJ + MTL', 'FBX', 'STL', 'STEP', 'IGES', 'IFC', '3MF', 'USDZ', 'PLY', 'VOX'].map((format) => <span key={format}>{format}</span>)}
            </div>
          </div>
        )}

        <section className={`workbench ${asset ? 'has-asset' : ''}`} aria-hidden={!asset}>
          <div className="viewer-column">
            <div ref={viewportRef} className="viewport">
              <canvas ref={canvasRef} aria-label="Interactive 3D viewport" />
              {asset && <ViewerToolbar engineRef={engineRef} settings={settings} updateSettings={updateSettings} onSnapshot={snapshot} onFullscreen={() => void fullscreen()} />}
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
      {asset && progress && <div className="global-progress" style={{ transform: `scaleX(${progress.progress})` }} />}
      <FormatDrawer open={formatDrawer} onClose={() => setFormatDrawer(false)} />
      {formatDrawer && <button className="drawer-scrim" type="button" aria-label="Close format list" onClick={() => setFormatDrawer(false)} />}
    </div>
  );
}

function XCircleIcon() {
  return <RotateCcw />;
}
