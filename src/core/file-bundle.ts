import { unzipSync } from 'fflate';
import { findFormat, FORMAT_DEFINITIONS, getExtension, isSupportedFile } from './formats';
import type { FileBundle, FileEntry } from './types';

const MAX_ARCHIVE_FILES = 1_024;
const MAX_ARCHIVE_ENTRY_BYTES = 256 * 1024 * 1024;
const MAX_ARCHIVE_EXPANDED_BYTES = 512 * 1024 * 1024;
const MAX_REMOTE_BYTES = 256 * 1024 * 1024;

type ArchiveWorkerResponse =
  | { ok: true; entries: Array<{ path: string; bytes: Uint8Array }>; fileCount: number; expandedBytes: number }
  | { ok: false; error: string };

export function accountArchiveEntry(name: string, originalSize: number, fileCount: number, expandedBytes: number) {
  const next = { fileCount: fileCount + 1, expandedBytes: expandedBytes + originalSize };
  if (next.fileCount > MAX_ARCHIVE_FILES) {
    throw new Error(`The archive contains more than ${MAX_ARCHIVE_FILES.toLocaleString()} files.`);
  }
  if (originalSize > MAX_ARCHIVE_ENTRY_BYTES) {
    throw new Error(`The archive entry ${name} expands beyond the 256 MB per-file limit.`);
  }
  if (next.expandedBytes > MAX_ARCHIVE_EXPANDED_BYTES) {
    throw new Error('The archive expands beyond the 512 MB interactive limit.');
  }
  return next;
}

const MAIN_FILE_PRIORITY = ['glb', ...FORMAT_DEFINITIONS.flatMap((format) => format.extensions).filter((extension) => extension !== 'glb')];

const normalizePath = (path: string) => path
  .replaceAll('\\', '/')
  .replace(/^\.\//, '')
  .split('/')
  .filter((part) => part && part !== '.' && part !== '..')
  .join('/');

function assertSafeArchivePath(path: string): void {
  const portable = path.replaceAll('\\', '/');
  const segments = portable.split('/');
  if (!portable || portable.startsWith('/') || /^[a-z]:\//i.test(portable)
    || segments.some((segment) => segment === '..')) {
    throw new Error(`The archive contains an unsafe path: ${path || '(empty)'}.`);
  }
}

function asEntry(file: File, source: FileEntry['source'], path = file.name): FileEntry {
  const normalizedPath = normalizePath(path);
  return {
    file,
    name: normalizedPath.split('/').pop() || file.name,
    normalizedPath,
    extension: getExtension(normalizedPath),
    size: file.size,
    source,
  };
}

function chooseMainFile(entries: FileEntry[]): FileEntry {
  const importable = entries.filter((entry) => findFormat(entry.extension));
  if (importable.length === 0) {
    throw new Error('No supported 3D file was found. Add a model file, not only textures or material files.');
  }
  return [...importable].sort((left, right) => {
    const leftPriority = MAIN_FILE_PRIORITY.indexOf(left.extension);
    const rightPriority = MAIN_FILE_PRIORITY.indexOf(right.extension);
    return (leftPriority < 0 ? 999 : leftPriority) - (rightPriority < 0 ? 999 : rightPriority)
      || right.size - left.size;
  })[0]!;
}

async function unpackZip(file: File, totals: { fileCount: number; expandedBytes: number }): Promise<{ entries: FileEntry[]; fileCount: number; expandedBytes: number }> {
  if (typeof Worker !== 'undefined') {
    const worker = new Worker(new URL('../workers/archive.worker.ts', import.meta.url), { type: 'module' });
    try {
      const bytes = await file.arrayBuffer();
      const result = await new Promise<{ entries: Array<{ path: string; bytes: Uint8Array }>; fileCount: number; expandedBytes: number }>((resolve, reject) => {
        worker.addEventListener('message', (event: MessageEvent<ArchiveWorkerResponse>) => {
          if (event.data.ok) resolve(event.data);
          else reject(new Error(event.data.error || 'Could not unpack the ZIP archive.'));
        }, { once: true });
        worker.addEventListener('error', (event) => reject(new Error(event.message || 'The archive worker stopped unexpectedly.')), { once: true });
        worker.postMessage({ bytes, ...totals }, [bytes]);
      });
      return {
        entries: result.entries.map(({ path, bytes }) => {
          const normalizedPath = normalizePath(path);
          return asEntry(new File([bytes as BlobPart], normalizedPath, { lastModified: file.lastModified }), 'archive', normalizedPath);
        }),
        fileCount: result.fileCount,
        expandedBytes: result.expandedBytes,
      };
    } finally {
      worker.terminate();
    }
  }
  let { fileCount, expandedBytes } = totals;
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (entry) => {
      assertSafeArchivePath(entry.name);
      if (entry.name.endsWith('/')) return false;
      ({ fileCount, expandedBytes } = accountArchiveEntry(entry.name, entry.originalSize, fileCount, expandedBytes));
      return true;
    },
  });
  const entries = Object.entries(archive)
    .filter(([path, bytes]) => !path.endsWith('/') && bytes.byteLength > 0)
    .map(([path, bytes]) => {
      const normalizedPath = normalizePath(path);
      const extracted = new File([bytes], normalizedPath, { lastModified: file.lastModified });
      return asEntry(extracted, 'archive', normalizedPath);
    });
  return { entries, fileCount, expandedBytes };
}

