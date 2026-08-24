import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  type AnimationClip,
} from 'three';
import type { ExportRequest, RepairResult } from './types';

export interface ExportedModel {
  blob: Blob;
  extension: string;
  mimeType: string;
  name: string;
}

const baseName = (name: string): string => name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9._-]+/gi, '-');

function copyBinaryView(view: ArrayBufferView<ArrayBufferLike>): ArrayBuffer {
  return Uint8Array.from(new Uint8Array(view.buffer, view.byteOffset, view.byteLength)).buffer;
}

function cloneVisible(root: Object3D, onlyVisible: boolean): Object3D {
  if (!onlyVisible) return root;
  const clone = root.clone(true);
  const hidden: Object3D[] = [];
  clone.traverse((object) => {
    if (!object.visible) hidden.push(object);
  });
  hidden.forEach((object) => object.removeFromParent());
  return clone;
}

export async function exportModel(
  root: Object3D,
  sourceName: string,
  request: ExportRequest,
  animations: AnimationClip[] = [],
): Promise<ExportedModel> {
  const object = cloneVisible(root, request.onlyVisible ?? true);
  const stem = baseName(sourceName);

  if (request.format === 'glb' || request.format === 'gltf') {
    const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
    const binary = request.format === 'glb';
    const output = await new Promise<ArrayBuffer | Record<string, unknown>>((resolve, reject) => {
      new GLTFExporter().parse(object, resolve, reject, {
        binary,
        onlyVisible: request.onlyVisible ?? true,
        animations: request.includeAnimations ? animations : [],
        trs: false,
        truncateDrawRange: true,
        maxTextureSize: 8192,
      });
    });
    const blob = binary
      ? new Blob([output as ArrayBuffer], { type: 'model/gltf-binary' })
      : new Blob([JSON.stringify(output, null, 2)], { type: 'model/gltf+json' });
    return { blob, extension: request.format, mimeType: blob.type, name: `${stem}.${request.format}` };
  }

  if (request.format === 'obj') {
    const { OBJExporter } = await import('three/examples/jsm/exporters/OBJExporter.js');
    const blob = new Blob([new OBJExporter().parse(object)], { type: 'text/plain' });
    return { blob, extension: 'obj', mimeType: blob.type, name: `${stem}.obj` };
  }

  if (request.format === 'stl') {
    const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');
    const output = new STLExporter().parse(object, { binary: request.binary ?? true });
    const blob = new Blob([typeof output === 'string' ? output : copyBinaryView(output)], { type: 'model/stl' });
    return { blob, extension: 'stl', mimeType: blob.type, name: `${stem}.stl` };
  }

  if (request.format === 'ply') {
    const { PLYExporter } = await import('three/examples/jsm/exporters/PLYExporter.js');
    const output = await new Promise<ArrayBuffer | string>((resolve) => {
      new PLYExporter().parse(object, resolve, { binary: request.binary ?? true });
    });
    const blob = new Blob([output], { type: request.binary === false ? 'text/plain' : 'application/octet-stream' });
    return { blob, extension: 'ply', mimeType: blob.type, name: `${stem}.ply` };
  }

  const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');
  const output = await new USDZExporter().parseAsync(object as Group, { maxTextureSize: 8192 });
  const blob = new Blob([copyBinaryView(output)], { type: 'model/vnd.usdz+zip' });
  return { blob, extension: 'usdz', mimeType: blob.type, name: `${stem}.usdz` };
}

export function downloadExport(result: ExportedModel): void {
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = result.name;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function createRepairedObject(result: RepairResult, name = 'Repaired mesh'): Object3D {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(result.positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const material = new MeshStandardMaterial({ color: 0xbcb39f, roughness: 0.66, metalness: 0.03 });
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  const root = new Group();
  root.name = `${name} result`;
  root.add(mesh);
  return root;
}
