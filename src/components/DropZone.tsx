import { useRef, useState, type DragEvent } from 'react';
import { Box, FolderOpen, Link2, LockKeyhole, PackageOpen, Upload } from 'lucide-react';
import { getAcceptValue } from '../core/formats';

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  onUrl: (url: string) => void;
  compact?: boolean;
}

export function DropZone({ onFiles, onUrl, compact = false }: DropZoneProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState('');

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const files = [...event.dataTransfer.files];
    if (files.length) onFiles(files);
  };

  const submitUrl = () => {
    if (!url.trim()) return;
    onUrl(url.trim());
  };

  return (
    <section
      className={`drop-zone ${dragging ? 'is-dragging' : ''} ${compact ? 'is-compact' : ''}`}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
      onDrop={drop}
      aria-label="Open a 3D model"
    >
      <input ref={fileRef} hidden type="file" multiple accept={getAcceptValue()} onChange={(event) => onFiles([...event.target.files ?? []])} />
      <input ref={folderRef} hidden type="file" multiple {...({ webkitdirectory: '', directory: '' } as object)} onChange={(event) => onFiles([...event.target.files ?? []])} />
      <div className="drop-zone__mark" aria-hidden="true"><Box strokeWidth={1.25} /></div>
      <div className="drop-zone__copy">
        <p className="eyebrow">LOCAL-FIRST 3D WORKBENCH</p>
        <h1>{compact ? 'Replace model' : 'Drop the whole model package.'}</h1>
        {!compact && <p>Models, materials, textures, ZIP archives, and CAD assemblies stay in this browser.</p>}
      </div>
      <div className="drop-zone__actions">
        <button className="button button--primary" type="button" onClick={() => fileRef.current?.click()}><Upload /> Open files</button>
        <button className="button" type="button" onClick={() => folderRef.current?.click()}><FolderOpen /> Open folder</button>
        {!compact && <button className="button button--quiet" type="button" onClick={() => setShowUrl((value) => !value)}><Link2 /> Open URL</button>}
      </div>
      {showUrl && (
        <div className="url-entry">
          <label htmlFor="model-url">Public model URL</label>
          <div><input id="model-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitUrl(); }} placeholder="https://example.com/model.glb" /><button type="button" onClick={submitUrl}>Load model</button></div>
          <small>The server must allow cross-origin downloads.</small>
        </div>
      )}
      {!compact && (
        <div className="drop-zone__footnotes">
          <span><PackageOpen /> Multi-file and ZIP packages</span>
          <span><LockKeyhole /> No upload by default</span>
        </div>
      )}
    </section>
  );
}
