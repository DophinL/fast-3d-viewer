# Third-party notices

Fast 3D Viewer builds on the MIT-licensed parser and conversion engine from
[Online3DViewer](https://github.com/kovacsv/Online3DViewer). The unmodified
upstream snapshot is kept in `vendor/online3dviewer`, including its original
license and history attribution through a git subtree merge.

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
