export const PRODUCT_NAME = 'Modern 3D Workbench';
export const PRODUCT_SHORT_NAME = 'Modern 3D';
export const REPOSITORY_NAME = 'fast-3d-viewer';
export const REPOSITORY_URL = 'https://github.com/DophinL/fast-3d-viewer';
export const PUBLIC_ORIGIN = 'https://dophinl.github.io/fast-3d-viewer';

export type ProductRouteId = 'home' | 'stl' | 'glb' | 'obj' | 'step' | 'embed' | 'benchmark';

export interface ProductFaq {
  question: string;
  answer: string;
}

export interface ProductRoute {
  id: ProductRouteId;
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  headline: string;
  emphasizedHeadline: string;
  introduction: string;
  primaryAction: string;
  formats: string[];
  workflow: Array<{ title: string; detail: string }>;
  faqs: ProductFaq[];
  robots?: 'index,follow' | 'noindex,nofollow';
}

const sharedWorkflow = [
  { title: 'Open locally', detail: 'Choose a file or package. The browser reads it without sending the source model to a server.' },
  { title: 'Inspect the real scene', detail: 'Review hierarchy, render cost, dimensions, materials, topology, and file dependencies.' },
  { title: 'Correct and export', detail: 'Fix orientation or supported mesh defects, then export a working copy while preserving the original.' },
];

