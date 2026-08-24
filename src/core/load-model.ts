import {
  AnimationClip,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LoadingManager,
  Mesh,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
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

interface OcctMeshData {
  name?: string;
  color?: [number, number, number];
  attributes?: { position?: { array: number[] }; normal?: { array: number[] } };
  index?: { array: number[] };
}

interface OcctNodeData {
  name?: string;
  meshes: number[];
  children: OcctNodeData[];
}

interface OcctResult {
  success: boolean;
  root: OcctNodeData;
  meshes: OcctMeshData[];
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
  return { manager, cleanup: () => objectUrls.forEach((url) => URL.revokeObjectURL(url)) };
}

function meshMaterial(color?: [number, number, number]): MeshStandardMaterial {
  const base = color ? new Color(color[0], color[1], color[2]) : new Color(0xb9b4a8);
  return new MeshStandardMaterial({ color: base, roughness: 0.68, metalness: 0.04 });
}

function parseOff(source: string): Object3D {
  const tokens = source.split(/\r?\n/).map((line) => line.replace(/#.*/, '').trim()).filter(Boolean).join(' ').split(/\s+/);
  if (tokens.shift()?.toUpperCase() !== 'OFF') throw new Error('This OFF file is missing the OFF header.');
  const vertexCount = Number(tokens.shift());
  const faceCount = Number(tokens.shift());
  tokens.shift();
  if (!Number.isSafeInteger(vertexCount) || !Number.isSafeInteger(faceCount) || vertexCount < 0 || faceCount < 0) {
    throw new Error('This OFF file has an invalid geometry header.');
  }
  const positions = new Float32Array(vertexCount * 3);
  for (let index = 0; index < positions.length; index += 1) {
    const value = Number(tokens.shift());
    if (!Number.isFinite(value)) throw new Error('This OFF file ended while reading vertices.');
    positions[index] = value;
  }
  const triangles: number[] = [];
  for (let face = 0; face < faceCount; face += 1) {
    const count = Number(tokens.shift());
    if (!Number.isSafeInteger(count) || count < 3) throw new Error('This OFF file contains an invalid polygon.');
    const polygon = Array.from({ length: count }, () => Number(tokens.shift()));
    if (polygon.some((index) => !Number.isSafeInteger(index) || index < 0 || index >= vertexCount)) {
      throw new Error('This OFF file references a vertex outside the vertex table.');
    }
    for (let index = 1; index < polygon.length - 1; index += 1) triangles.push(polygon[0]!, polygon[index]!, polygon[index + 1]!);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(triangles);
  geometry.computeVertexNormals();
  return new Mesh(geometry, meshMaterial());
}

function buildOcctScene(result: OcctResult): Object3D {
  if (!result.success) throw new Error('OpenCascade could not tessellate this CAD file.');
  const templates = result.meshes.map((source, index) => {
    const positions = source.attributes?.position?.array;
    const indices = source.index?.array;
    if (!positions || !indices) return null;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(Float32Array.from(positions), 3));
    if (source.attributes?.normal?.array) geometry.setAttribute('normal', new BufferAttribute(Float32Array.from(source.attributes.normal.array), 3));
    else geometry.computeVertexNormals();
    geometry.setIndex(new BufferAttribute(Uint32Array.from(indices), 1));
    const mesh = new Mesh(geometry, meshMaterial(source.color));
    mesh.name = source.name || `CAD mesh ${index + 1}`;
    return mesh;
  });
  const createNode = (node: OcctNodeData): Group => {
    const group = new Group();
    group.name = node.name || 'CAD assembly';
    for (const meshIndex of node.meshes) {
      const template = templates[meshIndex];
      if (template) group.add(template.clone());
    }
    for (const child of node.children) group.add(createNode(child));
    return group;
  };
  return createNode(result.root);
}

async function parseCad(bundle: FileBundle, onProgress: ProgressCallback): Promise<ParsedScene> {
  update(onProgress, 'parsing', 0.3, 'Starting the local OpenCascade worker');
  const extension = bundle.mainFile.extension;
  const format = ['step', 'stp'].includes(extension) ? 'step' : ['iges', 'igs'].includes(extension) ? 'iges' : 'brep';
  const buffer = await readBuffer(bundle.mainFile.file);
  const worker = new Worker(new URL('runtime/occt/occt-import-js-worker.js', document.baseURI).toString());
  const result = await new Promise<OcctResult>((resolve, reject) => {
    worker.addEventListener('message', (event: MessageEvent<OcctResult>) => resolve(event.data), { once: true });
    worker.addEventListener('error', () => reject(new Error('The local OpenCascade worker could not start.')), { once: true });
    worker.postMessage({
      format,
      buffer: new Uint8Array(buffer),
      params: { linearUnit: 'millimeter', linearDeflectionType: 'bounding_box_ratio', linearDeflection: 0.001, angularDeflection: 0.5 },
    }, [buffer]);
  }).finally(() => worker.terminate());
  update(onProgress, 'assembling', 0.78, 'Building the CAD scene');
  return { root: buildOcctScene(result), animations: [], parser: 'Native OCCT worker' };
}

async function parseNative(bundle: FileBundle, onProgress: ProgressCallback): Promise<ParsedScene> {
  const file = bundle.mainFile.file;
  const extension = bundle.mainFile.extension;
  update(onProgress, 'parsing', 0.35, `Parsing ${extension.toUpperCase()}`);

  if (extension === 'gltf' || extension === 'glb') {
    const resources = createPackageManager(bundle);
    try {
      const [{ GLTFLoader }, { DRACOLoader }, { MeshoptDecoder }] = await Promise.all([
        import('three/examples/jsm/loaders/GLTFLoader.js'), import('three/examples/jsm/loaders/DRACOLoader.js'), import('three/examples/jsm/libs/meshopt_decoder.module.js'),
      ]);
      const draco = new DRACOLoader(resources.manager);
      draco.setDecoderPath(new URL('./draco/', document.baseURI).toString());
      const loader = new GLTFLoader(resources.manager).setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
      const input = extension === 'glb' ? await readBuffer(file) : await readText(file);
      const parsed = await new Promise<Awaited<ReturnType<typeof loader.parseAsync>>>((resolve, reject) => loader.parse(input, '', resolve, reject));
      return { root: parsed.scene, animations: parsed.animations, parser: 'Fast native loader', cleanup: () => { resources.cleanup(); draco.dispose(); } };
    } catch (error) { resources.cleanup(); throw error; }
  }

  if (extension === 'obj') {
    const resources = createPackageManager(bundle);
    try {
      const [{ OBJLoader }, { MTLLoader }] = await Promise.all([import('three/examples/jsm/loaders/OBJLoader.js'), import('three/examples/jsm/loaders/MTLLoader.js')]);
      const loader = new OBJLoader(resources.manager);
      const materialFile = bundle.entries.find((entry) => entry.extension === 'mtl');
      if (materialFile) {
        const materials = new MTLLoader(resources.manager).parse(await readText(materialFile.file), '');
        materials.preload();
        loader.setMaterials(materials);
      }
      return { root: loader.parse(await readText(file)), animations: [], parser: 'Fast native loader', cleanup: resources.cleanup };
    } catch (error) { resources.cleanup(); throw error; }
  }

  if (extension === 'fbx') {
    const resources = createPackageManager(bundle);
    try {
      const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
      const root = new FBXLoader(resources.manager).parse(await readBuffer(file), '');
      return { root, animations: root.animations, parser: 'Fast native loader', cleanup: resources.cleanup };
    } catch (error) { resources.cleanup(); throw error; }
  }

  if (extension === 'dae') {
    const resources = createPackageManager(bundle);
    try {
      const { ColladaLoader } = await import('three/examples/jsm/loaders/ColladaLoader.js');
      const parsed = new ColladaLoader(resources.manager).parse(await readText(file), '');
      return { root: parsed.scene, animations: parsed.scene.animations, parser: 'Fast native loader', cleanup: resources.cleanup };
    } catch (error) { resources.cleanup(); throw error; }
  }

  if (extension === 'stl') {
    const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
    return { root: new Mesh(new STLLoader().parse(await readBuffer(file)), meshMaterial()), animations: [], parser: 'Fast native loader' };
  }
  if (extension === 'ply') {
    const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js');
    const geometry = new PLYLoader().parse(await readBuffer(file));
    const root = geometry.getIndex() ? new Mesh(geometry, meshMaterial()) : new Points(geometry, new PointsMaterial({ size: 0.015, vertexColors: Boolean(geometry.getAttribute('color')), color: 0xadb3b8 }));
    return { root, animations: [], parser: 'Fast native loader' };
  }
  if (extension === '3mf') {
    const { ThreeMFLoader } = await import('three/examples/jsm/loaders/3MFLoader.js');
    return { root: new ThreeMFLoader().parse(await readBuffer(file)), animations: [], parser: 'Fast native loader' };
  }
  if (extension === '3ds') {
    const resources = createPackageManager(bundle);
    const { TDSLoader } = await import('three/examples/jsm/loaders/TDSLoader.js');
    return { root: new TDSLoader(resources.manager).parse(await readBuffer(file), ''), animations: [], parser: 'Fast native loader', cleanup: resources.cleanup };
  }
  if (['wrl', 'vrml'].includes(extension)) {
    const { VRMLLoader } = await import('three/examples/jsm/loaders/VRMLLoader.js');
    return { root: new VRMLLoader().parse(await readText(file), ''), animations: [], parser: 'Fast native loader' };
  }
  if (extension === 'amf') {
    const { AMFLoader } = await import('three/examples/jsm/loaders/AMFLoader.js');
    return { root: new AMFLoader().parse(await readBuffer(file)), animations: [], parser: 'Fast native loader' };
  }
  if (extension === 'off') return { root: parseOff(await readText(file)), animations: [], parser: 'Fast native loader' };
  if (extension === '3dm') {
    const resources = createPackageManager(bundle);
    const { Rhino3dmLoader } = await import('three/examples/jsm/loaders/3DMLoader.js');
    const loader = new Rhino3dmLoader(resources.manager).setLibraryPath(new URL('runtime/rhino3dm/', document.baseURI).toString());
    try {
      const data = await readBuffer(file);
      const root = await new Promise<Object3D>((resolve, reject) => loader.parse(data, resolve, reject));
      return { root, animations: [], parser: 'Fast native loader', cleanup: () => { resources.cleanup(); loader.dispose(); } };
    } catch (error) { resources.cleanup(); loader.dispose(); throw error; }
  }
  if (extension === 'usdz') {
    const { USDZLoader } = await import('three/examples/jsm/loaders/USDZLoader.js');
    return { root: new USDZLoader().parse(await readBuffer(file)), animations: [], parser: 'Fast native loader' };
  }
  if (extension === 'vox') {
    const { VOXLoader, VOXMesh } = await import('three/examples/jsm/loaders/VOXLoader.js');
    const chunks = new VOXLoader().parse(await readBuffer(file)) as ConstructorParameters<typeof VOXMesh>[0][];
    const root = new Group();
    chunks.forEach((chunk) => root.add(new VOXMesh(chunk)));
    return { root, animations: [], parser: 'Fast native loader' };
  }
  if (['ldr', 'mpd', 'dat'].includes(extension)) {
    const { LDrawLoader } = await import('three/examples/jsm/loaders/LDrawLoader.js');
    const resources = createPackageManager(bundle);
    try {
      const data = await readText(file);
      const parsed = await new Promise<Group>((resolve, reject) => new LDrawLoader(resources.manager).parse(data, '', resolve, reject));
      return { root: parsed, animations: [], parser: 'Fast native loader', cleanup: resources.cleanup };
    } catch (error) { resources.cleanup(); throw error; }
  }
  if (extension === 'xyz') {
    const { XYZLoader } = await import('three/examples/jsm/loaders/XYZLoader.js');
    const data = await readText(file);
    // @types/three still describes the pre-r176 callback signature; the shipped
    // loader is synchronous and returns BufferGeometry.
    const geometry = (new XYZLoader() as unknown as { parse(source: string): BufferGeometry }).parse(data);
    return { root: new Points(geometry, new PointsMaterial({ size: 0.015, vertexColors: Boolean(geometry.getAttribute('color')), color: 0xadb3b8 })), animations: [], parser: 'Fast native loader' };
  }
  if (extension === 'pcd') {
    const { PCDLoader } = await import('three/examples/jsm/loaders/PCDLoader.js');
    return { root: new PCDLoader().parse(await readBuffer(file)), animations: [], parser: 'Fast native loader' };
  }
  if (['vtk', 'vtp'].includes(extension)) {
    const { VTKLoader } = await import('three/examples/jsm/loaders/VTKLoader.js');
    const geometry = new VTKLoader().parse(await readBuffer(file), '');
    geometry.computeVertexNormals();
    return { root: new Mesh(geometry, meshMaterial()), animations: [], parser: 'Fast native loader' };
  }
  if (extension === 'kmz') {
    const { KMZLoader } = await import('three/examples/jsm/loaders/KMZLoader.js');
    const input = await readBuffer(file);
    const { unzipSync } = await import('fflate');
    const contents = unzipSync(new Uint8Array(input), { filter: (entry) => {
      if (entry.originalSize > 256 * 1024 * 1024) throw new Error(`KMZ entry ${entry.name} exceeds the 256 MB limit.`);
      return /\.(?:dae|kml)$/i.test(entry.name);
    } });
    for (const [name, bytes] of Object.entries(contents)) {
      if (/(?:https?:)?\/\//i.test(new TextDecoder().decode(bytes))) throw new Error(`Blocked an external resource reference in local KMZ entry ${name}.`);
    }
    return { root: new KMZLoader().parse(input).scene, animations: [], parser: 'Fast native loader' };
  }
  if (['gcode', 'gco', 'nc'].includes(extension)) {
    const { GCodeLoader } = await import('three/examples/jsm/loaders/GCodeLoader.js');
    return { root: new GCodeLoader().parse(await readText(file)), animations: [], parser: 'Fast native loader' };
  }
  if (extension === 'md2') {
    const { MD2Loader } = await import('three/examples/jsm/loaders/MD2Loader.js');
    const geometry = new MD2Loader().parse(await readBuffer(file)) as BufferGeometry & { animations?: AnimationClip[] };
    return { root: new Mesh(geometry, meshMaterial()), animations: geometry.animations ?? [], parser: 'Fast native loader' };
  }
  throw new Error(`The ${extension.toUpperCase()} loader is not available in this browser build.`);
}

export async function loadModel(bundle: FileBundle, onProgress: ProgressCallback): Promise<LoadedAsset> {
  const format = findFormat(bundle.mainFile.extension);
  if (!format) throw new Error(`.${bundle.mainFile.extension || 'unknown'} is not a supported 3D format.`);
  const startedAt = performance.now();
  update(onProgress, 'reading', 0.05, 'Preparing local files');
  const parseStartedAt = performance.now();
  const parsed = format.loader === 'cad' ? await parseCad(bundle, onProgress) : await parseNative(bundle, onProgress);
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
    cleanup: () => { disposeObject(parsed.root); parsed.cleanup?.(); },
  };
}
