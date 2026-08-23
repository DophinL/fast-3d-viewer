import { unzipSync } from 'fflate';
import { findFormat, getExtension, isSupportedFile } from './formats';
import type { FileBundle, FileEntry } from './types';

const MAIN_FILE_PRIORITY = [
  'glb', 'gltf', 'fbx', 'obj', 'usdz', 'step', 'stp', 'iges', 'igs', 'brep', '3dm',
  'fcstd', 'ifc', '3mf', 'stl', 'ply', 'dae', '3ds', 'wrl', 'vrml', 'vox', 'ldr',
  'mpd', 'pcd', 'vtk', 'vtp', 'xyz', 'gcode', 'md2',
];

const normalizePath = (path: string) => path
  .replaceAll('\\', '/')
  .replace(/^\.\//, '')
  .split('/')
  .filter((part) => part && part !== '.' && part !== '..')
  .join('/');

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
  const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
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
  return bundle;
}
