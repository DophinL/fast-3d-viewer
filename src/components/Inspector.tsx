import {
  Activity,
  AlertTriangle,
  Box,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Download,
  FileBox,
  Gauge,
  Info,
  Layers3,
  Package,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sparkles,
  Triangle,
  Wrench,
  XCircle,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Object3D } from 'three';
import { formatBytes, formatNumber } from '../core/inspect';
import type {
  AssetIssue,
  ExportRequest,
  LoadedAsset,
  MeshDiagnostics,
  RendererTelemetry,
  RepairOptions,
  RepairResult,
  ViewerSettings,
} from '../core/types';
import { SceneTree } from './SceneTree';

type Tab = 'scene' | 'health' | 'export';

interface InspectorProps {
  asset: LoadedAsset;
  diagnostics: MeshDiagnostics | null;
  diagnosticsBusy: boolean;
  repairBusy: boolean;
  repairResult: RepairResult | null;
  exportBusy: string | null;
  selection: Object3D | null;
  telemetry: RendererTelemetry | null;
  settings: ViewerSettings;
  onSceneChange: (object: Object3D, visible: boolean) => void;
  onAnalyze: () => void;
  onRepair: (options: RepairOptions) => void;
  onExport: (request: ExportRequest) => void;
  onSettings: (settings: Partial<ViewerSettings>) => void;
}

const severityIcon: Record<AssetIssue['severity'], ReactNode> = {
  error: <XCircle />,
  warning: <AlertTriangle />,
  info: <Info />,
  pass: <CheckCircle2 />,
};

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return <div className="stat-row"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

function IssueRow({ issue }: { issue: AssetIssue }) {
  return (
    <article className={`issue-row issue-row--${issue.severity}`}>
      <div className="issue-row__icon">{severityIcon[issue.severity]}</div>
      <div><strong>{issue.title}</strong><p>{issue.detail}</p>{issue.fix && <small>{issue.fix}</small>}</div>
    </article>
  );
}

function Section({ title, icon, children, initial = true }: { title: string; icon: ReactNode; children: ReactNode; initial?: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <section className={`inspector-section ${open ? 'is-open' : ''}`}>
      <button type="button" className="inspector-section__heading" onClick={() => setOpen((value) => !value)}>
        <span>{icon}{title}</span><ChevronDown />
      </button>
      <div className="inspector-section__collapsible"><div>{children}</div></div>
    </section>
  );
}

function ScenePanel({ asset, selection, telemetry, onChange }: Pick<InspectorProps, 'asset' | 'selection' | 'telemetry'> & { onChange: InspectorProps['onSceneChange'] }) {
  const { stats } = asset;
  return (
    <>
      <Section title="Asset" icon={<FileBox />}>
        <div className="asset-identity">
          <span className="asset-identity__format">{stats.format}</span>
          <div><strong title={stats.fileName}>{stats.fileName}</strong><small>{formatBytes(stats.totalBytes)} · {stats.fileCount} file{stats.fileCount === 1 ? '' : 's'}</small></div>
        </div>
        <div className="stat-table">
          <Stat label="Parser" value={asset.parser.replace(' engine', '')} />
          <Stat label="Load" value={`${(stats.loadDurationMs / 1000).toFixed(2)} s`} />
          <Stat label="GPU estimate" value={formatBytes(stats.estimatedGpuBytes)} />
          <Stat label="Package" value={asset.format.packageSupport ? 'Complete' : 'Single-file'} />
        </div>
      </Section>
      <Section title="Geometry" icon={<Triangle />}>
        <div className="metric-grid">
          <div><strong>{formatNumber(stats.triangles)}</strong><span>Triangles</span></div>
          <div><strong>{formatNumber(stats.vertices)}</strong><span>Vertices</span></div>
          <div><strong>{formatNumber(stats.meshes)}</strong><span>Meshes</span></div>
          <div><strong>{formatNumber(stats.drawCalls)}</strong><span>Draw calls</span></div>
        </div>
        <div className="stat-table">
          <Stat label="Dimensions X" value={stats.dimensions.x.toFixed(3)} />
          <Stat label="Dimensions Y" value={stats.dimensions.y.toFixed(3)} />
          <Stat label="Dimensions Z" value={stats.dimensions.z.toFixed(3)} />
          <Stat label="Normals" value={stats.hasNormals ? 'Yes' : 'Missing'} />
          <Stat label="UV channel" value={stats.hasUV ? 'Yes' : 'Missing'} />
        </div>
      </Section>
      <Section title="Materials & motion" icon={<Layers3 />}>
        <div className="stat-table">
          <Stat label="Materials" value={stats.materials} />
          <Stat label="Textures" value={stats.textures} />
          <Stat label="PBR materials" value={stats.hasPbr ? 'Yes' : 'No'} />
          <Stat label="Animations" value={stats.animations} />
          <Stat label="Bones" value={stats.bones} />
        </div>
      </Section>
      <Section title="Scene graph" icon={<Package />} initial={false}>
        <SceneTree root={asset.root} onChange={onChange} />
      </Section>
      {selection && (
        <Section title="Selection" icon={<Box />}>
          <div className="selection-summary"><strong>{selection.name || selection.type}</strong><small>{selection.type} · {selection.uuid.slice(0, 8)}</small></div>
        </Section>
      )}
      {telemetry && (
        <Section title="Live renderer" icon={<Gauge />} initial={false}>
          <div className="stat-table">
            <Stat label="Frame rate" value={`${Math.round(telemetry.fps)} fps`} />
            <Stat label="Frame time" value={`${telemetry.frameTimeMs.toFixed(1)} ms`} />
            <Stat label="Pixel ratio" value={`${telemetry.pixelRatio.toFixed(2)}×`} />
            <Stat label="API" value={telemetry.webglVersion} />
          </div>
          <p className="renderer-name">{telemetry.renderer}</p>
        </Section>
      )}
    </>
  );
}

