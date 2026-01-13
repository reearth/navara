// RTE (Relative-To-Eye) Position Decoding for Uniforms
//
// This chunk decodes RTE-encoded positions (passed as uniforms) into camera-relative coordinates.
// It should be included in the vertex shader within the main() function,
// before any position transformations.
//
// Difference from rte_vertex.glsl:
// - Uses uniforms instead of attributes
// - Suitable for Sprite and single-vertex geometries
//

vec3 absTransformed = rtePosHigh + rtePosLow; // Absolute world position
vec3 highDiff = rtePosHigh - u_cameraPositionHigh;
vec3 lowDiff = rtePosLow - u_cameraPositionLow;
vec3 transformed = highDiff + lowDiff; // Camera-relative position
