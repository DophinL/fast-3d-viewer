# Security policy

## Supported version

Security fixes are applied to the current `main` branch and latest tagged release.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository. Do not open a public issue for an archive traversal, parser crash with security impact, cross-origin data leak, or dependency vulnerability with a working exploit.

Include the smallest possible reproduction, affected browser and operating system, expected impact, and whether the model can be shared privately.

## Untrusted model files

3D files are complex untrusted input. Fast 3D Viewer applies several boundaries, but it is not a malware sandbox:

- ZIP paths are normalized and absolute or parent-traversal entries are rejected.
- Archive expansion has file-count and expanded-size limits.
- Diagnostics run in a Web Worker and stop above the interactive geometry budget.
- The app does not upload local model contents.
- URL imports obey browser CORS and mixed-content rules.

The OpenCascade and Rhino runtimes are served from the same static origin, while the direct glTF Draco decoder is copied from the pinned Three.js dependency at build time. Reviewed CAD payloads and checksums live under `public/runtime`; model parsing does not fetch executable code from a third-party CDN.

Browser parsers, image decoders, WebAssembly CAD kernels, and GPU drivers remain part of the attack surface. Keep the browser updated and do not open suspicious files on a sensitive workstation.

## Privacy boundary

Local selections are read through browser File APIs. The published application has no model-upload endpoint. Hosting providers still receive ordinary page requests, and remote URL imports contact the origin supplied by the user.
