# Performance model

Modern 3D Workbench optimizes for low input latency and honest failure behavior. The historical repository slug is `fast-3d-viewer`; a universal “times faster” claim would be misleading because import cost varies across JavaScript parsers, WebAssembly CAD tessellation, texture decoding, model topology, browser cache, GPU, and device pixel ratio.

## Implemented controls

### Render on demand

The renderer invalidates when the camera, selection, scene, settings, animation, or viewport changes. Static scenes stop both GPU rendering and the request-animation-frame loop. Camera interaction and auto-rotation deliberately keep frames active.

### Adaptive resolution

The engine watches frame time and adjusts pixel ratio inside a bounded range. This targets interaction rather than chasing the device's maximum DPR on a dense display. The user-visible telemetry reports the active ratio.

### Point-cloud interaction budget

Point geometries retain their full source buffer. While the user is orbiting, the renderer caps each point draw range at 250,000 points when adaptive quality is enabled; it restores the complete draw range when interaction stops. This reduces camera latency but is not spatial LOD and cannot replace an octree for very large clouds.

### Streamed remote intake

Remote responses are read as a byte stream, report known or received bytes, and stop above the 256 MB interactive limit. Parsers still receive a complete `File`, so this is download progress and bounded intake rather than progressive geometry display.

### Lazy parser chunks

Importers and exporters load when requested. The large CAD/OpenCascade path is split away from the initial workbench. A user opening an STL should not download a CAD kernel first.

### First-frame protection

Opening a model does not synchronously build an acceleration structure for every
mesh. This keeps time-to-first-frame bounded for large assemblies. Selection
currently uses Three.js raycasting; a cancellable, lazy BVH build is planned for
assets where repeated picking justifies its memory cost.

### Worker topology scan

Edge incidence, welded topology, area, and volume are calculated outside the main UI thread. Input size is capped in the interactive release so memory use and wait time remain bounded.

### Predictable cleanup

Replacing a model disposes geometry, textures, and owned materials. Export object URLs are revoked. Workers terminate on application cleanup.

## Current build shape

The Vite production build emits an application entry plus independently cached loader families. The CAD adapter is lazy, and its large same-origin WASM runtimes are fetched only for their formats. Use the build output and the HTML module-preload list as evidence for a specific commit rather than copying old numbers into product claims.

```bash
npm run build
find dist/assets -type f -maxdepth 1 -print
```

## Reproducible benchmark protocol

The public `/benchmark/` route and `npm run benchmark:viewer` command implement the parser/assembly subset described in [BENCHMARK_PROTOCOL.md](BENCHMARK_PROTOCOL.md). When comparing with another viewer, record:

- exact commit or release;
- browser version and clean profile;
- operating system, CPU, GPU, memory, and power mode;
- cold-cache and warm-cache runs separately;
- the redistributable model and file-package layout;
- compressed source bytes, expanded bytes, triangles, textures, and animation;
- time to first usable camera interaction;
- time to fully parsed scene;
- peak JS heap and GPU estimate;
- median input delay while orbiting;
- steady-state frame time and active pixel ratio;
- correctness: missing geometry, materials, textures, transforms, and semantics.

The current harness runs two discarded warm-ups and seven measured iterations, then reports every sample, median, and p95. Do not compare a CAD cold start with an STL warm start or a low-DPR canvas with a native-resolution canvas.

## Performance budgets

These are engineering guardrails, not promises for every model:

- Initial application JavaScript should remain below 300 kB gzip.
- CAD and rarely used parsers must stay outside the initial chunk.
- Static scenes should stop requesting frames; interaction should reactivate the loop.
- Interactive work should target a 16.7 ms frame on capable desktop hardware.
- The viewport must remain operable when diagnostics are running.
- Diagnostics above the safe triangle budget must report a limit instead of freezing the page.
- A parser failure must leave the current interface recoverable.

CI enforces build success and behavior; bundle-size and model-corpus performance thresholds are planned once stable public fixtures are selected.

## Planned work

- broader public, redistributable format corpus with cold/warm measurements;
- automated bundle-size budgets;
- progressive glTF scene assembly after streamed network intake;
- point-cloud octree or spatial LOD;
- cancellable worker jobs and transferable-buffer pooling;
- optional mesh simplification with visible quality/error controls;
- WebGPU evaluation after importer and fallback parity are proven.
