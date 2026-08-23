import type { LoadProgress } from '../core/types';

export function LoadingOverlay({ progress }: { progress: LoadProgress }) {
  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="scan-object" aria-hidden="true">
        <span className="scan-object__ring scan-object__ring--x" />
        <span className="scan-object__ring scan-object__ring--y" />
        <span className="scan-object__cube"><i /><i /><i /><i /><i /><i /></span>
        <span className="scan-object__plane" />
      </div>
      <div className="loading-overlay__copy">
        <span>{progress.phase}</span>
        <strong>{progress.label}</strong>
      </div>
      <div className="progress-track" aria-label={`${Math.round(progress.progress * 100)}% loaded`}>
        <span style={{ transform: `scaleX(${Math.max(0.02, progress.progress)})` }} />
      </div>
    </div>
  );
}
