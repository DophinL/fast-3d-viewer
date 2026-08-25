# `@fast-3d-viewer/core`

The browser SDK behind **Modern 3D Workbench**. It exposes the independent viewer engine, model-loading pipeline, orientation controls, measurements, annotations, clipping, snapshots, and camera/view state.

```ts
import { Modern3DViewer } from '@fast-3d-viewer/core';

const viewer = new Modern3DViewer(document.querySelector('#viewer')!);
viewer.on('progress', console.log);
await viewer.openUrl('https://assets.example.com/model.glb');
viewer.fitToView();
```

Version 0.3.0 supports extracted multi-file packages and VRM 0.x/1.0 avatars. ZIP loading in the SDK still requires a separately hosted archive worker; the full workbench application already includes that worker.

VRM loads return typed `asset.avatar` metadata. Advanced integrations can access the focused VRM runtime without coupling the general viewer API to avatar controls:

```ts
import { getVrmAvatar } from '@fast-3d-viewer/core';

const asset = await viewer.openUrl('https://assets.example.com/avatar.vrm');
const avatar = getVrmAvatar(asset.root);
avatar?.expressionManager?.setValue('happy', 1);
```

The viewer engine calls `avatar.update(delta)` while the model is mounted, so humanoid normalization, expressions, constraints, materials, and spring bones stay current.

## Runtime assets

The SDK deliberately keeps large decoders out of the JavaScript entry. Applications that enable these formats must publish the matching files on their own origin:

| URL | Source |
| --- | --- |
| `/runtime/web-ifc/web-ifc.wasm` and `/runtime/web-ifc/web-ifc-mt.wasm` | `web-ifc` package root |
| `/runtime/occt/*` | the version-pinned `occt-import-js` browser runtime |
| `/runtime/rhino3dm/*` | `rhino3dm` package runtime |
| `/draco/*` | Three.js Draco decoder directory |

The repository's Vite build copies and serves these paths automatically. A consuming application must make the equivalent copy in its own build or public-assets step. Keep the dependency versions aligned with the package lock; do not replace the paths with third-party CDN scripts for private-model workflows.