export async function createFileBundle(files: Iterable<File>): Promise<FileBundle> {
  const input = [...files];
  if (input.length === 0) throw new Error('Choose one 3D file or a complete model package.');

  const archives = input.filter((file) => getExtension(file.name) === 'zip');
  const ordinary = input.filter((file) => getExtension(file.name) !== 'zip');
  const entries = ordinary.map((file) => {
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    return asEntry(file, 'upload', relative || file.name);
  });
  let archiveTotals = { fileCount: 0, expandedBytes: 0 };
  for (const archive of archives) {
    const unpacked = await unpackZip(archive, archiveTotals);
    entries.push(...unpacked.entries);
    archiveTotals = { fileCount: unpacked.fileCount, expandedBytes: unpacked.expandedBytes };
  }

  const unique = new Map<string, FileEntry>();
  const warnings: string[] = [];
  for (const entry of entries) {
    const key = entry.normalizedPath.toLowerCase();
    if (unique.has(key)) warnings.push(`Ignored duplicate path: ${entry.normalizedPath}`);
    else unique.set(key, entry);
  }
  const deduplicated = [...unique.values()];
  const mainFile = chooseMainFile(deduplicated);
  const unsupportedCount = deduplicated.filter((entry) => !isSupportedFile(entry.name)
    && !['bin', 'mtl', 'jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp', 'tga', 'dds', 'ktx2'].includes(entry.extension)).length;
  if (unsupportedCount > 0) warnings.push(`${unsupportedCount} unrecognized companion file${unsupportedCount === 1 ? '' : 's'} kept in the package.`);

  return {
    entries: deduplicated,
    mainFile,
    totalBytes: deduplicated.reduce((total, entry) => total + entry.size, 0),
    archiveName: archives.length === 1 ? archives[0]!.name : undefined,
    warnings,
  };
}

export async function fetchRemoteBundle(url: string, signal?: AbortSignal): Promise<FileBundle> {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP and HTTPS model URLs are supported.');
  const response = await fetch(parsed.toString(), { mode: 'cors', signal });
  if (!response.ok) throw new Error(`The model server returned HTTP ${response.status}.`);
  const declaredBytes = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(declaredBytes) && declaredBytes > MAX_REMOTE_BYTES) {
    throw new Error('The remote model exceeds the 256 MB interactive limit.');
  }
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_REMOTE_BYTES) {
        await reader.cancel('Remote model byte limit exceeded');
        throw new Error('The remote model exceeds the 256 MB interactive limit.');
      }
      chunks.push(value);
    }
  } else {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_REMOTE_BYTES) throw new Error('The remote model exceeds the 256 MB interactive limit.');
    chunks.push(bytes);
  }
  let name = parsed.pathname.split('/').pop() || 'remote-model';
  try { name = decodeURIComponent(name); } catch { /* Preserve malformed-but-displayable URL text. */ }
  const file = new File(chunks as BlobPart[], name, { type: response.headers.get('content-type') || '' });
  const bundle = await createFileBundle([file]);
  bundle.entries.forEach((entry) => { entry.source = 'remote'; });
  bundle.remoteBaseUrl = new URL('.', parsed).toString();
  return bundle;
}
