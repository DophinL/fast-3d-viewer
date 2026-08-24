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
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  worker: { format: 'es' },
});
