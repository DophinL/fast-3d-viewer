import { Gauge, HardDrive, MonitorUp, MousePointer2, Triangle } from 'lucide-react';
import { formatBytes, formatNumber } from '../core/inspect';
import type { AssetStats, RendererTelemetry } from '../core/types';

export function StatusBar({ stats, telemetry }: { stats: AssetStats; telemetry: RendererTelemetry | null }) {
  return (
    <footer className="status-bar">
      <span title="Triangles"><Triangle /> {formatNumber(stats.triangles)} tris</span>
      <span title="Estimated decoded GPU memory"><HardDrive /> {formatBytes(stats.estimatedGpuBytes)}</span>
      <span title="Current render frame rate"><Gauge /> {telemetry ? `${Math.round(telemetry.fps)} fps` : 'measuring'}</span>
      <span title="Renderer"><MonitorUp /> {telemetry?.webglVersion ?? 'WebGL'}</span>
      <span className="status-bar__hint"><MousePointer2 /> Click to inspect · double-click to frame</span>
    </footer>
  );
}
