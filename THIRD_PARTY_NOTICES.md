# Third-party notices

Modern 3D Workbench does not import or redistribute Online3DViewer. The application
uses Three.js and other focused packages listed in `package.json`.
Their licenses remain with their respective authors.

The independent `.bim` parser follows the public DotBIM 1.0/1.1 file-format
specification maintained at https://github.com/paireks/dotbim (MIT). It does
not import the DotBIM reference libraries or Online3DViewer parser code.

## Browser runtimes distributed with the demo

To keep private model bytes away from third-party CDNs, the following
version-pinned browser runtimes are copied from npm packages into
`public/runtime` and served from the same origin as the application:

| Runtime | Version | Source | License | Distributed notice |
| --- | --- | --- | --- | --- |
| occt-import-js | 0.0.22 | https://github.com/kovacsv/occt-import-js | LGPL-2.1, plus OCCT notices | `public/runtime/occt/license.*.txt` |
| rhino3dm | 8.17.0 | https://github.com/mcneel/rhino3dm | MIT | `public/runtime/rhino3dm/LICENSE` |
| web-ifc | 0.0.77 | https://github.com/ThatOpen/engine_web-ifc | MPL-2.0 | Built output `runtime/web-ifc/LICENSE.md` |

`public/runtime/SHA256SUMS` records the reviewed runtime payloads. The strict
Content Security Policy only permits executable scripts and workers from the
demo origin; changing a runtime is therefore an explicit repository change.
