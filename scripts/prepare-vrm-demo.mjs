import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const SOURCE_URL = 'https://raw.githubusercontent.com/hirokazuniimoto/virtual-avatar-sdk/ab8f0d4d2ee5bdfa2321b7ac94bfbf4f0a6547eb/assets/avatars/AvatarSample_B.vrm';
const SOURCE_SHA256 = '7fca4a77fdc60ab2c78a9907430744562626180125fa386eb74fb2ea15c2e518';
const OUTPUT = resolve('public/demo/avatar-sample-b.vrm');
const MAX_TEXTURE_EDGE = 512;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

function align4(value) {
  return (value + 3) & ~3;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function readGlb(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) {
    throw new Error('The pinned avatar source is not a glTF 2.0 binary.');
  }
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== JSON_CHUNK) throw new Error('The avatar has no JSON chunk.');
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8').trimEnd());
  const binHeader = 20 + jsonLength;
  const binLength = bytes.readUInt32LE(binHeader);
  if (bytes.readUInt32LE(binHeader + 4) !== BIN_CHUNK) throw new Error('The avatar has no binary chunk.');
  return { json, binary: bytes.subarray(binHeader + 8, binHeader + 8 + binLength) };
}

async function optimizeImage(bytes, mimeType) {
  if (mimeType !== 'image/png' && mimeType !== 'image/jpeg') return bytes;
  const source = sharp(bytes, { failOn: 'warning' });
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height || Math.max(metadata.width, metadata.height) <= MAX_TEXTURE_EDGE) return bytes;
  const resized = source.resize({ width: MAX_TEXTURE_EDGE, height: MAX_TEXTURE_EDGE, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' });
  return mimeType === 'image/png'
    ? resized.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer()
    : resized.jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}

async function rebuildGlb(sourceBytes) {
  const { json, binary } = readGlb(sourceBytes);
  if (!Array.isArray(json.bufferViews) || !Array.isArray(json.images)) throw new Error('The avatar has no embedded image package.');
  const imageByBufferView = new Map(json.images
    .filter((image) => Number.isInteger(image.bufferView))
    .map((image) => [image.bufferView, image]));
  const chunks = [];
  let offset = 0;

  for (let index = 0; index < json.bufferViews.length; index += 1) {
    const view = json.bufferViews[index];
    if ((view.buffer ?? 0) !== 0) throw new Error('Only the primary GLB buffer can be optimized.');
    const start = view.byteOffset ?? 0;
    let content = Buffer.from(binary.subarray(start, start + view.byteLength));
    const image = imageByBufferView.get(index);
    if (image) content = await optimizeImage(content, image.mimeType);
    const paddedLength = align4(content.length);
    const padded = Buffer.alloc(paddedLength);
    content.copy(padded);
    view.byteOffset = offset;
    view.byteLength = content.length;
    chunks.push(padded);
    offset += paddedLength;
  }

  const packedBinary = Buffer.concat(chunks);
  json.buffers[0].byteLength = packedBinary.length;
  const jsonBytes = Buffer.from(JSON.stringify(json));
  const paddedJson = Buffer.alloc(align4(jsonBytes.length), 0x20);
  jsonBytes.copy(paddedJson);
  const output = Buffer.alloc(12 + 8 + paddedJson.length + 8 + packedBinary.length);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(paddedJson.length, 12);
  output.writeUInt32LE(JSON_CHUNK, 16);
  paddedJson.copy(output, 20);
  const binHeader = 20 + paddedJson.length;
  output.writeUInt32LE(packedBinary.length, binHeader);
  output.writeUInt32LE(BIN_CHUNK, binHeader + 4);
  packedBinary.copy(output, binHeader + 8);
  return output;
}

const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`Avatar download failed with HTTP ${response.status}.`);
const source = Buffer.from(await response.arrayBuffer());
if (sha256(source) !== SOURCE_SHA256) throw new Error('The pinned avatar checksum changed. Refusing to publish an unreviewed model.');
const optimized = await rebuildGlb(source);
await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, optimized);
console.log(JSON.stringify({ output: OUTPUT, sourceBytes: source.length, outputBytes: optimized.length, sha256: sha256(optimized) }, null, 2));
