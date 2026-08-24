import { Box, Boxes, FileBox, Layers3, Timer, Triangle } from 'lucide-react';
import type { Object3D } from 'three';
import { formatBytes, formatNumber } from '../core/inspect';
import type { LoadedAsset } from '../core/types';
import { SceneTree } from './SceneTree';

interface SceneRailProps {
  asset: LoadedAsset;
  selection: Object3D | null;
  onSceneChange: (object: Object3D, visible: boolean) => void;
}

export function SceneRail({ asset, selection, onSceneChange }: SceneRailProps) {
  const { stats } = asset;
  return (
    <aside className="scene-rail" aria-label="Scene explorer">
      <header className="scene-rail__header">
        <span>Scene</span>
        <strong>{formatNumber(stats.meshes)} objects</strong>
      </header>
      <section className="scene-rail__asset">
        <div className="scene-rail__file">
          <span><FileBox /></span>
          <div><strong title={stats.fileName}>{stats.fileName}</strong><small>{stats.format} · {formatBytes(stats.totalBytes)}</small></div>
        </div>
        <dl className="scene-rail__facts">
          <div><dt><Triangle /> Triangles</dt><dd>{formatNumber(stats.triangles)}</dd></div>
          <div><dt><Layers3 /> Materials</dt><dd>{formatNumber(stats.materials)}</dd></div>
          <div><dt><Boxes /> Draw calls</dt><dd>{formatNumber(stats.drawCalls)}</dd></div>
          <div><dt><Timer /> Parsed</dt><dd>{(stats.loadDurationMs / 1000).toFixed(2)} s</dd></div>
        </dl>
      </section>
      <section className="scene-rail__graph">
        <div className="scene-rail__label"><span>Hierarchy</span><small>visibility</small></div>
        <div className="scene-rail__tree"><SceneTree root={asset.root} onChange={onSceneChange} /></div>
      </section>
      <section className="scene-rail__selection">
        <div className="scene-rail__label"><span>Selection</span></div>
        {selection ? (
          <div className="scene-rail__selected"><Box /><div><strong>{selection.name || selection.type}</strong><small>{selection.type} · {selection.uuid.slice(0, 8)}</small></div></div>
        ) : <p>Click an object in the viewport to inspect it.</p>}
      </section>
    </aside>
  );
}