function HealthPanel({ asset, diagnostics, diagnosticsBusy, repairBusy, repairResult, onAnalyze, onRepair }: Pick<InspectorProps, 'asset' | 'diagnostics' | 'diagnosticsBusy' | 'repairBusy' | 'repairResult' | 'onAnalyze' | 'onRepair'>) {
  const [options, setOptions] = useState<RepairOptions>({
    removeDegenerate: true,
    removeDuplicates: true,
    mergeTolerance: 0,
    fillSimpleHoles: true,
    maxHoleEdges: 128,
    centerGeometry: false,
  });
  const issues = [...asset.issues, ...(diagnostics?.issues ?? [])];
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;
  return (
    <>
      <div className={`health-verdict ${errors ? 'has-errors' : warnings ? 'has-warnings' : 'is-pass'}`}>
        <div>{errors ? <XCircle /> : warnings ? <AlertTriangle /> : <ShieldCheck />}</div>
        <span>{errors ? `${errors} repair risk${errors === 1 ? '' : 's'}` : warnings ? `${warnings} warning${warnings === 1 ? '' : 's'}` : 'Ready for the next step'}</span>
        <strong>{diagnostics ? diagnostics.watertight ? 'WATERTIGHT' : 'OPEN MESH' : 'SCENE CHECKED'}</strong>
      </div>
      <Section title="Findings" icon={<Activity />}>
        <div className="issue-list">{issues.map((issue, index) => <IssueRow key={`${issue.code}-${index}`} issue={issue} />)}</div>
      </Section>
      <Section title="Topology" icon={<ScanLine />}>
        {!diagnostics && (
          <div className="analysis-prompt"><p>Scan welded edges, face orientation, holes, duplicate faces, area, and signed volume in a background worker.</p><button className="button button--primary" type="button" disabled={diagnosticsBusy} onClick={onAnalyze}>{diagnosticsBusy ? <><span className="spinner" /> Scanning mesh</> : <><ScanLine /> Run topology scan</>}</button></div>
        )}
        {diagnostics && !diagnostics.scanLimited && (
          <div className="stat-table">
            <Stat label="Scanned faces" value={formatNumber(diagnostics.scannedTriangles)} />
            <Stat label="Welded vertices" value={formatNumber(diagnostics.uniqueVertices)} />
            <Stat label="Boundary edges" value={formatNumber(diagnostics.boundaryEdges)} />
            <Stat label="Non-manifold" value={formatNumber(diagnostics.nonManifoldEdges)} />
            <Stat label="Surface area" value={formatNumber(diagnostics.surfaceArea)} />
            <Stat label="Closed volume" value={diagnostics.watertight ? formatNumber(diagnostics.signedVolume) : 'Not reliable'} />
            <Stat label="Scan time" value={`${diagnostics.durationMs} ms`} />
          </div>
        )}
      </Section>
      {asset.format.repair && diagnostics && !diagnostics.scanLimited && (
        <Section title="Local repair" icon={<Wrench />}>
          <p className="section-note">Repairs run locally and create a triangle-mesh copy. The source file is never overwritten.</p>
          <div className="repair-options">
            <label><input type="checkbox" checked={options.removeDegenerate} onChange={(event) => setOptions({ ...options, removeDegenerate: event.target.checked })} /><span><strong>Remove invalid faces</strong><small>Collapsed and zero-area triangles</small></span></label>
            <label><input type="checkbox" checked={options.removeDuplicates} onChange={(event) => setOptions({ ...options, removeDuplicates: event.target.checked })} /><span><strong>Remove duplicate faces</strong><small>Same welded vertex triplet</small></span></label>
            <label><input type="checkbox" checked={options.fillSimpleHoles} onChange={(event) => setOptions({ ...options, fillSimpleHoles: event.target.checked })} /><span><strong>Fill simple planar holes</strong><small>Boundaries up to {options.maxHoleEdges} edges</small></span></label>
            <label><input type="checkbox" checked={options.centerGeometry} onChange={(event) => setOptions({ ...options, centerGeometry: event.target.checked })} /><span><strong>Center repaired copy</strong><small>Move its bounding-box center to origin</small></span></label>
          </div>
          <button className="button button--primary button--full" type="button" disabled={repairBusy} onClick={() => onRepair(options)}>{repairBusy ? <><span className="spinner" /> Repairing mesh</> : <><Sparkles /> Create repaired copy</>}</button>
          {repairResult && <div className="repair-result"><CheckCircle2 /><div><strong>Repaired in {repairResult.durationMs} ms</strong><span>{repairResult.removedFaces} faces removed · {repairResult.filledHoles} holes filled · {formatNumber(repairResult.afterTriangles)} faces remain</span></div></div>}
        </Section>
      )}
    </>
  );
}

