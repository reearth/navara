// RTE (Relative-To-Eye) Projection
//
// This chunk performs the projection transformation for RTE-encoded positions.
// It replaces Three.js's standard `#include <project_vertex>` which uses
// modelViewMatrix (including translation), with modelViewMatrixRTE (rotation only).
//
// This should be used in place of `#include <project_vertex>` in the vertex shader
// after RTE position decoding has been performed.
//
// The 'transformed' variable should already contain the camera-relative position
// from RTE computation before this chunk is included.

// Use modelViewMatrixRTE (rotation only) instead of modelViewMatrix
// because 'transformed' is already camera-relative from RTE computation
vec4 mvPosition = modelViewMatrixRTE * vec4(transformed, 1.0);
gl_Position = projectionMatrix * mvPosition;

vec4 absMvPosition = modelViewMatrix * vec4(absTransformed, 1.0);
vec4 absProjectedPosition = projectionMatrix * absMvPosition;
