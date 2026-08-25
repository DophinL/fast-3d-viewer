import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import type { AssetIssue, AssetStats, FileBundle, GeometryPayload } from './types';

type InspectableObject = Object3D & {
  isBone?: boolean;
  isLine?: boolean;
  isMesh?: boolean;
  isPoints?: boolean;
  isInstancedMesh?: boolean;
  isSkinnedMesh?: boolean;
  morphTargetInfluences?: number[];
  geometry?: BufferGeometry;
  material?: Material | Material[];
};

type InspectableMaterial = Material & Record<string, unknown> & {
  isMeshPhysicalMaterial?: boolean;
  isMeshStandardMaterial?: boolean;
};

const TEXTURE_SLOTS = [
  'alphaMap', 'aoMap', 'bumpMap', 'clearcoatMap', 'clearcoatNormalMap', 'displacementMap',
  'emissiveMap', 'envMap', 'lightMap', 'map', 'metalnessMap', 'normalMap', 'roughnessMap',
  'sheenColorMap', 'specularColorMap', 'transmissionMap', 'thicknessMap', 'iridescenceMap',
] as const;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en', { notation: value >= 100_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
}

export function inspectAsset(
  root: Object3D,
  bundle: FileBundle,
  animationCount: number,
  loadDurationMs: number,
  parseDurationMs: number,
): AssetStats {
  const materials = new Map<string, InspectableMaterial>();
  const textures = new Map<string, Texture>();
  let meshes = 0;
  let points = 0;
  let lines = 0;
  let vertices = 0;
  let triangles = 0;
  let bones = 0;
  let drawCalls = 0;
  let hasNormals = false;
  let hasTangents = false;
  let hasUV = false;
  let hasVertexColors = false;
  let hasPbr = false;
  let estimatedGpuBytes = 0;

  root.updateMatrixWorld(true);
  root.traverse((child) => {
    const object = child as InspectableObject;
    if (object.isBone) bones += 1;
    if (!object.geometry) return;
    if (object.isMesh) meshes += 1;
    if (object.isPoints) points += 1;
    if (object.isLine) lines += 1;

    const geometry = object.geometry;
    if (object.isMesh) drawCalls += Math.max(geometry.groups.length, 1);
    else if (object.isPoints || object.isLine) drawCalls += 1;
    const position = geometry.getAttribute('position');
    const index = geometry.getIndex();
    vertices += position?.count ?? 0;
    if (object.isMesh) triangles += Math.floor((index?.count ?? position?.count ?? 0) / 3);
    hasNormals ||= Boolean(geometry.getAttribute('normal'));
    hasTangents ||= Boolean(geometry.getAttribute('tangent'));
    hasUV ||= Boolean(geometry.getAttribute('uv'));
    hasVertexColors ||= Boolean(geometry.getAttribute('color'));
    for (const key of Object.keys(geometry.attributes)) {
      const attribute = geometry.getAttribute(key);
      estimatedGpuBytes += attribute.count * attribute.itemSize * attribute.array.BYTES_PER_ELEMENT;
    }
    if (index) estimatedGpuBytes += index.count * index.array.BYTES_PER_ELEMENT;

    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : object.material ? [object.material] : [];
    for (const baseMaterial of objectMaterials) {
      const material = baseMaterial as InspectableMaterial;
      materials.set(material.uuid, material);
      hasPbr ||= Boolean(material.isMeshStandardMaterial || material.isMeshPhysicalMaterial);
      for (const slot of TEXTURE_SLOTS) {
        const texture = material[slot] as Texture | undefined;
        if (!texture?.isTexture) continue;
        textures.set(texture.uuid, texture);
        const image = texture.image as { width?: number; height?: number } | undefined;
        if (image?.width && image.height) estimatedGpuBytes += image.width * image.height * 4 * 1.33;
      }
    }
  });

  const box = new Box3().setFromObject(root);
  const size = box.isEmpty() ? new Vector3() : box.getSize(new Vector3());
  return {
    fileName: bundle.mainFile.name,
    format: bundle.mainFile.extension,
    totalBytes: bundle.totalBytes,
    fileCount: bundle.entries.length,
    meshes,
    points,
    lines,
    vertices,
    triangles,
    materials: materials.size,
    textures: textures.size,
    bones,
    animations: animationCount,
    drawCalls,
    dimensions: { x: size.x, y: size.y, z: size.z, diagonal: size.length() },
    hasNormals,
    hasTangents,
    hasUV,
    hasVertexColors,
    hasPbr,
    loadDurationMs,
    parseDurationMs,
    estimatedGpuBytes: Math.round(estimatedGpuBytes),
  };
}