function ExportPanel({ asset, exportBusy, onExport }: Pick<InspectorProps, 'asset' | 'exportBusy' | 'onExport'>) {
  const outputs: Array<{ format: ExportRequest['format']; label: string; note: string }> = [
    { format: 'glb', label: 'GLB', note: 'Portable web model, textures embedded' },
    { format: 'gltf', label: 'glTF', note: 'Readable JSON scene description' },
    { format: 'obj', label: 'OBJ', note: 'Broad mesh-tool compatibility' },
    { format: 'stl', label: 'STL', note: 'Binary triangle surface for printing' },
    { format: 'ply', label: 'PLY', note: 'Geometry and vertex colors' },
    { format: 'usdz', label: 'USDZ', note: 'Spatial preview package' },
  ];
  return (
    <>
      <div className="export-intro"><Download /><div><strong>Export the scene you see.</strong><p>Exports are built locally from the parsed render scene. Keep the source when CAD or BIM semantics matter.</p></div></div>
      <Section title="Web & interchange" icon={<Package />}>
        <div className="export-list">
          {outputs.map((output) => (
            <button type="button" key={output.format} disabled={Boolean(exportBusy)} onClick={() => onExport({ format: output.format, binary: true, onlyVisible: true, includeAnimations: true })}>
              <span className="export-list__format">{output.format}</span>
              <span><strong>{exportBusy === output.format ? `Building ${output.label}…` : `Download ${output.label}`}</strong><small>{output.note}</small></span>
              <Download />
            </button>
          ))}
        </div>
      </Section>
      <div className="semantic-warning"><CircleHelp /><p><strong>Mesh export is not CAD conversion.</strong> STEP, IFC, FreeCAD, and Rhino object properties may not survive scene export.</p></div>
      <div className="source-package"><FileBox /><div><strong>{asset.bundle.entries.length} source file{asset.bundle.entries.length === 1 ? '' : 's'} loaded</strong><span>{asset.bundle.archiveName ? `from ${asset.bundle.archiveName}` : 'from your local selection'}</span></div></div>
    </>
  );
}

function SettingsPanel({ settings, onSettings }: Pick<InspectorProps, 'settings' | 'onSettings'>) {
  return (
    <Section title="Viewport settings" icon={<Settings2 />} initial={false}>
      <div className="setting-list">
        <label><span>Exposure <output>{settings.exposure.toFixed(1)}</output></span><input type="range" min="0.2" max="2.5" step="0.1" value={settings.exposure} onChange={(event) => onSettings({ exposure: Number(event.target.value) })} /></label>
        <label><span>Key light <output>{settings.keyLightIntensity.toFixed(1)}</output></span><input type="range" min="0" max="8" step="0.1" value={settings.keyLightIntensity} onChange={(event) => onSettings({ keyLightIntensity: Number(event.target.value) })} /></label>
        <label><span>Environment <output>{settings.environmentIntensity.toFixed(1)}</output></span><input type="range" min="0" max="3" step="0.1" value={settings.environmentIntensity} onChange={(event) => onSettings({ environmentIntensity: Number(event.target.value) })} /></label>
        <label className="setting-toggle"><span><strong>Adaptive quality</strong><small>Adjust resolution to hold frame time</small></span><input type="checkbox" checked={settings.adaptiveQuality} onChange={(event) => onSettings({ adaptiveQuality: event.target.checked })} /></label>
      </div>
    </Section>
  );
}

export function Inspector(props: InspectorProps) {
  const [tab, setTab] = useState<Tab>('scene');
  return (
    <aside className="inspector-panel">
      <div className="inspector-tabs" role="tablist" aria-label="Model inspector">
        {(['scene', 'health', 'export'] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{item}</button>
        ))}
      </div>
      <div className="inspector-scroll">
        {tab === 'scene' && <ScenePanel asset={props.asset} selection={props.selection} telemetry={props.telemetry} onChange={props.onSceneChange} />}
        {tab === 'health' && <HealthPanel {...props} />}
        {tab === 'export' && <ExportPanel {...props} />}
        <SettingsPanel settings={props.settings} onSettings={props.onSettings} />
      </div>
    </aside>
  );
}
