import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function localDracoDecoders() {
  return {
    name: 'local-draco-decoders',
    closeBundle() {
      const source = resolve('node_modules/three/examples/jsm/libs/draco/gltf');
      const output = resolve('dist/draco');
      mkdirSync(output, { recursive: true });
      for (const file of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) {
        cpSync(resolve(source, file), resolve(output, file));
      }
    },
  };
}

function localizeCompatibilityRuntimes() {
  const runtimeUrls = [
    ['https://cdn.jsdelivr.net/npm/rhino3dm@8.17.0/rhino3dm.min.js', "new URL('runtime/rhino3dm/rhino3dm.min.js', document.baseURI).toString()"],
    ['https://cdn.jsdelivr.net/npm/web-ifc@0.0.68/web-ifc-api-iife.js', "new URL('runtime/web-ifc/web-ifc-api-iife.js', document.baseURI).toString()"],
    ['https://cdn.jsdelivr.net/npm/draco3d@1.5.7/draco_decoder_nodejs.min.js', "new URL('runtime/draco3d/draco_decoder_nodejs.js', document.baseURI).toString()"],
  ] as const;
  return {
    name: 'localize-online-3d-viewer-runtimes',
    enforce: 'pre' as const,
    transform(source: string, id: string) {
      if (!id.includes('/online-3d-viewer/build/engine/o3dv.module.js')) return null;
      let output = source;
      const workerStart = output.indexOf('let occtWorkerUrl = null;');
      const workerEnd = output.indexOf('function LoadExternalLibrary (libraryName)');
      if (workerStart < 0 || workerEnd < 0 || workerEnd <= workerStart) {
        throw new Error('Online3DViewer OCCT worker bootstrap changed.');
      }
      output = `${output.slice(0, workerStart)}let occtWorkerUrl = new URL('runtime/occt/occt-import-js-worker.js', document.baseURI).toString();\n\nfunction CreateOcctWorker ()\n{\n\treturn Promise.resolve (new Worker (occtWorkerUrl));\n}\n\n${output.slice(workerEnd)}`;
      for (const [remote, localExpression] of runtimeUrls) {
        const quotedRemote = `'${remote}'`;
        if (!output.includes(quotedRemote)) throw new Error(`Online3DViewer runtime URL changed: ${remote}`);
        output = output.split(quotedRemote).join(localExpression);
      }
      return { code: output, map: null };
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), localizeCompatibilityRuntimes(), localDracoDecoders()],
  optimizeDeps: { exclude: ['online-3d-viewer'] },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  worker: { format: 'es' },
});
