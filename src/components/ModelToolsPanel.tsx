import {
  ArrowDownToLine,
  Circle,
  Download,
  FlipHorizontal2,
  Maximize2,
  MessageSquarePlus,
  MousePointer2,
  RotateCcw,
  RotateCw,
  Ruler,
  ScissorsLineDashed,
  Share2,
  Trash2,
  Triangle,
  X,
} from 'lucide-react';
import { useState, type MutableRefObject, type ReactNode } from 'react';
import { formatMeasurement, MEASUREMENT_UNIT_LABELS } from '../core/measurements';
import type {
  ClippingSettings,
  MeasurementPoint,
  MeasurementResult,
  MeasurementUnit,
  ModelAnnotation,
  ViewerInteractionMode,
} from '../core/types';
import type { ViewerEngine } from '../viewer/ViewerEngine';

interface ModelToolsPanelProps {
  engineRef: MutableRefObject<ViewerEngine | null>;
  open: boolean;
  onClose: () => void;
  mode: ViewerInteractionMode;
  onMode: (mode: ViewerInteractionMode) => void;
  measurement: { result: MeasurementResult | null; collected: number; required: number };
  unit: MeasurementUnit;
  onUnit: (unit: MeasurementUnit) => void;
  clipping: ClippingSettings;
  onClipping: (settings: Partial<ClippingSettings>) => void;
  annotationPoint: MeasurementPoint | null;
  onAnnotationPointHandled: () => void;
  annotations: ModelAnnotation[];
  onAnnotations: (annotations: ModelAnnotation[]) => void;
  onTransform: (operation: (engine: ViewerEngine) => void) => void;
  remoteSourceUrl: string | null;
  shareStatus: string | null;
  onCopyShare: () => void;
  onDownloadManifest: () => void;
}

const modes: Array<{ id: ViewerInteractionMode; label: string; icon: ReactNode; hint: string }> = [
  { id: 'select', label: 'Select', icon: <MousePointer2 />, hint: 'Inspect scene nodes' },
  { id: 'distance', label: 'Distance', icon: <Ruler />, hint: 'Pick two points' },
  { id: 'angle', label: 'Angle', icon: <Triangle />, hint: 'Pick edge, vertex, edge' },
  { id: 'radius', label: 'Radius', icon: <Circle />, hint: 'Pick three points on a circle' },
  { id: 'annotate', label: 'Note', icon: <MessageSquarePlus />, hint: 'Place a local annotation' },
];

const units = Object.keys(MEASUREMENT_UNIT_LABELS) as MeasurementUnit[];

