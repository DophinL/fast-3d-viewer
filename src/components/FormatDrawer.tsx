import { Check, ChevronRight, PackageCheck, X } from 'lucide-react';
import { FORMAT_DEFINITIONS } from '../core/formats';

export function FormatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const groups = FORMAT_DEFINITIONS.reduce<Record<string, typeof FORMAT_DEFINITIONS>>((result, format) => {
    result[format.family] = [...(result[format.family] ?? []), format];
    return result;
  }, {});
  return (
    <aside
      className={`format-drawer ${open ? 'is-open' : ''}`}
      role="dialog"
      aria-label="Supported 3D formats"
      aria-modal="true"
      aria-hidden={!open}
    >
      <header>
        <div><p className="eyebrow">FORMAT MATRIX</p><h2>{FORMAT_DEFINITIONS.length} format families, honest package support.</h2></div>
        <button type="button" aria-label="Close format list" onClick={onClose}><X /></button>
      </header>
      <div className="format-drawer__body">
        {Object.entries(groups).map(([family, definitions]) => (
          <section key={family}>
            <h3>{family.replace('-', ' ')}</h3>
            <div className="format-list">
              {definitions.map((format) => (
                <article key={format.id}>
                  <div className="format-list__title"><strong>{format.label}</strong><span>{format.extensions.map((extension) => `.${extension}`).join(' ')}</span></div>
                  <p>{format.description}</p>
                  <div className="format-list__flags">
                    <span><Check /> View</span>
                    {format.packageSupport && <span><PackageCheck /> Packages</span>}
                    {format.repair && <span><ChevronRight /> Diagnose</span>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
