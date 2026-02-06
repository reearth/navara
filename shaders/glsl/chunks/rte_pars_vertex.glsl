// RTE (Relative-To-Eye) Parameter Declarations
//
// This chunk declares uniforms and attributes needed for GPU RTE rendering.
// It should be included in the vertex shader before the main() function.

// Camera position encoded as high/low components
uniform vec3 u_cameraPositionHigh;
uniform vec3 u_cameraPositionLow;

// Model-view matrix with translation zeroed out (rotation only)
uniform mat4 modelViewMatrixRTE;

// Vertex position encoded as high/low components
// These replace the standard 'position' attribute
attribute vec3 position_3d_high;
attribute vec3 position_3d_low;
