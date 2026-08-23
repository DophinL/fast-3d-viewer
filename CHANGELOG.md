# Changelog

All notable changes are documented here. The project follows semantic versioning once the public API stabilizes.

## 0.1.0 - 2026-08-24

### Added

- Local-first React and Three.js 3D workbench.
- Folder, multi-file, URL, and ZIP package intake.
- 27 registered format families spanning web, mesh, print, CAD, BIM, point cloud, scene, and toolpath data.
- Lazy fast-path loaders plus the vendored Online3DViewer import backend.
- Render-on-demand, adaptive device pixel ratio, BVH picking, five render modes, standard views, screenshots, and live telemetry.
- Scene, geometry, material, animation, dimension, GPU memory, and draw-call inspection.
- Worker-based topology diagnosis and conservative mesh repair.
- GLB, glTF, OBJ, STL, PLY, and USDZ scene export.
- Desktop and mobile workbench layouts with a tested WebGL compatibility state.
- Unit, browser regression, CI, and GitHub Pages workflows.

### Known limitations

- CAD and BIM export is scene tessellation rather than semantic conversion.
- Repair handles triangle meshes and simple planar holes, not arbitrary self-intersections.
- Very large diagnostic scans are deliberately limited in the interactive release.
- Point-cloud LOD, progressive network streaming, and WebGPU are not included yet.

