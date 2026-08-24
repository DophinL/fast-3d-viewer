import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { runtimeAssetUrl } from '../runtime-url';

export interface IfcParseProgress {
  completedMeshes: number;
  totalMeshes: number;
}

export interface IfcParseResult {
  root: Group;
  schema: string;
  elements: number;
  placements: number;
  geometryDefinitions: number;
}

interface IfcLineValue { value?: unknown }
interface IfcLine {
  type?: number;
  Name?: IfcLineValue | null;
  GlobalId?: IfcLineValue | null;
}

function createGeometry(vertexData: Float32Array, indexData: Uint32Array): BufferGeometry {
  if (vertexData.length % 6 !== 0) throw new Error('Web-IFC returned a vertex buffer that is not position/normal interleaved data.');
  const vertexCount = vertexData.length / 6;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const source = vertex * 6;
    const target = vertex * 3;
    positions[target] = vertexData[source]!;
    positions[target + 1] = vertexData[source + 1]!;
    positions[target + 2] = vertexData[source + 2]!;
    normals[target] = vertexData[source + 3]!;
    normals[target + 1] = vertexData[source + 4]!;
    normals[target + 2] = vertexData[source + 5]!;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setIndex(new BufferAttribute(Uint32Array.from(indexData), 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function materialKey(color: { x: number; y: number; z: number; w: number }): string {
  return [color.x, color.y, color.z, color.w].map((channel) => channel.toFixed(5)).join(':');
}

export async function parseIfc(data: ArrayBuffer, onProgress?: (progress: IfcParseProgress) => void): Promise<IfcParseResult> {
  const { IfcAPI } = await import('web-ifc');
  const api = new IfcAPI();
  api.SetWasmPath(runtimeAssetUrl('runtime/web-ifc/').toString(), true);
  let modelId = -1;
  const geometries = new Map<number, BufferGeometry>();
  const materials = new Map<string, MeshStandardMaterial>();
  try {
    await api.Init(undefined, true);
    modelId = api.OpenModel(new Uint8Array(data), {
      COORDINATE_TO_ORIGIN: true,
      CIRCLE_SEGMENTS: 24,
      MEMORY_LIMIT: 1_073_741_824,
    });
    if (modelId < 0) throw new Error('Web-IFC could not open this IFC model.');
    const schema = api.GetModelSchema(modelId);
    const root = new Group();
    root.name = `IFC ${schema} model`;
    root.userData.schema = schema;
    let elementCount = 0;
    let placementCount = 0;

    api.StreamAllMeshes(modelId, (flatMesh, index, total) => {
      const line = api.GetLine(modelId, flatMesh.expressID) as IfcLine | null;
      const type = line?.type ? api.GetNameFromTypeCode(line.type) : 'IFC element';
      const name = typeof line?.Name?.value === 'string' ? line.Name.value : null;
      const guid = typeof line?.GlobalId?.value === 'string' ? line.GlobalId.value : api.GetGuidFromExpressId(modelId, flatMesh.expressID);
      const element = new Group();
      element.name = name || `${type} #${flatMesh.expressID}`;
      element.userData.expressId = flatMesh.expressID;
      element.userData.ifcType = type;
      element.userData.guid = guid;

      for (let placement = 0; placement < flatMesh.geometries.size(); placement += 1) {
        const placed = flatMesh.geometries.get(placement);
        let geometry = geometries.get(placed.geometryExpressID);
        if (!geometry) {
          const wasmGeometry = api.GetGeometry(modelId, placed.geometryExpressID);
          try {
            const vertices = api.GetVertexArray(wasmGeometry.GetVertexData(), wasmGeometry.GetVertexDataSize());
            const indices = api.GetIndexArray(wasmGeometry.GetIndexData(), wasmGeometry.GetIndexDataSize());
            geometry = createGeometry(vertices, indices);
            geometry.userData.ifcGeometryExpressId = placed.geometryExpressID;
            geometries.set(placed.geometryExpressID, geometry);
          } finally {
            wasmGeometry.delete();
          }
        }

        const key = materialKey(placed.color);
        let material = materials.get(key);
        if (!material) {
          const opacity = Math.min(1, Math.max(0, placed.color.w));
          material = new MeshStandardMaterial({
            color: new Color(placed.color.x, placed.color.y, placed.color.z),
            opacity,
            transparent: opacity < 0.999,
            depthWrite: opacity >= 0.98,
            roughness: 0.72,
            metalness: 0.02,
            side: DoubleSide,
          });
          materials.set(key, material);
        }
        const mesh = new Mesh(geometry, material);
        mesh.name = `${element.name} geometry ${placement + 1}`;
        mesh.matrix.copy(new Matrix4().fromArray(placed.flatTransformation));
        mesh.matrixAutoUpdate = false;
        mesh.userData.expressId = flatMesh.expressID;
        mesh.userData.geometryExpressId = placed.geometryExpressID;
        element.add(mesh);
        placementCount += 1;
      }
      if (element.children.length > 0) {
        root.add(element);
        elementCount += 1;
      }
      onProgress?.({ completedMeshes: index + 1, totalMeshes: total });
    });
    if (root.children.length === 0) throw new Error('The IFC file opened, but no renderable element geometry was produced.');
    root.userData.elementCount = elementCount;
    root.userData.placementCount = placementCount;
    return { root, schema, elements: elementCount, placements: placementCount, geometryDefinitions: geometries.size };
  } catch (reason) {
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    throw reason;
  } finally {
    if (modelId >= 0) api.CloseModel(modelId);
    api.Dispose();
  }
}
