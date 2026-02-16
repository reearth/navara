// RTE (Relative-To-Eye) Position Decoding
//
// This chunk decodes RTE-encoded positions into camera-relative coordinates.
// It should be included in the vertex shader within the main() function,
// before any position transformations.
//
// The result is a high-precision camera-relative position stored in the
// 'transformed' variable, which replaces the standard position.
//
// NOTE: This code is intentionally inlined rather than using transform_position_rte()
// function call. In some contexts (e.g., Points/SpherePoints), calling the function
// can cause vertex jittering due to GLSL compiler optimization or precision issues.
// Inlining the calculation directly avoids these problems.

vec3 highDiff = position_3d_high - u_cameraPositionHigh;
vec3 lowDiff = position_3d_low - u_cameraPositionLow;
vec3 transformed = highDiff + lowDiff;

vec3 absTransformed = position_3d_high + position_3d_low;
