import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Material,
} from 'three';

interface DotBimColor { r: number; g: number; b: number; a: number }
interface DotBimVector { x: number; y: number; z: number }
interface DotBimRotation { qx: number; qy: number; qz: number; qw: number }
interface DotBimMesh { mesh_id: number; coordinates: number[]; indices: number[] }
interface DotBimElement {
  mesh_id: number;
  vector: DotBimVector;
  rotation: DotBimRotation;
  guid?: string;
  type?: string;
  color?: DotBimColor;
  face_colors?: number[];
  info?: Record<string, string>;
}
interface DotBimDocument {
  schema_version: string;
  meshes: DotBimMesh[];
  elements: DotBimElement[];
  info?: Record<string, string>;
}

export interface DotBimParseResult {
  root: Group;
  schemaVersion: string;
  meshDefinitions: number;
  elementCount: number;
  warnings: string[];
}

const MAX_VERTICES = 20_000_000;
const MAX_TRIANGLES = 20_000_000;
const defaultColor: DotBimColor = { r: 188, g: 196, b: 202, a: 255 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function safeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function readNumberArray(value: unknown, name: string): number[] {
  if (!Array.isArray(value) || !value.every(finiteNumber)) throw new Error(`DotBIM ${name} must be an array of finite numbers.`);
  return value;
}

function readMesh(value: unknown, index: number): DotBimMesh {
  if (!isRecord(value) || !safeInteger(value.mesh_id)) throw new Error(`DotBIM mesh ${index + 1} has an invalid mesh_id.`);
  const meshId = value.mesh_id;
  const coordinates = readNumberArray(value.coordinates, `mesh ${meshId} coordinates`);
  const indices = readNumberArray(value.indices, `mesh ${meshId} indices`);
  if (coordinates.length % 3 !== 0 || coordinates.length === 0) throw new Error(`DotBIM mesh ${meshId} coordinates must contain complete XYZ triples.`);
  if (indices.length % 3 !== 0 || indices.length === 0) throw new Error(`DotBIM mesh ${meshId} indices must contain complete triangles.`);
  if (coordinates.length / 3 > MAX_VERTICES) throw new Error(`DotBIM mesh ${meshId} exceeds the ${MAX_VERTICES.toLocaleString()} vertex safety limit.`);
  if (indices.length / 3 > MAX_TRIANGLES) throw new Error(`DotBIM mesh ${meshId} exceeds the ${MAX_TRIANGLES.toLocaleString()} triangle safety limit.`);
  const vertexCount = coordinates.length / 3;
  const integerIndices = indices.map((item) => {
    if (!safeInteger(item) || item >= vertexCount) throw new Error(`DotBIM mesh ${meshId} references vertex ${item}, outside its vertex table.`);
    return item;
  });
  return { mesh_id: meshId, coordinates, indices: integerIndices };
}

function readVector(value: unknown, name: string): DotBimVector {
  if (!isRecord(value) || !finiteNumber(value.x) || !finiteNumber(value.y) || !finiteNumber(value.z)) throw new Error(`DotBIM ${name} must contain finite x, y, and z values.`);
  return { x: value.x, y: value.y, z: value.z };
}

function readRotation(value: unknown, name: string): DotBimRotation {
  if (!isRecord(value) || !finiteNumber(value.qx) || !finiteNumber(value.qy) || !finiteNumber(value.qz) || !finiteNumber(value.qw)) {
    throw new Error(`DotBIM ${name} must contain finite qx, qy, qz, and qw values.`);
  }
  const lengthSquared = value.qx ** 2 + value.qy ** 2 + value.qz ** 2 + value.qw ** 2;
  if (lengthSquared < 1e-12) throw new Error(`DotBIM ${name} cannot be a zero-length quaternion.`);
  return { qx: value.qx, qy: value.qy, qz: value.qz, qw: value.qw };
}

function readColor(value: unknown, name: string): DotBimColor {
  if (!isRecord(value)) throw new Error(`DotBIM ${name} must be an RGBA object.`);
  const channels = ['r', 'g', 'b', 'a'] as const;
  for (const channel of channels) {
    if (!safeInteger(value[channel]) || Number(value[channel]) > 255) throw new Error(`DotBIM ${name}.${channel} must be an integer from 0 to 255.`);
  }
  return { r: Number(value.r), g: Number(value.g), b: Number(value.b), a: Number(value.a) };
}

function readInfo(value: unknown): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error('DotBIM info must be an object.');
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, String(entry)]));
}

function readElement(value: unknown, index: number): DotBimElement {
  if (!isRecord(value) || !safeInteger(value.mesh_id)) throw new Error(`DotBIM element ${index + 1} has an invalid mesh_id.`);
  const element: DotBimElement = {
    mesh_id: value.mesh_id,
    vector: readVector(value.vector, `element ${index + 1} vector`),
    rotation: readRotation(value.rotation, `element ${index + 1} rotation`),
  };
  if (typeof value.guid === 'string') element.guid = value.guid;
  if (typeof value.type === 'string') element.type = value.type;
  if (value.color !== undefined) element.color = readColor(value.color, `element ${index + 1} color`);
  if (value.face_colors !== undefined) {
    const faceColors = readNumberArray(value.face_colors, `element ${index + 1} face_colors`);
    if (!faceColors.every((channel) => safeInteger(channel) && channel <= 255)) throw new Error(`DotBIM element ${index + 1} face_colors must contain integer RGBA channels from 0 to 255.`);
    element.face_colors = faceColors;
  }
  element.info = readInfo(value.info);
  return element;
}

