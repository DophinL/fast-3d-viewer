# Format support matrix

Support means the current importer recognizes the listed extension and can produce a render scene for supported variants. It does not mean every vendor dialect, companion reference, animation channel, metadata field, unit, or semantic object is preserved.

| Format | Extensions | Route | Package | Materials | Animation | Mesh repair | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| glTF / GLB | `.gltf`, `.glb` | Fast path | Yes | Yes | Yes | Yes | External buffers/textures, Meshopt, and Draco; compatibility fallback on parser failure. |
| Wavefront OBJ | `.obj` | Coverage | Yes | Yes | No | Yes | Include MTL and texture files or drop the whole folder/ZIP. |
| Autodesk FBX | `.fbx` | Fast path | Yes | Yes | Yes | Yes | Binary and ASCII; compatibility fallback on parser failure. |
| STL | `.stl` | Coverage | No | No | No | Yes | Binary/ASCII; format has no standard unit metadata. |
| PLY | `.ply` | Coverage | No | Yes | No | Yes | Mesh and point data; property combinations vary. |
| 3MF | `.3mf` | Coverage | Yes | Yes | No | Yes | Packaged manufacturing scene; not all extensions are preserved. |
| 3D Studio | `.3ds` | Coverage | Yes | Yes | No | Yes | Legacy limits and texture references apply. |
| COLLADA | `.dae` | Fast path | Yes | Yes | Yes | Yes | Exporter-specific profiles may differ; compatibility fallback is available. |
| VRML | `.wrl`, `.vrml` | Coverage | Yes | Yes | No | Yes | VRML 2.0 path. |
| AMF | `.amf` | Coverage | No | Yes | No | Yes | Additive manufacturing triangle data. |
| OFF | `.off` | Coverage | No | No | No | Yes | Polygon mesh converted to render triangles. |
| STEP | `.step`, `.stp` | CAD | No | Yes | No | No | Tessellated locally with OpenCascade; parametric history is not a render-scene guarantee. |
| IGES | `.iges`, `.igs` | CAD | No | Yes | No | No | Surfaces/solids tessellated for display. |
| BREP | `.brep` | CAD | No | Yes | No | No | OpenCascade boundary representation. |
| Rhino | `.3dm` | Coverage | Yes | Yes | No | No | Geometry, layers, and selected object properties. |
| FreeCAD | `.fcstd` | CAD | Yes | Yes | No | No | Document archive; source constraints and workbenches are not preserved by mesh export. |
| IFC | `.ifc` | BIM | No | Yes | No | No | Display geometry and properties depend on importer; scene export is not IFC conversion. |
| DotBIM | `.bim` | BIM | No | Yes | No | No | Open building-exchange geometry and metadata. |
| USDZ | `.usdz` | Fast path | Yes | Yes | No | Yes | Current Three.js USDZ subset; variants need fixture validation. |
| MagicaVoxel | `.vox` | Fast path | No | Yes | No | No | Palette voxel scenes. |
| LDraw | `.ldr`, `.mpd`, `.dat` | Fast path | Embedded MPD only | Yes | No | No | External part-library fetches are blocked in local-first mode. |
| XYZ points | `.xyz` | Fast path | No | Yes | No | No | XYZ and common XYZRGB text rows. |
| PCD | `.pcd` | Fast path | No | Yes | No | No | PCL point cloud data. |
| VTK | `.vtk`, `.vtp` | Fast path | No | No | No | Yes | Polygon data supported by the Three.js loader subset. |
| KMZ | `.kmz` | Fast path | Yes | Yes | No | Yes | Compressed KML/COLLADA package. |
| G-code | `.gcode`, `.gco`, `.nc` | Fast path | No | No | No | No | Toolpath lines, not a solid manufacturing simulation. |
| Quake II MD2 | `.md2` | Fast path | No | No | Yes | Yes | Vertex animation; skins are a separate concern. |

## Route definitions

- **Fast path:** a lazy Three.js example loader, optimized for direct scene creation.
- **Coverage:** the vendored Online3DViewer importer family.
- **CAD:** the vendored OpenCascade/WebAssembly conversion path.
- **BIM:** the vendored IFC or DotBIM conversion path.

## Package behavior

Use folder or ZIP intake for formats with external references. Paths are normalized and unsafe archive entries are rejected. The current upstream adapter may flatten companion names for some importers, so duplicate basenames in separate nested folders are not yet guaranteed.

## Repair meaning

“Yes” means the normalized triangle surface can be sent to the local repair worker. It does not mean source semantics are repaired. A STEP solid repaired as triangles becomes a mesh working copy, not a corrected STEP model.

## Reporting compatibility

Open an issue with a redistributable fixture and describe which layer failed:

1. intake or archive expansion;
2. primary-file selection;
3. companion resolution;
4. parser execution;
5. scene assembly;
6. material or texture decode;
7. viewport rendering;
8. diagnosis, repair, or export.
