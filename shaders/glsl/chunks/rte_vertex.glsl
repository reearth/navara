// RTE (Relative-To-Eye) Position Decoding
//
// This chunk decodes RTE-encoded positions into camera-relative coordinates.
// It should be included in the vertex shader within the main() function,
// before any position transformations.
//
// The result is a high-precision camera-relative position stored in the
// 'transformed' variable, which replaces the standard position.

vec3 transformed = transform_position_rte();
