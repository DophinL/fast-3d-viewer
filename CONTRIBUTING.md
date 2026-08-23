# Contributing

Thanks for improving Fast 3D Viewer. Small, reproducible changes are easier to review and safer for people opening untrusted files.

## Development setup

Use Node.js 24 and npm.

```bash
npm ci
npm run dev
```

Before opening a pull request, run:

```bash
npm run check
npx playwright install chromium
npm run test:e2e
```

## Format bugs

Include:

1. The exact extension and whether the model is a single file, directory, or ZIP.
2. Browser, operating system, and whether hardware acceleration is enabled.
3. The first visible error and relevant console message.
4. A minimal file you own and can redistribute under a permissive license.
5. The expected preserved data: geometry, hierarchy, materials, textures, animation, metadata, or units.

Do not upload confidential customer models to a public issue.

## Adding an importer

An importer is not complete when one sample renders. A contribution should:

- register the extension and capability facts in `src/core/formats.ts`;
- implement a lazy-loaded branch in `src/core/load-model.ts`;
- preserve companion-file resolution when the format can reference external data;
- normalize the output into a Three.js `Object3D`;
- include a licensed, intentionally small fixture;
- add unit coverage and a Playwright success path;
- document unsupported variants and semantic loss;
- avoid putting parser code in the initial JavaScript chunk.

If a mature parser already exists in the vendored Online3DViewer backend, prefer using it over adding a second large dependency.

## Repair changes

Repair must remain non-destructive. The original asset cannot be overwritten, and the result must be presented as a new working copy. Geometry algorithms require tests for:

- closed manifold input;
- one simple boundary loop;
- non-manifold edges;
- duplicate and reversed faces;
- zero-area triangles;
- transformed child meshes;
- stable face orientation and volume sign.

State the algorithmic complexity and interactive limit for expensive operations.

## Interface changes

The viewport is the primary work surface. Check at least 1440 x 1000 and 390 x 844. Controls may scroll on narrow screens, but core camera, open, health, and export actions must remain reachable. Always test the WebGL-unavailable state.

## Commits and pull requests

Use focused conventional commit messages such as:

```text
feat(import): add binary PCD support
fix(repair): retain winding when filling a hole
test(viewer): cover mobile frame control
docs(formats): clarify IFC semantic loss
```

Describe the user-visible outcome, validation performed, fixture license, and remaining limitations in the pull request.

