import { describe, expect, it } from 'vitest';
import { FORMAT_DEFINITIONS, SUPPORTED_EXTENSIONS, findFormat, getAcceptValue, getExtension, isSupportedFile } from '../../src/core/formats';

describe('format registry', () => {
  it('resolves aliases without inflating format-family claims', () => {
    expect(FORMAT_DEFINITIONS).toHaveLength(27);
    expect(findFormat('assembly.STEP')?.id).toBe('step');
    expect(findFormat('part.stp')?.id).toBe('step');
    expect(findFormat('scene.glb')?.id).toBe('gltf');
    expect(findFormat('drawing.unknown')).toBeUndefined();
  });

  it('publishes unique supported extensions and ZIP as a package transport', () => {
    expect(SUPPORTED_EXTENSIONS).toHaveLength(36);
    expect(new Set(SUPPORTED_EXTENSIONS).size).toBe(SUPPORTED_EXTENSIONS.length);
    expect(getAcceptValue()).toContain('.glb');
    expect(getAcceptValue()).toContain('.zip');
    expect(isSupportedFile('complete-package.zip')).toBe(true);
    expect(isSupportedFile('texture.png')).toBe(false);
  });

  it('handles query strings, fragments, uppercase, and extensionless names', () => {
    expect(getExtension('https://cdn.test/model.GLB?download=1#preview')).toBe('glb');
    expect(getExtension('README')).toBe('');
    expect(getExtension('.hidden')).toBe('hidden');
  });
});
