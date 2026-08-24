# Viewer benchmark protocol

The product name is **Modern 3D Workbench**. The repository keeps the historical `fast-3d-viewer` slug, but speed is treated as a measured property rather than a marketing fact.

## What the public harness measures

The `/benchmark/` page currently measures three CPU-side boundaries:

1. Parsing a deterministic 50,000-triangle binary STL.
2. Parsing a deterministic 15,000-triangle ASCII OBJ.
3. Parsing and assembling 2,500 transformed DotBIM elements.

Each case runs two warm-up iterations that are discarded, followed by seven measured iterations. The exported report retains every raw sample plus median, p95, minimum, maximum, fixture description, browser environment, and protocol version.

It deliberately does **not** fold network transfer, React startup, GPU upload, shader compilation, or first-frame rendering into the parser number. Those require separate boundaries and hardware-backed WebGL measurements.

## Run locally

```bash
npm run benchmark:viewer
```

The command reuses an existing target when one is reachable. Otherwise it starts a loopback-only Vite server, waits for readiness, runs the benchmark, saves `.gstack/benchmark-reports/latest-viewer-benchmark.json`, and stops the server. Pass `--url` and `--output` to override those defaults. A non-local URL must already be reachable; the runner never starts or changes a remote service. The browser page can also run and export the same JSON interactively.

## Competitor comparisons

A valid comparison with Online3DViewer or another viewer must use:

- the same source fixture bytes;
- the same browser build, device, thermal state, and fresh profile;
- the same start boundary and end boundary;
- at least two discarded warm-ups and seven retained runs;
- raw samples, not only the best result;
- separate results for parsing, scene assembly, GPU upload, first frame, and orbit interaction.

The repository does not publish a “faster than Online3DViewer” conclusion until the competitor can be instrumented at equivalent boundaries. A homepage load number and a model parse number are not interchangeable.
