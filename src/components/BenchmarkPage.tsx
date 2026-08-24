import { Activity, Download, Gauge, Play, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { runViewerBenchmark, type ViewerBenchmarkReport } from '../core/benchmark';

declare global {
  interface Window { __MODERN_3D_BENCHMARK__?: ViewerBenchmarkReport }
}

function download(report: ViewerBenchmarkReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `modern-3d-benchmark-${report.completedAt.replaceAll(/[:.]/g, '-')}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function BenchmarkPage() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 21, label: 'Ready' });
  const [report, setReport] = useState<ViewerBenchmarkReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const next = await runViewerBenchmark((completed, total, label) => setProgress({ completed, total, label }));
      window.__MODERN_3D_BENCHMARK__ = next;
      setReport(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="benchmark-page">
      <header>
        <p className="eyebrow"><Gauge /> REPRODUCIBLE VIEWER BENCHMARK</p>
        <h1>Measure the workbench. <em>Do not trust the adjective.</em></h1>
        <p>Three deterministic parser and scene-assembly workloads, warm-up iterations, raw samples, environment metadata, and a portable JSON result. This page does not claim competitor superiority before an identical protocol is run.</p>
        <div className="benchmark-actions">
          <button type="button" className="button button--primary" disabled={busy} onClick={() => void run()}><Play /> {busy ? 'Benchmark running…' : 'Run benchmark'}</button>
          {report && <button type="button" className="button" onClick={() => download(report)}><Download /> Export JSON</button>}
        </div>
      </header>
      <aside className="benchmark-protocol">
        <div><ShieldCheck /><span>2 warm-ups</span><small>Excluded from results</small></div>
        <div><Activity /><span>7 samples</span><small>Median and p95 retained</small></div>
        <div><Gauge /><span>3 fixtures</span><small>STL, OBJ, DotBIM</small></div>
      </aside>
      {busy && <div className="benchmark-progress"><span style={{ transform: `scaleX(${progress.completed / progress.total})` }} /><strong>{progress.label}</strong><small>{progress.completed} / {progress.total} measured iterations</small></div>}
      {error && <p className="benchmark-error" role="alert">{error}</p>}
      {report && (
        <section className="benchmark-results" aria-label="Benchmark results">
          {report.cases.map((result) => (
            <article key={result.id}>
              <span>{result.fixture}</span>
              <h2>{result.label}</h2>
              <div><strong>{result.medianMs.toFixed(2)} ms</strong><small>median</small></div>
              <dl><div><dt>p95</dt><dd>{result.p95Ms.toFixed(2)} ms</dd></div><div><dt>min</dt><dd>{result.minimumMs.toFixed(2)} ms</dd></div><div><dt>max</dt><dd>{result.maximumMs.toFixed(2)} ms</dd></div></dl>
            </article>
          ))}
          <footer><span>{report.environment.webgl2 ? 'WebGL 2 available' : 'WebGL 2 unavailable'}</span><span>{report.environment.logicalProcessors ?? 'Unknown'} logical processors</span><span>{report.protocol.measuredIterations} measured iterations</span></footer>
        </section>
      )}
    </div>
  );
}
