import {
  AnimationClip,
  Group,
  LoadingManager,
  Mesh,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { findFormat } from './formats';
import { buildAssetIssues, disposeObject, inspectAsset } from './inspect';
import type { FileBundle, LoadedAsset, LoadProgress } from './types';

type ProgressCallback = (progress: LoadProgress) => void;

interface ParsedScene {
  root: Object3D;
  animations: AnimationClip[];
  parser: LoadedAsset['parser'];
  cleanup?: () => void;
}

const update = (callback: ProgressCallback, phase: LoadProgress['phase'], progress: number, label: string) => {
  callback({ phase, progress, label });
};

const readText = (file: File) => file.text();
const readBuffer = (file: File) => file.arrayBuffer();

function createPackageManager(bundle: FileBundle): { manager: LoadingManager; cleanup: () => void } {
  const manager = new LoadingManager();
  const objectUrls = new Map<string, string>();
  const entriesByPath = new Map(bundle.entries.map((entry) => [entry.normalizedPath.toLowerCase(), entry]));
  const entriesByName = new Map<string, typeof bundle.entries>();
  for (const entry of bundle.entries) {
    const key = entry.name.toLowerCase();
    entriesByName.set(key, [...(entriesByName.get(key) ?? []), entry]);
  }
  manager.setURLModifier((requestedUrl) => {
    if (/^(?:data:|blob:)/i.test(requestedUrl)) return requestedUrl;
    if (/^https?:/i.test(requestedUrl)) {
      if (!bundle.remoteBaseUrl) throw new Error(`Blocked external resource in a local model: ${requestedUrl}`);
      const target = new URL(requestedUrl);
      const source = new URL(bundle.remoteBaseUrl);
      if (target.origin !== source.origin) throw new Error(`Blocked cross-origin model resource: ${target.origin}`);
      return target.toString();
    }
    let decoded = requestedUrl;
    try { decoded = decodeURIComponent(requestedUrl); } catch { /* Keep the original lookup key. */ }
    const normalized = decoded.split(/[?#]/, 1)[0]!.replaceAll('\\', '/').replace(/^\.\//, '').replace(/^\//, '');
    const name = normalized.split('/').pop()?.toLowerCase() ?? normalized.toLowerCase();
    const exact = entriesByPath.get(normalized.toLowerCase());
    const namedCandidates = entriesByName.get(name) ?? [];
    if (!exact && namedCandidates.length > 1) {
      throw new Error(`Ambiguous companion file "${name}" exists in multiple folders. Keep its relative path in the model package.`);
    }
    const entry = exact ?? namedCandidates[0];
    if (!entry) {
      if (!bundle.remoteBaseUrl) throw new Error(`Missing local companion file: ${requestedUrl}`);
      const target = new URL(requestedUrl, bundle.remoteBaseUrl);
      const source = new URL(bundle.remoteBaseUrl);
      if (target.origin !== source.origin) throw new Error(`Blocked cross-origin model resource: ${target.origin}`);
      return target.toString();
    }
    let objectUrl = objectUrls.get(entry.normalizedPath);
    if (!objectUrl) {
      objectUrl = URL.createObjectURL(entry.file);
      objectUrls.set(entry.normalizedPath, objectUrl);
    }
    return objectUrl;
  });
  return {
    manager,
    cleanup: () => objectUrls.forEach((url) => URL.revokeObjectURL(url)),
  };
}

async function parseExtra(bundle: FileBundle, onProgress: ProgressCallback): Promise<ParsedScene> {
  const file = bundle.mainFile.file;
  const extension = bundle.mainFile.extension;
  update(onProgress, 'parsing', 0.35, `Parsing ${extension.toUpperCase()}`);

  if (extension === 'gltf' || extension === 'glb') {
    const resources = createPackageManager(bundle);
    try {
      const [{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }] = await Promise.all([
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/loaders/DRACOLoader.js'),
        import('three/examples/jsm/libs/meshopt_decoder.module.js'),
      ]);
      const draco = new DRACOLoader(resources.manager);
      draco.setDecoderPath(new URL('./draco/', document.baseURI).toString());
      const loader = new GLTFLoader(resources.manager).setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
      const input = extension === 'glb' ? await readBuffer(file) : await readText(file);
      const parsed = await new Promise<Awaited<ReturnType<typeof loader.parseAsync>>>((resolve, reject) => {
        loader.parse(input, '', resolve, reject);
      });
      return {
        root: parsed.scene,
        animations: parsed.animations,
        parser: 'Fast native loader',
        cleanup: () => { resources.cleanup(); draco.dispose(); },
      };
    } catch (error) {
      resources.cleanup();
      throw error;
    }
  }
  if (extension === 'fbx') {
    const resources = createPackageManager(bundle);
    try {
      const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
      const root = new FBXLoader(resources.manager).parse(await readBuffer(file), '');
      return { root, animations: root.animations, parser: 'Fast native loader', cleanup: resources.cleanup };
    } catch (error) {
      resources.cleanup();
      throw error;
    }
  }
  if (extension === 'dae') {
    const resources = createPackageManager(bundle);
    try {
      const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');
      const parsed = new ColladaLoader(resources.manager).parse(await readText(file), '');
      if (!parsed) throw new Error('The COLLADA parser did not produce a scene.');
      return { root: parsed.scene, animations: parsed.scene.animations, parser: 'Fast native loader', cleanup: resources.cleanup };
    } catch (error) {
      resources.cleanup();
      throw error;
    }
  }

  if (extension === 'usdz') {
    const { USDZLoader } = await import('three/examples/jsm/loaders/USDZLoader.js');
    return { root: new USDZLoader().parse(await readBuffer(file)), animations: [], parser: 'Fast native loader' };
  }
  if (extension === 'vox') {
    const { VOXLoader, VOXMesh } = await import('three/examples/jsm/loaders/VOXLoader.js');
    const result = new VOXLoader().parse(await readBuffer(file));
    const root = new Group();
    result.chunks.forEach((chunk) => root.add(new VOXMesh(chunk)));
    return { root, animations: [], parser: 'Fast native loader' };
  }
  if (['ldr', 'mpd', 'dat'].includes(extension)) {
    const { LDrawLoader } = await import('three/examples/jsm/loaders/LDrawLoader.js');
    const resources = createPackageManager(bundle);
    try {
      const text = await readText(file);
      const parsed = await new Promise<Group>((resolve, reject) => new LDrawLoader(resources.manager).parse(text, resolve, reject));
      return { root: parsed, animations: [], parser: 'Fast native loader', cleanup: resources.cleanup };
    } catch (error) {
      resources.cleanup();
      throw error;
    }
  }
  if (extension === 'xyz') {
    const { XYZLoader } = await import('three/examples/jsm/loaders/XYZLoader.js');
    const text = await readText(file);
    const geometry = (new XYZLoader() as unknown as { parse: (source: string) => BufferGeometry }).parse(text);
    return { root: new Points(geometry, new PointsMaterial({ size: 0.015, vertexColors: Boolean(geometry.getAttribute('color')), color: 0x20262b })), animations: [], parser: 'Fast native loader' };
  }
  if (extension === 'pcd') {
    const { PCDLoader } = await import('three/examples/jsm/loaders/PCDLoader.js');
    return { root: new PCDLoader().parse(await readBuffer(file)), animations: [], parser: 'Fast native loader' };
  }
  if (['vtk', 'vtp'].includes(extension)) {
    const { VTKLoader } = await import('three/examples/jsm/loaders/VTKLoader.js');
    const geometry = new VTKLoader().parse(await readBuffer(file), '');
    geometry.computeVertexNormals();
    return { root: new Mesh(geometry, new MeshStandardMaterial({ color: 0xb9b2a0, roughness: 0.72, metalness: 0.02 })), animations: [], parser: 'Fast native loader' };
  }
  if (extension === 'kmz') {
    const { KMZLoader } = await import('three/examples/jsm/loaders/KMZLoader.js');
    const input = await readBuffer(file);
    const { unzipSync } = await import('fflate');
    const contents = unzipSync(new Uint8Array(input), {
      filter: (entry) => {
        if (entry.originalSize > 256 * 1024 * 1024) throw new Error(`KMZ entry ${entry.name} exceeds the 256 MB limit.`);
        return /\.(?:dae|kml)$/i.test(entry.name);
      },
    });
    for (const [name, bytes] of Object.entries(contents)) {
      const source = new TextDecoder().decode(bytes);
      if (/(?:https?:)?\/\//i.test(source)) throw new Error(`Blocked an external resource reference in local KMZ entry ${name}.`);
    }
    const result = new KMZLoader().parse(input);
    return { root: result.scene, animations: [], parser: 'Fast native loader' };
  }
  if (['gcode', 'gco', 'nc'].includes(extension)) {
    const { GCodeLoader } = await import('three/examples/jsm/loaders/GCodeLoader.js');
    return { root: new GCodeLoader().parse(await readText(file)), animations: [], parser: 'Fast native loader' };
  }
  if (extension === 'md2') {
    const { MD2Loader } = await import('three/examples/jsm/loaders/MD2Loader.js');
    const geometry = new MD2Loader().parse(await readBuffer(file)) as BufferGeometry & { animations?: AnimationClip[] };
    return {
      root: new Mesh(geometry, new MeshStandardMaterial({ color: 0xb9b2a0, roughness: 0.72 })),
      animations: geometry.animations ?? [],
      parser: 'Fast native loader',
    };
  }
  throw new Error(`The ${extension.toUpperCase()} loader is registered but not available in this browser build.`);
}

async function parseUpstream(bundle: FileBundle, onProgress: ProgressCallback): Promise<ParsedScene> {
  update(onProgress, 'parsing', 0.28, 'Starting format engine');
  const engine = await import('../../vendor/online3dviewer/source/engine/main.js');
  const loader = new engine.ThreeModelLoader();
  const settings = new engine.ImportSettings();
  const orderedFiles = [bundle.mainFile, ...bundle.entries.filter((entry) => entry !== bundle.mainFile)].map((entry) => entry.file);
  const inputFiles = engine.InputFilesFromFileObjects(orderedFiles);

  return new Promise<ParsedScene>((resolve, reject) => {
    loader.LoadModel(inputFiles, settings, {
      onLoadStart: () => update(onProgress, 'reading', 0.12, 'Reading model package'),
      onFileListProgress: (current: number, total: number) => update(onProgress, 'reading', 0.12 + (current / Math.max(total, 1)) * 0.12, `Reading file ${current + 1} of ${total}`),
      onFileLoadProgress: (current: number, total: number) => update(onProgress, 'reading', 0.12 + (current / Math.max(total, 1)) * 0.12, 'Reading bytes'),
      onImportStart: () => update(onProgress, 'parsing', 0.32, `Parsing ${bundle.mainFile.extension.toUpperCase()}`),
      onSelectMainFile: (_names: string[], select: (index: number) => void) => select(0),
      onVisualizationStart: () => update(onProgress, 'assembling', 0.72, 'Building render objects'),
      onTextureLoaded: () => update(onProgress, 'assembling', 0.82, 'Decoding textures'),
      onModelFinished: (_result: { model?: unknown }, root: Object3D) => resolve({
        root,
        animations: [],
        parser: 'Online3DViewer engine',
        cleanup: () => loader.Destroy(),
      }),
      onLoadError: (error: { message?: string; mainFile?: string; code?: number }) => {
        loader.Destroy();
        reject(new Error(error.message || `Could not parse ${error.mainFile || bundle.mainFile.name} (engine error ${error.code ?? 'unknown'}).`));
      },
    });
  });
}

export async function loadModel(bundle: FileBundle, onProgress: ProgressCallback): Promise<LoadedAsset> {
  const format = findFormat(bundle.mainFile.extension);
  if (!format) throw new Error(`.${bundle.mainFile.extension || 'unknown'} is not a supported 3D format.`);
  const startedAt = performance.now();
  update(onProgress, 'reading', 0.05, 'Preparing local files');
  const parseStartedAt = performance.now();
  let parsed: ParsedScene;
  if (format.loader === 'extra') {
    try {
      parsed = await parseExtra(bundle, onProgress);
    } catch (error) {
      if (!['gltf', 'glb', 'fbx', 'dae'].includes(bundle.mainFile.extension)) throw error;
      if (error instanceof Error && /^(?:Blocked|Missing local companion|Ambiguous companion)/.test(error.message)) throw error;
      update(onProgress, 'parsing', 0.38, 'Retrying with the compatibility engine');
      parsed = await parseUpstream(bundle, onProgress);
    }
  } else {
    parsed = await parseUpstream(bundle, onProgress);
  }
  const parseDurationMs = performance.now() - parseStartedAt;
  update(onProgress, 'framing', 0.92, 'Inspecting and framing model');
  parsed.root.name ||= bundle.mainFile.name;
  const stats = inspectAsset(parsed.root, bundle, parsed.animations.length, performance.now() - startedAt, parseDurationMs);
  const issues = buildAssetIssues(stats);
  update(onProgress, 'ready', 1, `Ready in ${(stats.loadDurationMs / 1000).toFixed(2)} seconds`);
  return {
    root: parsed.root,
    animations: parsed.animations,
    bundle,
    format,
    stats,
    issues,
    parser: parsed.parser,
    cleanup: () => {
      disposeObject(parsed.root);
      parsed.cleanup?.();
    },
  };
}
