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

export default defineConfig({
  base: './',
  plugins: [react(), localDracoDecoders()],
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('vendor/online3dviewer/source/engine')) return 'cad-engine';
          if (id.includes('three/examples/jsm/loaders')) return 'extra-loaders';
          if (id.includes('three')) return 'three-core';
          return undefined;
        },
      },
    },
  },
  worker: { format: 'es' },
});
