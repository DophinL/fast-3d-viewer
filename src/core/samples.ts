const SAMPLE_STL = `solid calibration_part
facet normal 0 0 -1
 outer loop
  vertex -1 -1 0
  vertex 1 1 0
  vertex 1 -1 0
 endloop
endfacet
facet normal 0 0 -1
 outer loop
  vertex -1 -1 0
  vertex -1 1 0
  vertex 1 1 0
 endloop
endfacet
facet normal 0 -1 0.6
 outer loop
  vertex -1 -1 0
  vertex 1 -1 0
  vertex 0 0 1.7
 endloop
endfacet
facet normal 1 0 0.6
 outer loop
  vertex 1 -1 0
  vertex 1 1 0
  vertex 0 0 1.7
 endloop
endfacet
facet normal 0 1 0.6
 outer loop
  vertex 1 1 0
  vertex -1 1 0
  vertex 0 0 1.7
 endloop
endfacet
facet normal -1 0 0.6
 outer loop
  vertex -1 1 0
  vertex -1 -1 0
  vertex 0 0 1.7
 endloop
endfacet
endsolid calibration_part`;

export function createCalibrationSample(): File {
  return new File([SAMPLE_STL], 'fast-viewer-calibration.stl', { type: 'model/stl', lastModified: Date.now() });
}
