# Third-party notices

Fast 3D Viewer uses the MIT-licensed `online-3d-viewer` 0.18.0 npm package as a
compatibility importer for selected CAD, BIM, and legacy formats. Upstream source
is not vendored in the current repository tree. The application, viewer runtime,
diagnostics, repair workflow, export workflow, and interface are independently
implemented in this repository.

The application also uses Three.js and other packages listed in `package.json`.
Their licenses remain with their respective authors.

## Browser runtimes distributed with the demo

To keep private model bytes away from third-party CDNs, the following
version-pinned browser runtimes are copied from npm packages into
`public/runtime` and served from the same origin as the application:

| Runtime | Version | Source | License | Distributed notice |
| --- | --- | --- | --- | --- |
| occt-import-js | 0.0.22 | https://github.com/kovacsv/occt-import-js | LGPL-2.1, plus OCCT notices | `public/runtime/occt/license.*.txt` |
| rhino3dm | 8.17.0 | https://github.com/mcneel/rhino3dm | MIT | `public/runtime/rhino3dm/LICENSE` |
| web-ifc | 0.0.68 | https://github.com/ThatOpen/engine_web-ifc | MPL-2.0 | `public/runtime/web-ifc/LICENSE.md` |
| Draco | 1.5.7 | https://github.com/google/draco | Apache-2.0 | `public/runtime/draco3d/LICENSE` |

`public/runtime/SHA256SUMS` records the reviewed runtime payloads. The strict
Content Security Policy only permits executable scripts and workers from the
demo origin; changing a runtime is therefore an explicit repository change.
