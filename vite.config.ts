import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ViteDevServer } from 'vite';

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

function localWebIfcRuntime() {
  const runtimeFiles = ['web-ifc.wasm', 'web-ifc-mt.wasm', 'LICENSE.md'];
  return {
    name: 'local-web-ifc-runtime',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/runtime/web-ifc', (request, response, next) => {
        const file = request.url?.split('?', 1)[0]?.replace(/^\//, '');
        if (!file || !runtimeFiles.includes(file)) return next();
        response.statusCode = 200;
        response.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'text/markdown; charset=utf-8');
        response.end(readFileSync(resolve('node_modules/web-ifc', file)));
      });
    },
    closeBundle() {
      const output = resolve('dist/runtime/web-ifc');
      mkdirSync(output, { recursive: true });
      for (const file of runtimeFiles) cpSync(resolve('node_modules/web-ifc', file), resolve(output, file));
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), localDracoDecoders(), localWebIfcRuntime()],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        home: resolve('index.html'),
        stlViewer: resolve('stl-viewer/index.html'),
        glbViewer: resolve('glb-viewer/index.html'),
        objViewer: resolve('obj-viewer/index.html'),
        stepFileViewer: resolve('step-file-viewer/index.html'),
        vrmViewer: resolve('vrm-viewer/index.html'),
        embed: resolve('embed/index.html'),
        benchmark: resolve('benchmark/index.html'),
      },
    },
  },
  worker: { format: 'es' },
});
