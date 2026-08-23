import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
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