export function ModelToolsPanel(props: ModelToolsPanelProps) {
  const {
    engineRef,
    open,
    onClose,
    mode,
    onMode,
    measurement,
    unit,
    onUnit,
    clipping,
    onClipping,
    annotationPoint,
    onAnnotationPointHandled,
    annotations,
    onAnnotations,
    onTransform,
    remoteSourceUrl,
    shareStatus,
    onCopyShare,
    onDownloadManifest,
  } = props;
  const [note, setNote] = useState('');
  const [compact, setCompact] = useState(false);

  if (!open) return null;

  const addAnnotation = () => {
    if (!annotationPoint) return;
    onAnnotations([...annotations, {
      id: crypto.randomUUID(),
      label: note.trim() || `Note ${annotations.length + 1}`,
      point: annotationPoint,
      createdAt: new Date().toISOString(),
    }]);
    setNote('');
    onAnnotationPointHandled();
  };

  const runTransform = (operation: (engine: ViewerEngine) => void) => onTransform(operation);

  return (
    <aside className={`model-tools${compact ? ' is-compact' : ''}`} aria-label="Model tools">
      <header>
        <div><span>MODEL TOOLS</span><strong>{compact ? `${modes.find((item) => item.id === mode)?.label ?? 'Select'} mode` : 'Measure and correct'}</strong></div>
        <div className="model-tools__header-actions">
          {compact && <button type="button" aria-label="Show all model tools" onClick={() => setCompact(false)}><Maximize2 /></button>}
          <button type="button" aria-label="Close model tools" onClick={onClose}><X /></button>
        </div>
      </header>

      <section>
        <div className="model-tools__section-title"><Ruler /><span>Interaction</span></div>
        <div className="tool-mode-grid">
          {modes.map((item) => (
            <button key={item.id} type="button" className={mode === item.id ? 'is-active' : ''} onClick={() => { onMode(item.id); setCompact(item.id !== 'select'); }}>
              {item.icon}<strong>{item.label}</strong><small>{item.hint}</small>
            </button>
          ))}
        </div>
        {(mode === 'distance' || mode === 'angle' || mode === 'radius') && (
          <div className="measurement-readout" aria-live="polite">
            <div>
              <span>{measurement.result ? 'RESULT' : `PICK ${measurement.collected + 1} OF ${measurement.required}`}</span>
              <strong>{measurement.result ? formatMeasurement(measurement.result, unit) : 'Click geometry in the viewport'}</strong>
              {measurement.result?.kind === 'radius' && measurement.result.secondaryValue !== undefined && (
                <small>Diameter {formatMeasurement({ ...measurement.result, value: measurement.result.secondaryValue }, unit)}</small>
              )}
            </div>
            <button type="button" onClick={() => engineRef.current?.clearMeasurement()}><RotateCcw /> Clear</button>
          </div>
        )}
        <label className="compact-field">
          <span>Measurement unit <small>STL coordinates are unitless</small></span>
          <select value={unit} onChange={(event) => onUnit(event.target.value as MeasurementUnit)}>
            {units.map((value) => <option key={value} value={value}>{MEASUREMENT_UNIT_LABELS[value]}</option>)}
          </select>
        </label>
        {annotationPoint && (
          <form className="annotation-compose" onSubmit={(event) => { event.preventDefault(); addAnnotation(); }}>
            <span>Annotation point selected</span>
            <input autoFocus value={note} placeholder={`Note ${annotations.length + 1}`} maxLength={120} onChange={(event) => setNote(event.target.value)} aria-label="Annotation label" />
            <div><button type="submit">Save note</button><button type="button" onClick={onAnnotationPointHandled}>Cancel</button></div>
          </form>
        )}
        {annotations.length > 0 && (
          <ul className="annotation-list">
            {annotations.map((annotation, index) => (
              <li key={annotation.id}>
                <span>{index + 1}</span>
                <input value={annotation.label} aria-label={`Annotation ${index + 1}`} onChange={(event) => onAnnotations(annotations.map((item) => item.id === annotation.id ? { ...item, label: event.target.value } : item))} />
                <button type="button" aria-label={`Delete ${annotation.label}`} onClick={() => onAnnotations(annotations.filter((item) => item.id !== annotation.id))}><Trash2 /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!compact && <section>
        <div className="model-tools__section-title"><RotateCw /><span>Orientation</span></div>
        <p className="model-tools__note">The source format may not define front or up. These transforms are explicit and become part of an exported working copy.</p>
        <div className="orientation-grid">
          {(['x', 'y', 'z'] as const).map((axis) => (
            <div key={axis}>
              <span>{axis.toUpperCase()}</span>
              <button type="button" onClick={() => runTransform((engine) => engine.rotateModel(axis, -90))}>−90°</button>
              <button type="button" onClick={() => runTransform((engine) => engine.rotateModel(axis, 90))}>+90°</button>
            </div>
          ))}
        </div>
        <div className="orientation-actions">
          <button type="button" onClick={() => runTransform((engine) => engine.placeModelOnGround())}><ArrowDownToLine /> Place on ground</button>
          <button type="button" onClick={() => runTransform((engine) => engine.resetModelTransform())}><RotateCcw /> Reset transform</button>
        </div>
      </section>}

      {!compact && <section>
        <div className="model-tools__section-title"><ScissorsLineDashed /><span>Section plane</span></div>
        <label className="setting-toggle model-tools__toggle">
          <span><strong>Enable clipping</strong><small>Visual only; geometry is unchanged</small></span>
          <input type="checkbox" checked={clipping.enabled} onChange={(event) => onClipping({ enabled: event.target.checked })} />
        </label>
        <div className="section-axis" role="group" aria-label="Clipping axis">
          {(['x', 'y', 'z'] as const).map((axis) => <button key={axis} type="button" className={clipping.axis === axis ? 'is-active' : ''} onClick={() => onClipping({ axis })}>{axis.toUpperCase()}</button>)}
        </div>
        <label className="clip-position">
          <span>Plane position <output>{Math.round(clipping.position * 100)}%</output></span>
          <input type="range" min="0" max="1" step="0.01" value={clipping.position} onChange={(event) => onClipping({ position: Number(event.target.value) })} />
        </label>
        <button type="button" className="invert-plane" onClick={() => onClipping({ inverted: !clipping.inverted })}><FlipHorizontal2 /> {clipping.inverted ? 'Show forward side' : 'Invert visible side'}</button>
      </section>}

      {!compact && <section>
        <div className="model-tools__section-title"><Share2 /><span>Share and handoff</span></div>
        <p className="model-tools__note">{remoteSourceUrl ? 'The share link references the hosted model and stores only view settings in the URL.' : 'This model came from your device. A working share link cannot include it without uploading the source somewhere.'}</p>
        <div className="share-actions">
          <button type="button" onClick={onCopyShare}><Share2 /> Copy share link</button>
          <button type="button" onClick={onDownloadManifest}><Download /> Download view manifest</button>
        </div>
        {shareStatus && <p className="share-status" role="status">{shareStatus}</p>}
      </section>}
    </aside>
  );
}
