# Testing Modern 3D Workbench

Tests make fast iteration safe. The project aims for full coverage of format
routing, package handling, geometry inspection, diagnostics, repair, export,
and the browser workflows users depend on.

## Commands

- `npm test` runs the Vitest unit suite.
- `npm run test:e2e` runs Playwright in desktop Chromium and mobile Chrome.
- `npm run typecheck` verifies strict TypeScript contracts.
- `npm run lint` runs ESLint.
- `npm run check` runs typecheck, lint, unit tests, and the production build.

## Layers

- Unit tests live in `tests/unit/*.test.ts`. Prefer real Three.js geometry and
  explicit behavior assertions over broad snapshots.
- Browser tests live in `tests/e2e/*.spec.ts`. They open a real WebGL context,
  complete an upload flow, and assert user-visible outcomes.
- Every bug fix should add a regression test when the failing behavior can be
  reproduced outside pure CSS.
- Large proprietary models do not belong in git. Generate compact fixtures or
  use permissively licensed samples with attribution.

## Conventions

Use `describe` to name a subsystem and `it` to state the observable behavior.
Tests must exercise success, empty/error, and boundary branches for new logic.