export const PRODUCT_ROUTES: readonly ProductRoute[] = Object.freeze([
  {
    id: 'home',
    path: '/',
    title: 'Modern 3D Workbench · Inspect, measure, repair',
    description: 'A private, modern 3D model viewer for opening, inspecting, measuring, repairing, and exporting 3D files in the browser.',
    eyebrow: 'LOCAL-FIRST MODEL QA',
    headline: 'See the model.',
    emphasizedHeadline: 'Understand the file.',
    introduction: 'Open complete 3D packages, verify what will actually render, measure geometry, correct orientation, diagnose mesh defects, and export a clean working copy. Your source stays on this device.',
    primaryAction: 'Try the calibration model',
    formats: ['GLB', 'glTF', 'OBJ + MTL', 'FBX', 'STL', 'STEP', 'IGES', '3MF', 'USDZ', 'PLY', 'VOX', '3DM'],
    workflow: sharedWorkflow,
    faqs: [
      { question: 'Are models uploaded to a server?', answer: 'No. Local files are parsed, rendered, diagnosed, and exported in the browser. Remote URLs are fetched only when you explicitly open one.' },
      { question: 'Is this the Online 3D Viewer package?', answer: 'No. The workbench has its own application, loading, diagnostics, repair, export, and rendering architecture. It uses format-specific open-source dependencies where documented.' },
      { question: 'Does every listed format preserve all source semantics?', answer: 'No. Mesh and scene viewing is broader than semantic CAD or BIM conversion. The format matrix states package, material, animation, and repair boundaries explicitly.' },
    ],
  },
  {
    id: 'stl',
    path: '/stl-viewer/',
    title: 'STL Viewer Online · Measure, inspect and repair locally',
    description: 'Open binary or ASCII STL files online, inspect dimensions and topology, correct orientation, measure geometry, repair common mesh defects, and export locally.',
    eyebrow: 'STL VIEWER + PRINT CHECK',
    headline: 'Open an STL.',
    emphasizedHeadline: 'Know if it is printable.',
    introduction: 'STL stores triangles, not a reliable up axis or unit. This viewer makes those assumptions visible, lets you correct orientation, measures the mesh, checks watertightness, and keeps the source file local.',
    primaryAction: 'Try a printable calibration model',
    formats: ['STL', '3MF', 'OBJ', 'PLY', 'AMF', 'G-code'],
    workflow: [
      { title: 'Open binary or ASCII STL', detail: 'The parser reads both common STL encodings locally and reports the actual triangle count and bounds.' },
      { title: 'Set orientation and units', detail: 'Choose the intended up axis, rotate in 90° steps, place the model on the ground, and record an explicit unit assumption.' },
      { title: 'Check and repair the mesh', detail: 'Scan for open boundaries, non-manifold edges, duplicate or degenerate faces, then create a separate repaired copy.' },
    ],
    faqs: [
      { question: 'Why does my STL open sideways?', answer: 'STL does not define a universal front or up axis. The viewer does not silently guess; use the orientation controls to rotate and place it on the ground.' },
      { question: 'Can this viewer repair every broken STL?', answer: 'No. It safely handles bounded, testable mesh operations such as duplicate and degenerate face removal and simple hole filling. Complex remeshing remains out of scope.' },
      { question: 'What unit does STL use?', answer: 'STL coordinates are unitless. You can state the intended unit for measurements and exports instead of relying on a hidden assumption.' },
    ],
  },
  {
    id: 'glb',
    path: '/glb-viewer/',
    title: 'GLB Viewer Online · Inspect materials, animation and render cost',
    description: 'Open GLB and glTF models locally, inspect materials, textures, animation, draw calls, dimensions, hierarchy, and export a clean web-ready copy.',
    eyebrow: 'GLB + GLTF SCENE INSPECTOR',
    headline: 'Open the GLB.',
    emphasizedHeadline: 'See what the browser pays for.',
    introduction: 'Preview the final scene, not only its silhouette. Inspect animation clips, textures, PBR materials, hierarchy, draw calls, GPU estimates, and missing package resources before the asset reaches production.',
    primaryAction: 'Try an animated calibration scene',
    formats: ['GLB', 'glTF', 'FBX', 'USDZ', 'OBJ + MTL', 'DAE'],
    workflow: [
      { title: 'Open a GLB or full glTF package', detail: 'Drop the JSON, buffers, and textures together or use a self-contained GLB.' },
      { title: 'Audit runtime cost', detail: 'Review triangles, draw calls, textures, material count, animation, and an estimated GPU footprint.' },
      { title: 'Validate and export', detail: 'Switch render modes, test animation, isolate nodes, take a snapshot, or export a clean GLB/glTF working copy.' },
    ],
    faqs: [
      { question: 'Can I open a glTF with separate textures?', answer: 'Yes. Select the .gltf, buffers, and image files together or place them in a supported archive. Paths are resolved inside that package.' },
      { question: 'Does the viewer support Draco and Meshopt?', answer: 'Yes. Decoder assets are served from the same site, and the Meshopt decoder is bundled with the application.' },
      { question: 'Can it validate every glTF specification rule?', answer: 'No. The workbench provides practical scene and performance diagnostics; a full standards conformance validator is a separate tool.' },
    ],
  },
  {
    id: 'obj',
    path: '/obj-viewer/',
    title: 'OBJ Viewer Online · Open OBJ, MTL and textures together',
    description: 'Open OBJ models with MTL files and textures locally, inspect missing dependencies, measure geometry, diagnose the mesh, and export a working copy.',
    eyebrow: 'OBJ PACKAGE VIEWER',
    headline: 'Drop the whole OBJ package.',
    emphasizedHeadline: 'Keep the materials attached.',
    introduction: 'An OBJ is often more than one file. Open the OBJ, MTL, and textures together so material paths can be resolved locally, then inspect geometry, measurements, topology, and export options.',
    primaryAction: 'Try the package workflow',
    formats: ['OBJ + MTL', 'GLB', 'glTF', 'STL', 'PLY', 'FBX'],
    workflow: [
      { title: 'Select every package file', detail: 'Choose OBJ, MTL, and texture images together; relative references are resolved without external uploads.' },
      { title: 'Find missing resources', detail: 'Package warnings distinguish missing local dependencies from files blocked by the local-first policy.' },
      { title: 'Measure, diagnose, and convert', detail: 'Inspect geometry and topology, then export a suitable mesh or web interchange format.' },
    ],
    faqs: [
      { question: 'Why is my OBJ gray?', answer: 'The MTL file or referenced texture images may be missing. Open the complete package together and check the package warnings.' },
      { question: 'Can I drag a ZIP containing the model?', answer: 'Yes. The archive is expanded locally and the viewer selects a supported main model while preserving relative paths.' },
      { question: 'Are external texture URLs downloaded automatically?', answer: 'No for local packages. External resource requests are blocked so opening a local model cannot silently contact third-party hosts.' },
    ],
  },
  {
    id: 'step',
    path: '/step-file-viewer/',
    title: 'STEP File Viewer Online · Local CAD tessellation and inspection',
    description: 'Open STEP and STP CAD files locally, tessellate them in a dedicated browser worker, inspect assemblies and dimensions, and export a mesh working copy.',
    eyebrow: 'LOCAL STEP FILE VIEWER',
    headline: 'Inspect a STEP file.',
    emphasizedHeadline: 'Without uploading the CAD source.',
    introduction: 'STEP solids and assemblies are tessellated in a dedicated local OpenCascade worker. Inspect the resulting scene and dimensions while keeping a clear boundary between CAD semantics and mesh export.',
    primaryAction: 'Open a STEP or STP file',
    formats: ['STEP', 'STP', 'IGES', 'BREP', '3DM', 'GLB'],
    workflow: [
      { title: 'Load CAD locally', detail: 'The browser transfers the source into a dedicated worker and runs the bundled OpenCascade runtime.' },
      { title: 'Inspect assemblies and bounds', detail: 'Review generated scene nodes, dimensions, mesh counts, and visualization quality.' },
      { title: 'Export with semantic limits visible', detail: 'Create a mesh working copy while retaining the original CAD file and acknowledging that B-rep semantics do not survive mesh export.' },
    ],
    faqs: [
      { question: 'Does this repair STEP or convert semantic CAD?', answer: 'No. It tessellates CAD for local visualization. Mesh export does not preserve constraints, feature history, or all object properties.' },
      { question: 'Is the CAD file sent to a conversion API?', answer: 'No. The OpenCascade worker and WebAssembly runtime are served with the application and execute in your browser.' },
      { question: 'Why can large STEP files take time?', answer: 'CAD tessellation is CPU and memory intensive. The worker keeps the interface responsive, but it does not remove the cost of parsing and meshing a large assembly.' },
    ],
  },
  {
    id: 'embed',
    path: '/embed/',
    title: 'Modern 3D Workbench Embed',
    description: 'Configurable local-first 3D model embed.',
    eyebrow: 'EMBED',
    headline: 'Embedded model viewer.',
    emphasizedHeadline: 'Configured by URL.',
    introduction: 'Use a remote model URL and explicit viewer settings to embed the workbench in another site.',
    primaryAction: 'Open a model URL',
    formats: [],
    workflow: [],
    faqs: [],
    robots: 'noindex,nofollow',
  },
  {
    id: 'benchmark',
    path: '/benchmark/',
    title: 'Modern 3D Workbench Benchmark',
    description: 'Reproducible local viewer benchmark harness and result schema.',
    eyebrow: 'BENCHMARK',
    headline: 'Measure the viewer.',
    emphasizedHeadline: 'Do not trust the adjective.',
    introduction: 'Run deterministic fixtures and export machine-readable timings for import, first frame, interaction, and memory where the browser exposes it.',
    primaryAction: 'Run benchmark',
    formats: [],
    workflow: [],
    faqs: [],
    robots: 'noindex,nofollow',
  },
]);

export function getProductRoute(pathname = window.location.pathname): ProductRoute {
  const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return PRODUCT_ROUTES.find((route) => route.id !== 'home' && normalized.endsWith(route.path)) ?? PRODUCT_ROUTES[0]!;
}

function upsertMeta(name: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.name = name;
    document.head.append(element);
  }
  element.content = content;
}

export function applyProductMetadata(route: ProductRoute): void {
  document.title = route.title;
  upsertMeta('description', route.description);
  upsertMeta('robots', route.robots ?? 'index,follow');
  upsertMeta('application-name', PRODUCT_NAME);

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.append(canonical);
  }
  canonical.href = `${PUBLIC_ORIGIN}${route.path === '/' ? '/' : route.path}`;

  const oldSchema = document.head.querySelector('#product-route-schema');
  oldSchema?.remove();
  const schema = document.createElement('script');
  schema.id = 'product-route-schema';
  schema.type = 'application/ld+json';
  schema.text = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: PRODUCT_NAME,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any modern browser',
    url: canonical.href,
    description: route.description,
    isAccessibleForFree: true,
    softwareHelp: REPOSITORY_URL,
  });
  document.head.append(schema);
}