export function buildAssetIssues(stats: AssetStats): AssetIssue[] {
  const issues: AssetIssue[] = [];
  if (stats.meshes === 0 && stats.points === 0 && stats.lines === 0) {
    issues.push({ code: 'empty-geometry', severity: 'error', title: 'No visible geometry', detail: 'The parser completed but found no mesh, points, or line geometry.', fix: 'Check that this is the main file and include every companion file.' });
  }
  if (stats.triangles > 2_000_000) {
    issues.push({ code: 'high-poly', severity: 'warning', title: 'Heavy geometry', detail: `${formatNumber(stats.triangles)} triangles may exceed mobile GPU budgets.`, fix: 'Create a reduced web copy before publishing.', count: stats.triangles });
  } else if (stats.triangles > 500_000) {
    issues.push({ code: 'medium-poly', severity: 'info', title: 'Desktop-weight geometry', detail: `${formatNumber(stats.triangles)} triangles should be tested on target phones.`, fix: 'Use the performance meter and inspect frame time.' });
  }
  if (stats.drawCalls > 500) {
    issues.push({ code: 'draw-calls', severity: 'warning', title: 'High draw-call count', detail: `${formatNumber(stats.drawCalls)} render objects can bottleneck the CPU before the GPU is full.`, fix: 'Merge compatible materials and static meshes.', count: stats.drawCalls });
  }
  if (stats.textures > 0 && !stats.hasUV) {
    issues.push({ code: 'texture-no-uv', severity: 'warning', title: 'Textures without UV coordinates', detail: 'Image textures were found but the geometry has no primary UV channel.', fix: 'Unwrap UVs or switch to a mapping method that does not require them.' });
  }
  if (['gltf', 'glb', 'vrm', 'fbx', 'obj', 'dae', 'usdz'].includes(stats.format) && stats.textures === 0) {
    issues.push({ code: 'no-textures', severity: 'info', title: 'No image textures detected', detail: 'The model may be a white model, use vertex colors, or be missing companion images.', fix: 'Add the texture folder or inspect material values.' });
  }
  if (stats.meshes > 0 && !stats.hasNormals) {
    issues.push({ code: 'no-normals', severity: 'warning', title: 'Normals are missing', detail: 'Lighting cannot shade this mesh correctly without vertex or face normals.', fix: 'Recalculate normals before export.' });
  }
  if (stats.estimatedGpuBytes > 512 * 1024 ** 2) {
    issues.push({ code: 'gpu-memory', severity: 'warning', title: 'Large GPU memory estimate', detail: `Geometry and decoded textures may use about ${formatBytes(stats.estimatedGpuBytes)} of GPU memory.`, fix: 'Resize textures and reduce geometry for browser delivery.' });
  }
  if (stats.format === 'stl') {
    issues.push({ code: 'stl-units', severity: 'info', title: 'STL has no units', detail: 'The file stores coordinates but not millimeters, inches, or another unit.', fix: 'Confirm units before manufacturing or printing.' });
  }
  if (issues.length === 0) {
    issues.push({ code: 'basic-pass', severity: 'pass', title: 'Basic asset checks passed', detail: 'No immediate scene-level problems were found. Run mesh topology diagnostics for print or simulation use.' });
  }
  return issues;
}

export function collectGeometryPayloads(root: Object3D, triangleLimit = 500_000): { payloads: GeometryPayload[]; scanLimited: boolean; triangleCount: number } {
  const payloads: GeometryPayload[] = [];
  let triangleCount = 0;
  let copiedValues = 0;
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    const object = child as InspectableObject;
    if (!object.isMesh || !object.geometry) return;
    if (object.isInstancedMesh || object.isSkinnedMesh || object.morphTargetInfluences?.some((weight) => weight !== 0)) {
      throw new Error('Topology scan is disabled for instanced, skinned, or actively morphed meshes because a static triangle copy would be inaccurate.');
    }
    const position = object.geometry.getAttribute('position') as BufferAttribute | undefined;
    if (!position) return;
    const index = object.geometry.getIndex();
    triangleCount += Math.floor((index?.count ?? position.count) / 3);
    copiedValues += position.count * 3 + (index?.count ?? 0);
    if (triangleCount > triangleLimit || copiedValues > 32_000_000) return;
    const positions = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index += 1) {
      positions[index * 3] = position.getX(index);
      positions[index * 3 + 1] = position.getY(index);
      positions[index * 3 + 2] = position.getZ(index);
    }
    const indices = object.geometry.index
      ? Uint32Array.from(object.geometry.index.array as ArrayLike<number>)
      : null;
    payloads.push({
      id: object.uuid,
      positions,
      indices,
      matrix: new Float32Array((object.matrixWorld ?? new Matrix4()).elements),
    });
  });
  const scanLimited = triangleCount > triangleLimit || copiedValues > 32_000_000;
  return { payloads: scanLimited ? [] : payloads, scanLimited, triangleCount };
}

export function disposeObject(root: Object3D): void {
  root.traverse((child) => {
    const object = child as InspectableObject;
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) {
      const record = material as InspectableMaterial;
      for (const slot of TEXTURE_SLOTS) (record[slot] as Texture | undefined)?.dispose?.();
      material.dispose();
    }
  });
}
