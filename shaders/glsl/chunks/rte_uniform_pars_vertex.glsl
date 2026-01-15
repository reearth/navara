// RTE (Relative-To-Eye) Parameter Declarations for Uniforms
//
// This chunk declares uniforms needed for GPU RTE rendering when position
// is passed as uniforms rather than attributes (e.g., for Sprites, single-point geometries, or GLTF models).
// It should be included in the vertex shader before the main() function.
//
// Difference from rte_pars_vertex.glsl:
// - Uses uniforms (rtePosHigh/rtePosLow) instead of attributes (position_3d_high/position_3d_low)
// - Suitable for Sprite, single-vertex geometries, and GLTF models

// Camera position encoded as high/low components
uniform vec3 u_cameraPositionHigh;
uniform vec3 u_cameraPositionLow;

// Model-view matrix with translation zeroed out (rotation only)
uniform mat4 modelViewMatrixRTE;

// Vertex position encoded as high/low components (passed as uniforms)
uniform vec3 rtePosHigh;
uniform vec3 rtePosLow;
