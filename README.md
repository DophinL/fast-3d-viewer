# Fast 3D Viewer

**A local-first 3D workbench that opens complete model packages, explains render cost, checks mesh health, repairs common defects, and exports a clean working copy.**

[Live demo](https://dophinl.github.io/fast-3d-viewer/) · [Format matrix](docs/FORMAT_SUPPORT.md) · [Architecture](docs/ARCHITECTURE.md) · [Performance](docs/PERFORMANCE.md) · [Testing](TESTING.md)

Fast 3D Viewer is designed for the moment after someone receives a model and before they trust it. It keeps files in the browser, renders on demand, exposes scene and GPU facts, runs topology work in a Web Worker, and makes repair an explicit copy-producing operation.

## What makes it different

- **Complete packages, not just a primary file.** Drop a folder, several related files, or a ZIP. Relative paths are retained for glTF buffers, OBJ materials, textures, CAD documents, and other companions.
- **A workbench, not a black box.** Inspect triangles, vertices, materials, textures, bones, animations, dimensions, estimated GPU memory, draw calls, parser time, and live renderer telemetry.
- **Mesh health that is actionable.** Scan welded topology for boundaries, non-manifold edges, reversed adjacency, degenerate faces, duplicates, isolated faces, surface area, and closed volume.
- **Non-destructive local repair.** Remove invalid or duplicate faces, fill simple planar holes, regenerate normals, and optionally center geometry. The source is never overwritten.
- **Interaction-first rendering.** Render only when the scene changes, adapt pixel ratio to frame time, accelerate picking with a BVH, and lazy-load importers and exporters.
- **A deliberate interface.** The warm, technical workbench stays useful on narrow screens and presents a clear WebGL recovery state instead of crashing to a blank page.
- **No model-upload path.** Parsing, inspection, diagnosis, repair, screenshots, and exports happen in the browser. A few CAD/BIM importers lazy-load version-pinned parser runtimes from jsDelivr; those requests do not contain model bytes.

## Try it

Open the [GitHub Pages demo](https://dophinl.github.io/fast-3d-viewer/) and use the built-in calibration model, or drop your own files. Current Chrome and Edge releases with WebGL 2 are recommended and CI-gated. Firefox and Safari compatibility is intended but not yet part of the automated browser matrix.

```bash
git clone https://github.com/DophinL/fast-3d-viewer.git
cd fast-3d-viewer
npm ci
npm run dev
```

The app is a static Vite build. No API keys, database, or server are required.

## Format coverage

The registry currently exposes **27 format families** and 36 filename extensions.

| Family | Formats |
| --- | --- |
| Web and interchange | glTF, GLB, OBJ + MTL, FBX, COLLADA, USDZ |
| Manufacturing and mesh | STL, 3MF, AMF, PLY, OFF, VTK |
| CAD | STEP, IGES, BREP, Rhino 3DM, FreeCAD FCStd |
| BIM | IFC, DotBIM |
| Scenes and legacy | 3DS, VRML, LDraw, MagicaVoxel VOX, Quake II MD2, KMZ |
| Point clouds | XYZ / XYZRGB, PCD, PLY |
| Toolpaths | G-code |

Format support is not one boolean. Animation, materials, package companions, semantic data, diagnostics, and repair vary by importer. See the [format support matrix](docs/FORMAT_SUPPORT.md) before depending on a production workflow.

## Viewer and workbench capabilities

### View

- Orbit, pan, zoom, frame selection, isometric and six orthographic views
- Material, matcap, normal, wireframe, and x-ray display modes
- Grid, axes, bounds, shadows, exposure, light, environment, and auto-rotation controls
- PNG snapshots and fullscreen mode
- Scene tree visibility controls and click selection
- Animation discovery and asset statistics
- Play and pause the first retained animation clip from the viewport toolbar

### Diagnose

- Boundary and non-manifold edges
- Inconsistent adjacent-face orientation
- Degenerate, duplicate, and isolated triangles
- Welded vertex count and topology status
- Surface area and signed volume for closed meshes
- Missing normals and UVs, STL unit ambiguity, high draw-call and memory warnings
- Background-worker execution with an interactive scan limit

### Repair

- Remove zero-area and collapsed triangles
- Remove duplicate faces
- Fill simple planar boundary loops
- Recalculate normals
- Center the repaired copy
- Produce a valid binary STL source for the new asset

Repair is intentionally conservative. It does not rebuild arbitrary self-intersections, infer missing curved CAD surfaces, preserve parametric feature history, or guarantee printability. Use a dedicated solid-modeling or manufacturing tool for those jobs.

### Export

- GLB and glTF
- OBJ
- Binary or ASCII STL
- Binary or ASCII PLY
- USDZ

Exports represent the parsed render scene. They are not semantic CAD conversion: STEP/IFC/FCStd/3DM object properties may not survive a mesh-scene export.

## Compared with Online3DViewer

Fast 3D Viewer includes the MIT-licensed [Online3DViewer](https://github.com/kovacsv/Online3DViewer) engine as a vendored import backend for its mature CAD/BIM/legacy coverage, then adds a separate workbench and fast-path loader layer around it.

| Capability | Online3DViewer 0.19 | Fast 3D Viewer 0.1 |
| --- | --- | --- |
| Registered format families | 18 documented import families | 27 registered families |
| Folder / multi-file / ZIP intake | Multiple inputs | Folder, multi-file, ZIP, normalized package index |
| Topology diagnosis | Model validation hooks | Dedicated worker scan with quantitative findings |
| Repair | No integrated repair workflow | Conservative local mesh repair creating a copy |
| Render scheduling | Continuous viewer lifecycle | Render-on-demand plus adaptive DPR |
| Picking acceleration | Standard scene raycast | `three-mesh-bvh` accelerated raycast |
| Render/GPU inspection | Basic model information | Load/parse/GPU/draw-call/live renderer telemetry |
| WebGL failure state | Implementation-dependent | Tested non-crashing compatibility state |
| Export | 3DM, BIM, glTF, OBJ, OFF, STL, PLY | GLB, glTF, OBJ, STL, PLY, USDZ from render scene |

This table describes implemented product paths, not a claim that every parser is universally faster or more accurate. CAD import still relies on the upstream OpenCascade pipeline, and benchmark results depend on the model, device, browser, and cache. Reproducible performance rules are in [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

## Architecture

```text
files / folder / URL / ZIP
           │
           ▼
  normalized FileBundle
           │
     ┌─────┴──────────┐
     ▼                ▼
fast-path loaders   vendored engine
Three.js extras     CAD/BIM/legacy
     └─────┬──────────┘
           ▼
      normalized scene
     ┌─────┼───────────┐
     ▼     ▼           ▼
 renderer  inspector   worker diagnostics
     │                     │
     └─────────┬───────────┘
               ▼
        repair copy / export
```

Read the [architecture guide](docs/ARCHITECTURE.md) for ownership boundaries and extension points.

## Quality gates

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Unit tests cover the format registry, package normalization, archive safety, and scene inspection. Playwright covers real WebGL rendering, repair feedback, mobile controls, viewport containment, topology correctness, and the no-WebGL recovery state. CI runs on every push and pull request.

## Project status

This is an early public release. The workbench is useful today, but the compatibility matrix needs more real-world fixtures, especially for vendor-specific CAD and BIM files. Known boundaries:

- ZIP entries are protected against absolute and parent-traversal paths, but nested packages with duplicate basenames can still be ambiguous in the vendored backend.
- Interactive diagnostics intentionally stop above the configured triangle budget; repair is not streamed yet.
- Point-cloud level of detail and progressive network loading are not implemented.
- Export preserves the parsed render scene, not every source-format semantic.
- WebGPU is not enabled; the current production renderer targets WebGL 2.

Open an issue with a minimal redistributable fixture when a model fails. Format support improves fastest when a regression can be reproduced legally in CI.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Importers should include a small licensed fixture, a parser test, a browser-level success assertion, and a clear statement of what is and is not preserved.

## Security and privacy

Files are processed locally by the published app. URL imports are fetched directly by the browser and therefore depend on the remote server's CORS policy. Review [SECURITY.md](SECURITY.md) for archive limits, untrusted-model guidance, and private reporting.

STEP/IGES/BREP, Rhino 3DM, IFC, and upstream Draco compatibility paths may fetch their version-pinned parser runtime from jsDelivr on first use. The model remains in the browser, but a strict offline deployment should self-host those inherited runtimes before claiming zero network dependencies.

## License and attribution

Fast 3D Viewer is MIT licensed. The vendored Online3DViewer source remains under its original MIT license and is documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
