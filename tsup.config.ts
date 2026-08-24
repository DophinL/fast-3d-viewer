import { defineConfig } from 'tsup';

const shared = {
  tsconfig: 'tsconfig.app.json',
  target: 'es2022',
  sourcemap: true,
  minify: false,
  treeshake: true,
  splitting: false,
  dts: true,
  clean: true,
};

export default defineConfig([
  {
    ...shared,
    entry: { index: 'packages/core/src/index.ts' },
    outDir: 'packages/core/dist',
    format: ['esm', 'cjs'],
    external: ['three'],
  },
  {
    ...shared,
    entry: { index: 'packages/react/src/index.tsx' },
    outDir: 'packages/react/dist',
    format: ['esm', 'cjs'],
    external: ['react', 'react-dom', 'three', '@fast-3d-viewer/core'],
  },
  {
    ...shared,
    entry: { index: 'packages/web-component/src/index.ts' },
    outDir: 'packages/web-component/dist',
    format: ['esm'],
    external: ['three', '@fast-3d-viewer/core'],
  },
]);
