# Architecture

Fast 3D Viewer separates file intake, import, normalized scene behavior, rendering, analysis, repair, and export. The separation is deliberate: parser coverage can grow without turning the viewport into a format-specific component, and expensive topology work stays off the UI thread.

## Runtime flow

1. `DropZone` accepts local files, directories, ZIP archives, or an HTTPS URL.
2. `file-bundle.ts` normalizes names, rejects unsafe archive paths, selects a likely primary file, and retains companion entries.
3. `load-model.ts` chooses either a lazy Three.js fast path or the vendored Online3DViewer engine.
4. Every importer returns a normalized Three.js scene plus parser ownership and cleanup behavior.
5. `inspect.ts` walks the scene once to derive asset statistics and lightweight findings.
6. `ViewerEngine` frames and renders the scene on demand.
7. Geometry payloads sent to `mesh-diagnostics.worker.ts` are copied into worker-owned typed arrays.
8. Repair produces a new triangle-mesh object and valid local STL representation; it never mutates the source asset.
9. Exporters serialize the visible normalized scene.

## File bundle boundary

`FileBundle` is the product's source-of-truth input object:

```ts
interface FileBundle {
  entries: FileEntry[];
  mainFile: FileEntry;
  totalBytes: number;
  archiveName?: string;
  warnings: string[];
}
```

Each entry retains a normalized relative path, extension, size, and origin. This allows package-aware loaders to resolve `scene.gltf -> buffers/scene.bin` or `model.obj -> materials/model.mtl` without pretending every format is single-file.

Remote URL intake also retains the source directory as `remoteBaseUrl`, so relative glTF, FBX, and COLLADA companions resolve against the model's origin instead of the viewer's own URL. Every remote response still needs to allow browser CORS.

The vendored backend currently resolves several companion types by basename. Packages containing different nested files with the same basename are therefore an acknowledged ambiguity. A future backend adapter should expose a path-preserving virtual filesystem rather than flattening those names.

The production build copies Three.js Draco decoder assets into `dist/draco`. Compressed glTF decoding therefore stays on the same static origin and does not depend on a third-party decoder CDN.

## Loader ownership

The format registry declares facts; it does not import parser code. `load-model.ts` routes at runtime:

- **Fast path:** Three.js example loaders for selected web, scene, point-cloud, and toolpath formats. These branches are lazy chunks.
- **Coverage path:** Online3DViewer for mature CAD, BIM, manufacturing, and legacy importers, including the OpenCascade WebAssembly path.

Importer output is normalized to `Object3D`. Format semantics that do not exist in Three.js must be represented in `userData` or documented as lost. Merely displaying tessellated geometry does not prove that parametric history, IFC properties, units, constraints, or manufacturing metadata survived.

## Renderer ownership

`ViewerEngine` owns:

- WebGL renderer and scene lifecycle;
- camera, orbit controls, lights, helpers, and environment;
- render invalidation and frame scheduling;
- adaptive device pixel ratio;
- BVH raycast setup and selection;
- animation mixer updates;
- display modes and temporary materials;
- telemetry and cleanup.

React owns controls and state, not individual frame rendering. A scene change calls `invalidate`; a small animation loop exists only while controls, auto-rotation, or model animation require it.

## Inspection and diagnostics

Lightweight inspection walks the normalized scene on the main thread and computes counts, bounding dimensions, memory estimates, and capability flags.

Topology diagnosis is separate because edge maps can be expensive. `collectGeometryPayloads` applies world transforms and sends triangle arrays to the worker. The worker welds coordinate keys at a fixed tolerance, builds undirected edge incidence, and reports quantitative facts. A scan limit protects interactivity; exceeding it is reported, not silently truncated into a false pass.

## Repair contract

Repair accepts triangle payloads and explicit options. It may:

- discard degenerate or duplicate faces;
- discover simple boundary loops;
- triangulate planar loops;
- recalculate normals through the normalized scene;
- translate the final copy to the origin.

It must return counts, duration, warnings, and new position data. The UI replaces the active scene with a clearly named repaired copy and keeps completion feedback visible. Source files remain untouched.

## Export boundary

Export operates on the normalized render scene, optionally filtering invisible objects and including discovered animations. This makes export predictable across input formats but necessarily loses semantics that the scene does not contain. Do not describe this as CAD conversion.

## Extension points

### New format

1. Register capability facts.
2. Add a lazy loader route.
3. Add a package resolver when external references exist.
4. Add licensed fixtures and tests.
5. Document semantic and variant boundaries.

### New diagnosis

Prefer adding a worker result field and issue mapping over placing geometry loops in a React component. Define complexity and the size limit.

### New repair

Keep it opt-in, non-destructive, measurable, cancellable when possible, and paired with a regression model.

### Embedding

The current release is an application. A future package can extract `FileBundle`, loader routing, diagnostics, and `ViewerEngine` behind a stable headless API. Until then, internal modules may change between minor releases.
