import { Buffer } from 'node:buffer';

export type MinimalVrmVersion = '0.x' | '1.0';

const boneNames = [
  'hips',
  'spine',
  'head',
  'leftUpperLeg',
  'leftLowerLeg',
  'leftFoot',
  'rightUpperLeg',
  'rightLowerLeg',
  'rightFoot',
  'leftUpperArm',
  'leftLowerArm',
  'leftHand',
  'rightUpperArm',
  'rightLowerArm',
  'rightHand',
] as const;

function padChunk(bytes: Buffer, fill = 0): Buffer {
  const padding = (4 - bytes.byteLength % 4) % 4;
  return padding ? Buffer.concat([bytes, Buffer.alloc(padding, fill)]) : bytes;
}

function toGlb(json: Record<string, unknown>, binary: Buffer): Buffer {
  const jsonChunk = padChunk(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const binaryChunk = padChunk(binary);
  const totalLength = 12 + 8 + jsonChunk.byteLength + 8 + binaryChunk.byteLength;
  const output = Buffer.alloc(totalLength);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);
  output.writeUInt32LE(jsonChunk.byteLength, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  jsonChunk.copy(output, 20);
  const binaryHeader = 20 + jsonChunk.byteLength;
  output.writeUInt32LE(binaryChunk.byteLength, binaryHeader);
  output.writeUInt32LE(0x004e4942, binaryHeader + 4);
  binaryChunk.copy(output, binaryHeader + 8);
  return output;
}

export function createMinimalVrm(version: MinimalVrmVersion): Buffer {
  const binary = Buffer.alloc(44);
  Buffer.from(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0, 1, 0]).buffer).copy(binary, 0);
  Buffer.from(new Uint16Array([0, 1, 2]).buffer).copy(binary, 36);

  const nodes: Array<Record<string, unknown>> = [
    { name: 'Avatar mesh', mesh: 0, children: [1] },
    { name: 'hips', translation: [0, 0.9, 0], children: [2, 4, 7] },
    { name: 'spine', translation: [0, 0.35, 0], children: [3, 10, 13] },
    { name: 'head', translation: [0, 0.55, 0] },
    { name: 'leftUpperLeg', translation: [0.16, -0.12, 0], children: [5] },
    { name: 'leftLowerLeg', translation: [0, -0.45, 0], children: [6] },
    { name: 'leftFoot', translation: [0, -0.42, 0.08] },
    { name: 'rightUpperLeg', translation: [-0.16, -0.12, 0], children: [8] },
    { name: 'rightLowerLeg', translation: [0, -0.45, 0], children: [9] },
    { name: 'rightFoot', translation: [0, -0.42, 0.08] },
    { name: 'leftUpperArm', translation: [0.28, 0.38, 0], children: [11] },
    { name: 'leftLowerArm', translation: [0.38, 0, 0], children: [12] },
    { name: 'leftHand', translation: [0.32, 0, 0] },
    { name: 'rightUpperArm', translation: [-0.28, 0.38, 0], children: [14] },
    { name: 'rightLowerArm', translation: [-0.38, 0, 0], children: [15] },
    { name: 'rightHand', translation: [-0.32, 0, 0] },
  ];
  const humanBones = Object.fromEntries(boneNames.map((name, index) => [name, { node: index + 1 }]));
  const vrmExtension = version === '1.0'
    ? {
        specVersion: '1.0',
        meta: {
          name: 'Minimal VRM Avatar',
          version: '1.0',
          authors: ['Fast 3D Viewer'],
          licenseUrl: 'https://vrm.dev/licenses/1.0/',
          avatarPermission: 'onlyAuthor',
          commercialUsage: 'personalNonProfit',
          creditNotation: 'required',
          allowRedistribution: false,
          modification: 'prohibited',
        },
        humanoid: { humanBones },
        expressions: { preset: { happy: { isBinary: false } } },
      }
    : {
        exporterVersion: 'Fast 3D Viewer fixture',
        specVersion: '0.0',
        meta: {
          title: 'Minimal VRM 0 Avatar',
          version: '1.0',
          author: 'Fast 3D Viewer',
          allowedUserName: 'OnlyAuthor',
          violentUssageName: 'Disallow',
          sexualUssageName: 'Disallow',
          commercialUssageName: 'Disallow',
          licenseName: 'CC0',
        },
        humanoid: {
          humanBones: boneNames.map((bone, index) => ({ bone, node: index + 1, useDefaultValues: true })),
        },
        firstPerson: {
          firstPersonBone: 3,
          firstPersonBoneOffset: { x: 0, y: 0.06, z: 0 },
          lookAtTypeName: 'Bone',
          lookAtHorizontalInner: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 10 },
          lookAtHorizontalOuter: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 10 },
          lookAtVerticalDown: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 10 },
          lookAtVerticalUp: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 10 },
        },
        blendShapeMaster: { blendShapeGroups: [] },
        secondaryAnimation: { boneGroups: [], colliderGroups: [] },
        materialProperties: [],
      };

  const extensionName = version === '1.0' ? 'VRMC_vrm' : 'VRM';
  return toGlb({
    asset: { version: '2.0', generator: 'Fast 3D Viewer VRM regression fixture' },
    buffers: [{ byteLength: binary.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-0.5, 0, 0], max: [0.5, 1, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    materials: [{ name: 'Avatar material', pbrMetallicRoughness: { baseColorFactor: [0.35, 0.65, 0.9, 1], roughnessFactor: 0.72 } }],
    meshes: [{ name: 'Avatar body', primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    nodes,
    scenes: [{ name: 'Avatar scene', nodes: [0] }],
    scene: 0,
    extensionsUsed: [extensionName],
    extensions: { [extensionName]: vrmExtension },
  }, binary);
}

export function createGlbWithoutVrmExtension(): Buffer {
  const binary = Buffer.alloc(44);
  Buffer.from(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0, 1, 0]).buffer).copy(binary, 0);
  Buffer.from(new Uint16Array([0, 1, 2]).buffer).copy(binary, 36);
  return toGlb({
    asset: { version: '2.0', generator: 'Fast 3D Viewer invalid VRM fixture' },
    buffers: [{ byteLength: binary.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-0.5, 0, 0], max: [0.5, 1, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  }, binary);
}
