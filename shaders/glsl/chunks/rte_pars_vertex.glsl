// RTE (Relative-To-Eye) Parameter Declarations
//
// This chunk declares uniforms and attributes needed for GPU RTE rendering.
// It should be included in the vertex shader before the main() function.

// Camera position encoded as high/low components
uniform vec3 u_cameraPositionHigh;
uniform vec3 u_cameraPositionLow;

// Always 1.0. Multiplying the high-order difference by a uniform the compiler
// cannot constant-fold blocks fast-math reassociation of
// (high - camHigh) + (low - camLow) into (high + low) - (camHigh + camLow),
// which would collapse the math to absolute-ECEF f32 precision and make
// geometry freeze/snap in ~0.25-0.5 m steps as the camera moves
// (observed on ANGLE Metal).
uniform float u_rteOne;

// Model-view matrix with translation zeroed out (rotation only)
uniform mat4 modelViewMatrixRTE;

// Vertex position encoded as high/low components
// These replace the standard 'position' attribute
attribute vec3 position_3d_high;
attribute vec3 position_3d_low;
