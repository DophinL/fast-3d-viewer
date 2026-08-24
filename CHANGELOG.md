# Changelog

All notable changes are documented here. The project follows semantic versioning once the public API stabilizes.

## 0.1.0 - 2026-08-24

### Added

- Local-first React and Three.js 3D workbench.
- Folder, multi-file, URL, and ZIP package intake.
- 24 independently routed format families spanning web, mesh, print, CAD, point cloud, scene, and toolpath data.
- Lazy, format-specific native loaders plus a dedicated OpenCascade worker adapter for STEP, IGES, and BREP.
- Animated glTF/GLB, FBX, and COLLADA paths with local companion resolution.
- Render-on-demand, adaptive device pixel ratio, five render modes, standard views, bounded screenshots, and live telemetry.
- Play/pause control for retained model animation clips.
- Scene, geometry, material, animation, dimension, GPU memory, and draw-call inspection.
- Worker-based topology diagnosis and conservative mesh repair.
- GLB, glTF, OBJ, STL, PLY, and USDZ scene export.
- Desktop and mobile workbench layouts with a tested WebGL compatibility state.
- Unit, browser regression, CI, and GitHub Pages workflows.

### Changed

- Static scenes now stop scheduling animation frames until interaction resumes.
- Draco decoding for the direct glTF path is served from the same static origin.
- CAD and Rhino runtimes are version-pinned and served from the same origin with distributed licenses and payload hashes.
- Full topology scans now require an explicit user action and use a lower interactive memory budget.
- GitHub Pages deploys only after unit, build, and production-browser gates pass.

### Fixed

- Kept the complete interface usable when WebGL initialization fails.
- Kept the desktop workbench inside the visible viewport and retained camera recovery controls on mobile.
- Corrected the calibration fixture's face winding and preserved repair completion feedback.
- Resolved remote glTF companions against the source URL and bounded ZIP paths, file counts, and expanded bytes.
- Rejected empty geometry as unhealthy, honored the degenerate-face repair option, and covered topology repair branches.
- Restored source materials before disposal and removed transient display-material leaks.
- Blocked outbound companions in local models, bounded remote downloads, and prevented stale load or repair operations from replacing the active asset.
- Corrected XYZ loading, multi-material draw-call estimates, orthographic framing, topology validity criteria, and post-repair validation.

### Known limitations

- CAD export is scene tessellation rather than semantic conversion.
- Repair handles triangle meshes and simple planar holes, not arbitrary self-intersections.
- Very large diagnostic scans are deliberately limited in the interactive release.
- Point-cloud LOD, progressive network streaming, and WebGPU are not included yet.