function readDocument(source: string): DotBimDocument {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (reason) {
    throw new Error(`DotBIM is not valid JSON: ${reason instanceof Error ? reason.message : String(reason)}`);
  }
  if (!isRecord(value) || typeof value.schema_version !== 'string') throw new Error('DotBIM is missing a string schema_version.');
  if (!Array.isArray(value.meshes) || !Array.isArray(value.elements)) throw new Error('DotBIM must contain meshes and elements arrays.');
  return {
    schema_version: value.schema_version,
    meshes: value.meshes.map(readMesh),
    elements: value.elements.map(readElement),
    info: readInfo(value.info),
  };
}

function createGeometry(mesh: DotBimMesh): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(Float32Array.from(mesh.coordinates), 3));
  geometry.setIndex(new BufferAttribute(Uint32Array.from(mesh.indices), 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.dotBimMeshId = mesh.mesh_id;
  return geometry;
}

function createSolidMaterial(color: DotBimColor): MeshStandardMaterial {
  const opacity = color.a / 255;
  return new MeshStandardMaterial({
    color: new Color(color.r / 255, color.g / 255, color.b / 255),
    roughness: 0.72,
    metalness: 0.02,
    opacity,
    transparent: opacity < 1,
    depthWrite: opacity >= 0.98,
  });
}

function createFaceColorGeometry(source: BufferGeometry, faceColors: number[], elementIndex: number): { geometry: BufferGeometry; material: Material } {
  const triangleCount = source.getIndex()!.count / 3;
  if (faceColors.length !== triangleCount * 4) throw new Error(`DotBIM element ${elementIndex + 1} has ${faceColors.length / 4} face colors for ${triangleCount} triangles.`);
  const geometry = source.toNonIndexed();
  const colors = new Float32Array(triangleCount * 3 * 4);
  let hasTransparency = false;
  for (let face = 0; face < triangleCount; face += 1) {
    const sourceOffset = face * 4;
    const red = faceColors[sourceOffset]! / 255;
    const green = faceColors[sourceOffset + 1]! / 255;
    const blue = faceColors[sourceOffset + 2]! / 255;
    const alpha = faceColors[sourceOffset + 3]! / 255;
    if (alpha < 1) hasTransparency = true;
    for (let vertex = 0; vertex < 3; vertex += 1) colors.set([red, green, blue, alpha], (face * 3 + vertex) * 4);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 4));
  return {
    geometry,
    material: new MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.72, metalness: 0.02, transparent: hasTransparency, depthWrite: !hasTransparency }),
  };
}

export function parseDotBim(source: string): DotBimParseResult {
  const document = readDocument(source);
  const warnings: string[] = [];
  if (!['1.0.0', '1.1.0'].includes(document.schema_version)) warnings.push(`Schema ${document.schema_version} is outside the tested 1.0.0 and 1.1.0 schemas.`);
  const geometries = new Map<number, BufferGeometry>();
  for (const mesh of document.meshes) {
    if (geometries.has(mesh.mesh_id)) throw new Error(`DotBIM mesh_id ${mesh.mesh_id} is duplicated.`);
    geometries.set(mesh.mesh_id, createGeometry(mesh));
  }

  const root = new Group();
  const usedTemplates = new Set<number>();
  root.name = 'DotBIM model';
  root.userData.schemaVersion = document.schema_version;
  root.userData.info = document.info ?? {};
  try {
    for (const [index, element] of document.elements.entries()) {
      const template = geometries.get(element.mesh_id);
      if (!template) throw new Error(`DotBIM element ${index + 1} references missing mesh_id ${element.mesh_id}.`);
      let geometry = template;
      let material: Material;
      if (element.face_colors) {
        const faceColor = createFaceColorGeometry(template, element.face_colors, index);
        geometry = faceColor.geometry;
        material = faceColor.material;
      } else {
        usedTemplates.add(element.mesh_id);
        material = createSolidMaterial(element.color ?? defaultColor);
      }
      const object = new Mesh(geometry, material);
      object.name = element.type || element.guid || `BIM element ${index + 1}`;
      object.position.copy(new Vector3(element.vector.x, element.vector.y, element.vector.z));
      object.quaternion.copy(new Quaternion(element.rotation.qx, element.rotation.qy, element.rotation.qz, element.rotation.qw).normalize());
      object.userData.guid = element.guid;
      object.userData.type = element.type;
      object.userData.info = element.info ?? {};
      object.userData.dotBimMeshId = element.mesh_id;
      root.add(object);
    }
    for (const [meshId, geometry] of geometries) if (!usedTemplates.has(meshId)) geometry.dispose();
  } catch (reason) {
    for (const child of root.children) {
      const mesh = child as Mesh<BufferGeometry, Material>;
      mesh.material.dispose();
      if (mesh.geometry !== geometries.get(mesh.userData.dotBimMeshId as number)) mesh.geometry.dispose();
    }
    geometries.forEach((geometry) => geometry.dispose());
    throw reason;
  }
  return { root, schemaVersion: document.schema_version, meshDefinitions: document.meshes.length, elementCount: document.elements.length, warnings };
}
