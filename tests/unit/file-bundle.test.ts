import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { createFileBundle } from '../../src/core/file-bundle';

describe('file bundle', () => {
  it('chooses a portable scene as main file while retaining companions', async () => {
    const bundle = await createFileBundle([
      new File(['newmtl body'], 'body.mtl'),
      new File(['o body'], 'body.obj'),
      new File([new Uint8Array([1, 2, 3])], 'preview.glb'),
      new File([new Uint8Array([4, 5])], 'albedo.png'),
    ]);

    expect(bundle.mainFile.name).toBe('preview.glb');
    expect(bundle.entries).toHaveLength(4);
    expect(bundle.totalBytes).toBeGreaterThan(0);
  });

  it('unpacks ZIP archives, normalizes paths, and preserves model packages', async () => {
    const archive = zipSync({
      'package/scene.gltf': new TextEncoder().encode('{"asset":{"version":"2.0"}}'),
      'package/scene.bin': new Uint8Array([1, 2, 3, 4]),
      'package/textures/base color.png': new Uint8Array([5, 6]),
      '../unsafe.txt': new TextEncoder().encode('ignored traversal segment'),
    });
    const bundle = await createFileBundle([new File([archive], 'model.zip')]);

    expect(bundle.archiveName).toBe('model.zip');
    expect(bundle.mainFile.name).toBe('scene.gltf');
    expect(bundle.entries.some((entry) => entry.normalizedPath === 'package/scene.bin')).toBe(true);
    expect(bundle.entries.every((entry) => !entry.normalizedPath.includes('..'))).toBe(true);
  });

  it('rejects packages containing only companion files', async () => {
    await expect(createFileBundle([
      new File(['newmtl body'], 'body.mtl'),
      new File([new Uint8Array([1])], 'texture.png'),
    ])).rejects.toThrow('No supported 3D file');
  });
});
