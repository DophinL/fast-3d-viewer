import type { FormatDefinition } from './types';

const formats: FormatDefinition[] = [
  { id: 'gltf', label: 'glTF / GLB', extensions: ['gltf', 'glb'], family: 'web', packageSupport: true, animations: true, materials: true, repair: true, loader: 'extra', description: 'Modern web and interchange scenes, including external buffers and textures.' },
  { id: 'obj', label: 'Wavefront OBJ', extensions: ['obj'], family: 'mesh', packageSupport: true, animations: false, materials: true, repair: true, loader: 'upstream', description: 'OBJ packages with MTL files and image textures.' },
  { id: 'fbx', label: 'Autodesk FBX', extensions: ['fbx'], family: 'scene', packageSupport: true, animations: true, materials: true, repair: true, loader: 'extra', description: 'Binary and ASCII FBX scenes with skinning and animation.' },
  { id: 'stl', label: 'STL', extensions: ['stl'], family: 'print', packageSupport: false, animations: false, materials: false, repair: true, loader: 'upstream', description: 'Binary or ASCII triangle meshes with print diagnostics and local repair.' },
  { id: 'ply', label: 'PLY', extensions: ['ply'], family: 'point-cloud', packageSupport: false, animations: false, materials: true, repair: true, loader: 'upstream', description: 'ASCII and binary polygon meshes or point clouds.' },
  { id: '3mf', label: '3MF', extensions: ['3mf'], family: 'print', packageSupport: true, animations: false, materials: true, repair: true, loader: 'upstream', description: 'Packaged additive-manufacturing scenes.' },
  { id: '3ds', label: '3D Studio', extensions: ['3ds'], family: 'scene', packageSupport: true, animations: false, materials: true, repair: true, loader: 'upstream', description: 'Legacy 3D Studio mesh scenes.' },
  { id: 'dae', label: 'COLLADA', extensions: ['dae'], family: 'scene', packageSupport: true, animations: true, materials: true, repair: true, loader: 'extra', description: 'COLLADA scenes, materials and animation channels.' },
  { id: 'vrml', label: 'VRML', extensions: ['wrl', 'vrml'], family: 'scene', packageSupport: true, animations: false, materials: true, repair: true, loader: 'upstream', description: 'VRML 2.0 geometry and material scenes.' },
  { id: 'amf', label: 'AMF', extensions: ['amf'], family: 'print', packageSupport: false, animations: false, materials: true, repair: true, loader: 'upstream', description: 'Additive Manufacturing Format meshes.' },
  { id: 'off', label: 'OFF', extensions: ['off'], family: 'mesh', packageSupport: false, animations: false, materials: false, repair: true, loader: 'upstream', description: 'Object File Format polygon meshes.' },
  { id: 'step', label: 'STEP', extensions: ['step', 'stp'], family: 'cad', packageSupport: false, animations: false, materials: true, repair: false, loader: 'upstream', description: 'ISO 10303 CAD solids and assemblies, tessellated locally through OpenCascade.' },
  { id: 'iges', label: 'IGES', extensions: ['iges', 'igs'], family: 'cad', packageSupport: false, animations: false, materials: true, repair: false, loader: 'upstream', description: 'IGES CAD surfaces and solids.' },
  { id: 'brep', label: 'BREP', extensions: ['brep'], family: 'cad', packageSupport: false, animations: false, materials: true, repair: false, loader: 'upstream', description: 'OpenCascade boundary-representation solids.' },
  { id: '3dm', label: 'Rhino 3DM', extensions: ['3dm'], family: 'cad', packageSupport: true, animations: false, materials: true, repair: false, loader: 'upstream', description: 'Rhino geometry, layers and object properties.' },
  { id: 'fcstd', label: 'FreeCAD', extensions: ['fcstd'], family: 'cad', packageSupport: true, animations: false, materials: true, repair: false, loader: 'upstream', description: 'FreeCAD document objects and assemblies.' },
  { id: 'ifc', label: 'IFC', extensions: ['ifc'], family: 'bim', packageSupport: false, animations: false, materials: true, repair: false, loader: 'upstream', description: 'Building information models with object properties.' },
  { id: 'bim', label: 'DotBIM', extensions: ['bim'], family: 'bim', packageSupport: false, animations: false, materials: true, repair: false, loader: 'upstream', description: 'Open DotBIM building exchange files.' },
  { id: 'usdz', label: 'USDZ', extensions: ['usdz'], family: 'scene', packageSupport: true, animations: false, materials: true, repair: true, loader: 'extra', description: 'Packaged Universal Scene Description assets for spatial computing.' },
  { id: 'vox', label: 'MagicaVoxel', extensions: ['vox'], family: 'mesh', packageSupport: false, animations: false, materials: true, repair: false, loader: 'extra', description: 'Palette-based voxel scenes.' },
  { id: 'ldraw', label: 'LDraw', extensions: ['ldr', 'mpd', 'dat'], family: 'scene', packageSupport: false, animations: false, materials: true, repair: false, loader: 'extra', description: 'LEGO-compatible LDraw models with embedded MPD submodels; external part libraries are not bundled.' },
  { id: 'xyz', label: 'XYZ Points', extensions: ['xyz'], family: 'point-cloud', packageSupport: false, animations: false, materials: true, repair: false, loader: 'extra', description: 'Plain XYZ or XYZRGB point clouds.' },
  { id: 'pcd', label: 'Point Cloud Data', extensions: ['pcd'], family: 'point-cloud', packageSupport: false, animations: false, materials: true, repair: false, loader: 'extra', description: 'PCL Point Cloud Data files.' },
  { id: 'vtk', label: 'VTK', extensions: ['vtk', 'vtp'], family: 'mesh', packageSupport: false, animations: false, materials: false, repair: true, loader: 'extra', description: 'Visualization Toolkit polygon data.' },
  { id: 'kmz', label: 'KMZ', extensions: ['kmz'], family: 'scene', packageSupport: true, animations: false, materials: true, repair: true, loader: 'extra', description: 'Compressed KML/COLLADA geospatial model packages.' },
  { id: 'gcode', label: 'G-code', extensions: ['gcode', 'gco', 'nc'], family: 'toolpath', packageSupport: false, animations: false, materials: false, repair: false, loader: 'extra', description: 'CNC and additive-manufacturing toolpaths.' },
  { id: 'md2', label: 'Quake II MD2', extensions: ['md2'], family: 'scene', packageSupport: false, animations: true, materials: false, repair: true, loader: 'extra', description: 'Quake II vertex-animated meshes.' },
];

export const FORMAT_DEFINITIONS = Object.freeze(formats);
export const SUPPORTED_EXTENSIONS = Object.freeze(formats.flatMap((format) => format.extensions));

export function getExtension(name: string): string {
  const cleanName = name.split(/[?#]/, 1)[0] ?? name;
  return cleanName.includes('.') ? cleanName.split('.').pop()!.toLowerCase() : '';
}

export function findFormat(nameOrExtension: string): FormatDefinition | undefined {
  const extension = nameOrExtension.includes('.') ? getExtension(nameOrExtension) : nameOrExtension.toLowerCase();
  return FORMAT_DEFINITIONS.find((format) => format.extensions.includes(extension));
}

export function getAcceptValue(): string {
  return SUPPORTED_EXTENSIONS.map((extension) => `.${extension}`).concat('.zip').join(',');
}

export function isSupportedFile(name: string): boolean {
  return getExtension(name) === 'zip' || Boolean(findFormat(name));
}
