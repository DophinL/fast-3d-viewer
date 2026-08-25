# Format support matrix

Support means the current importer recognizes the listed extension and can produce a render scene for supported variants. It does not mean every vendor dialect, companion reference, animation channel, metadata field, unit, or semantic object is preserved.

| Format | Extensions | Route | Package | Materials | Animation | Mesh repair | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| glTF / GLB | `.gltf`, `.glb` | Native | Yes | Yes | Yes | Yes | External buffers/textures, Meshopt, and same-origin Draco decoding. |
| VRM Avatar | `.vrm` | Native | No | Yes | Yes | No | VRM 0.x and 1.0 humanoid rigs, MToon materials, expressions, constraints, spring bones, and retained glTF clips. Legacy forward orientation is normalized. Mesh repair is disabled to avoid silently destroying avatar semantics. |
| Wavefront OBJ | `.obj` | Native | Yes | Yes | No | Yes | Include MTL and texture files or drop the whole folder/ZIP. |
| Autodesk FBX | `.fbx` | Native | Yes | Yes | Yes | Yes | Binary and ASCII variants supported by the dedicated loader. |
| STL | `.stl` | Native | No | No | No | Yes | Binary/ASCII; format has no standard unit metadata. |
| PLY | `.ply` | Native | No | Yes | No | Yes | Mesh and point data; property combinations vary. |
| 3MF | `.3mf` | Native | Yes | Yes | No | Yes | Packaged manufacturing scene; not all extensions are preserved. |
| 3D Studio | `.3ds` | Native | Yes | Yes | No | Yes | Legacy limits and texture references apply. |
| COLLADA | `.dae` | Native | Yes | Yes | Yes | Yes | Exporter-specific profiles may differ. |
| VRML | `.wrl`, `.vrml` | Native | No | Yes | No | Yes | VRML 2.0 path. |
| AMF | `.amf` | Native | No | Yes | No | Yes | Additive manufacturing triangle data. |
| OFF | `.off` | Native | No | No | No | Yes | Local polygon triangulation. |
| STEP | `.step`, `.stp` | CAD | No | Yes | No | No | Tessellated locally with OpenCascade; parametric history is not a render-scene guarantee. |
| IGES | `.iges`, `.igs` | CAD | No | Yes | No | No | Surfaces/solids tessellated for display. |
| BREP | `.brep` | CAD | No | Yes | No | No | OpenCascade boundary representation. |
| Rhino | `.3dm` | Native | Yes | Yes | No | No | Geometry and layers through the dedicated Rhino loader. |
| DotBIM | `.bim` | Native | No | Yes | No | No | Independently parses schema 1.0/1.1 meshes, element transforms, element or face colors, GUID/type, and attached info. Coordinates are defined by the format in meters. |
| IFC | `.ifc` | Native | No | Yes | No | No | IFC2X3/IFC4 geometry through self-hosted Web-IFC. Retains element express ID, GUID, type, and name in the scene; does not claim full relationship/property editing. |
| USDZ | `.usdz` | Native | Yes | Yes | No | Yes | Current Three.js USDZ subset; variants need fixture validation. |
| MagicaVoxel | `.vox` | Native | No | Yes | No | No | Palette voxel scenes. |
| LDraw | `.ldr`, `.mpd`, `.dat` | Native | Embedded MPD only | Yes | No | No | External part-library fetches are blocked in local-first mode. |
| XYZ points | `.xyz` | Native | No | Yes | No | No | XYZ and common XYZRGB text rows. |
| PCD | `.pcd` | Native | No | Yes | No | No | PCL Point Cloud Data files. |
| VTK | `.vtk`, `.vtp` | Native | No | No | No | Yes | Polygon data supported by the Three.js loader subset. |
| KMZ | `.kmz` | Native | Yes | Yes | No | Yes | Compressed KML/COLLADA package. |
| G-code | `.gcode`, `.gco`, `.nc` | Native | No | No | No | No | Toolpath lines, not a solid manufacturing simulation. |
| Quake II MD2 | `.md2` | Native | No | No | Yes | Yes | Vertex animation; skins are a separate concern. |

## Route definitions

- **Native:** a focused format-specific loader or local adapter, lazy-loaded when practical.
- **CAD:** the direct self-hosted OpenCascade/WebAssembly worker adapter.

## Package behavior

Use folder or ZIP intake for formats with external references. Paths are normalized and unsafe archive entries are rejected. Package behavior is tested per loader; formats marked single-file do not claim external-library resolution.

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
