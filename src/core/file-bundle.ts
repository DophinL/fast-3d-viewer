import { unzipSync } from 'fflate';
import { findFormat, FORMAT_DEFINITIONS, getExtension, isSupportedFile } from './formats';
import type { FileBundle, FileEntry } from './types';

const MAX_ARCHIVE_FILES = 1_024;
const MAX_ARCHIVE_ENTRY_BYTES = 256 * 1024 * 1024;
const MAX_ARCHIVE_EXPANDED_BYTES = 512 * 1024 * 1024;

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

async function unpackZip(file: File): Promise<FileEntry[]> {
  let fileCount = 0;
  let expandedBytes = 0;
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (entry) => {
      assertSafeArchivePath(entry.name);
      if (entry.name.endsWith('/')) return false;
      ({ fileCount, expandedBytes } = accountArchiveEntry(entry.name, entry.originalSize, fileCount, expandedBytes));
      return true;
    },
  });
  return Object.entries(archive)
    .filter(([path, bytes]) => !path.endsWith('/') && bytes.byteLength > 0)
    .map(([path, bytes]) => {
      const normalizedPath = normalizePath(path);
      const extracted = new File([bytes], normalizedPath, { lastModified: file.lastModified });
      return asEntry(extracted, 'archive', normalizedPath);
    });
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
  for (const archive of archives) entries.push(...await unpackZip(archive));

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

export async function fetchRemoteBundle(url: string): Promise<FileBundle> {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP and HTTPS model URLs are supported.');
  const response = await fetch(parsed.toString(), { mode: 'cors' });
  if (!response.ok) throw new Error(`The model server returned HTTP ${response.status}.`);
  const name = decodeURIComponent(parsed.pathname.split('/').pop() || 'remote-model');
  const file = new File([await response.blob()], name, { type: response.headers.get('content-type') || '' });
  const bundle = await createFileBundle([file]);
  bundle.entries.forEach((entry) => { entry.source = 'remote'; });
  bundle.remoteBaseUrl = new URL('.', parsed).toString();
  return bundle;
}
