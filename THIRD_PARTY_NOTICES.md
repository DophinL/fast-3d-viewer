# Third-party notices

Fast 3D Viewer does not import or redistribute Online3DViewer. The application
uses Three.js and other focused packages listed in `package.json`.
Their licenses remain with their respective authors.

## Browser runtimes distributed with the demo

To keep private model bytes away from third-party CDNs, the following
version-pinned browser runtimes are copied from npm packages into
`public/runtime` and served from the same origin as the application:

| Runtime | Version | Source | License | Distributed notice |
| --- | --- | --- | --- | --- |
| occt-import-js | 0.0.22 | https://github.com/kovacsv/occt-import-js | LGPL-2.1, plus OCCT notices | `public/runtime/occt/license.*.txt` |
| rhino3dm | 8.17.0 | https://github.com/mcneel/rhino3dm | MIT | `public/runtime/rhino3dm/LICENSE` |

`public/runtime/SHA256SUMS` records the reviewed runtime payloads. The strict
Content Security Policy only permits executable scripts and workers from the
demo origin; changing a runtime is therefore an explicit repository change.
