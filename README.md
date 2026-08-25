# Modern 3D Workbench

**A local-first 3D workbench that opens complete model packages, explains render cost, checks mesh health, repairs common defects, and exports a clean working copy.**

[Live demo](https://dophinl.github.io/fast-3d-viewer/) · [STL viewer](https://dophinl.github.io/fast-3d-viewer/stl-viewer/) · [GLB viewer](https://dophinl.github.io/fast-3d-viewer/glb-viewer/) · [Benchmark](https://dophinl.github.io/fast-3d-viewer/benchmark/) · [Format matrix](docs/FORMAT_SUPPORT.md) · [Architecture](docs/ARCHITECTURE.md)

Modern 3D Workbench is designed for the moment after someone receives a model and before they trust it. The repository and package slug remain `fast-3d-viewer` so existing links do not break. The product name no longer makes an unqualified speed claim.

## What makes it different

- **Complete packages, not just a primary file.** Drop a folder, several related files, or a ZIP. Relative paths are retained for glTF buffers, OBJ materials, textures, CAD documents, and other companions.
- **A workbench, not a black box.** Inspect triangles, vertices, materials, textures, bones, animations, dimensions, estimated GPU memory, draw calls, parser time, and live renderer telemetry.
- **Mesh health that is actionable.** Scan welded topology for boundaries, non-manifold edges, reversed adjacency, degenerate faces, duplicates, isolated faces, surface area, and closed volume.
- **Non-destructive local repair.** Remove invalid or duplicate faces, fill simple planar holes, regenerate normals, and optionally center geometry. The source is never overwritten.
- **Interaction-first rendering.** Render only when the scene changes, adapt pixel ratio to measured frame cadence, avoid synchronous acceleration builds during open, and lazy-load importers and exporters.
- **A deliberate interface.** The workbench stays useful on narrow screens and presents a clear WebGL recovery state instead of crashing to a blank page.
- **Explicit model tools.** Measure distance, angle, and three-point radius; place local annotations; rotate an ambiguous model in 90° steps; place it on the ground; and inspect a non-destructive section plane.
- **Avatar-aware VRM viewing.** Open VRM 0.x and 1.0 avatars with normalized forward orientation, humanoid rigs, MToon materials, expressions, constraints, spring-bone updates, retained clips, and visible license metadata.
- **Portable view state.** Hosted models can be shared with camera, display, orientation, clipping, units, and annotations in the URL. Local models can export the same setup as a view manifest without pretending the source file is included.
- **No model-upload path.** Parsing, inspection, diagnosis, repair, screenshots, and exports happen in the browser. CAD parser runtimes are version-pinned and served from the same origin under a strict script policy.

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
| Web and interchange | glTF, GLB, VRM 0.x/1.0 avatars, OBJ + MTL, FBX, COLLADA, USDZ |
| Manufacturing and mesh | STL, 3MF, AMF, PLY, OFF, VTK |
| CAD | STEP, IGES, BREP, Rhino 3DM |
| BIM | IFC2X3/IFC4 local tessellation; DotBIM `.bim` 1.0/1.1 geometry, transforms, colors, and attached properties |
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
- Distance, angle, and three-point radius measurement with an explicit unit assumption
- Local point annotations with editable labels
- X/Y/Z section plane with position and visible-side controls
- X/Y/Z ±90° orientation correction, place-on-ground, and reset
- Share links for CORS-enabled remote models and downloadable view manifests for local files

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

Exports represent the parsed render scene. They are not semantic CAD conversion: STEP/IGES/BREP/3DM object properties may not survive a mesh-scene export.

## Independence from Online3DViewer

Modern 3D Workbench does **not** import or wrap Online3DViewer. The application has its own viewer lifecycle, format registry, file-package layer, diagnostics, repair, measurement, clipping, view-state, SDK, and export flows. It uses narrow, format-specific open-source dependencies such as Three.js example loaders, `rhino3dm`, and a direct `occt-import-js` worker adapter.

| Capability | Modern 3D Workbench 0.3 |
| --- | --- |
| Format registry | 27 independently maintained format families; maturity varies by fixture depth |
| Folder / multi-file / ZIP intake | Folder, multi-file, ZIP, normalized package index |
| Topology diagnosis | Dedicated worker scan with quantitative findings |
| Repair | Conservative local mesh repair creating a separate working copy |
| Model tools | Distance, angle, radius, annotations, orientation correction, clipping |
| Render scheduling | Render-on-demand, adaptive DPR, and interaction-time point budget |
| Render/GPU inspection | Load/parse/GPU/draw-call/live renderer telemetry |
| Developer integration | Core SDK, React package, Web Component, and URL-configurable embed |
| Search routes | Static HTML entries for STL, GLB, OBJ, and STEP tasks |
| Export | GLB, glTF, OBJ, STL, PLY, USDZ from the normalized render scene |

This table describes this repository, not a claim that every parser is universally faster or more accurate than Online3DViewer. Reproducible measurements and comparison rules are in the [benchmark protocol](docs/BENCHMARK_PROTOCOL.md).

## SDK and embed

Three buildable packages live in `packages/`:

- `@fast-3d-viewer/core` — browser API and independent viewer engine;
- `@fast-3d-viewer/react` — typed React component and imperative handle;
- `@fast-3d-viewer/web-component` — `<modern-3d-viewer>` custom element.

```ts
import { Modern3DViewer } from '@fast-3d-viewer/core';

const viewer = new Modern3DViewer(document.querySelector('#viewer')!);
await viewer.openUrl('https://assets.example.com/model.glb');
viewer.setInteractionMode('distance');
```

The static embed route accepts `model`/`src`, `grid`, `shadows`, `autorotate`, `background`, and `controls` query parameters. Version 0.3 packages are buildable and dry-pack testable but have not yet been published to npm.

## Architecture

```text
files / folder / URL / ZIP
           │
           ▼
  normalized FileBundle
           │
     ┌─────┴──────────┐
     ▼                ▼
native loaders      CAD worker adapter
format-specific     OpenCascade WASM
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

Unit tests cover the format registry, package normalization, archive safety, scene inspection, measurement math, view-state serialization, and DotBIM parsing. Playwright covers real WebGL rendering, VRM 0.x/1.0 fixture loading, repair feedback, mobile controls, viewport containment, topology correctness, and the no-WebGL recovery state. CI runs on every push and pull request.

## Project status

This is an early public release. The workbench is useful today, but the compatibility matrix needs more real-world fixtures, especially for vendor-specific CAD files. Known boundaries:

- ZIP entries are protected against absolute and parent-traversal paths; companion resolution still depends on each format's path conventions.
- Interactive diagnostics intentionally stop above the configured triangle budget; repair is not streamed yet.
- Point clouds use an interaction-time draw budget, not spatial or octree LOD. Remote downloads stream with byte progress and a hard cap, but model parsing still begins after the complete source arrives.
- Export preserves the parsed render scene, not every source-format semantic.
- WebGPU is not enabled; the current production renderer targets WebGL 2.
- IFC now has a self-hosted Web-IFC route and a redistributable IFC4 fixture, but it is a tessellated element scene rather than a complete BIM relationship/property editor. FCStd is not registered; adding a suffix without a licensed fixture and semantic boundary is not considered support.
- Share URLs reference hosted CORS-enabled models. The application does not upload a local file to make it shareable.

Open an issue with a minimal redistributable fixture when a model fails. Format support improves fastest when a regression can be reproduced legally in CI.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Importers should include a small licensed fixture, a parser test, a browser-level success assertion, and a clear statement of what is and is not preserved.

## Security and privacy

Files are processed locally by the published app. URL imports are fetched directly by the browser and therefore depend on the remote server's CORS policy. Review [SECURITY.md](SECURITY.md) for archive limits, untrusted-model guidance, and private reporting.

STEP/IGES/BREP, IFC, and Rhino 3DM use version-pinned runtime files served from the application origin. Direct glTF Draco decoding is copied from the pinned Three.js dependency at build time. `SHA256SUMS` records reviewed CAD payloads, and the browser policy blocks third-party executable code. Remote URL import still contacts the model host selected by the user. SDK consumers must copy the decoder assets described in [`packages/core/README.md`](packages/core/README.md) into equivalent same-origin paths.

## License and attribution

Modern 3D Workbench is MIT licensed. The repository and package slug remain `fast-3d-viewer`. Third-party dependency attribution is documented in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
