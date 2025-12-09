// RTE (Relative-To-Eye) Parameter Declarations for GLTF Models
//
// This chunk declares uniforms needed for GPU RTE rendering of GLTF models.
// Unlike polygon RTE which encodes each vertex, model RTE encodes the model's
// center position and keeps vertices in local space.
//
// It should be included in the vertex shader before the main() function.

// Camera position encoded as high/low components
uniform vec3 u_cameraPositionHigh;
uniform vec3 u_cameraPositionLow;

// Model center position encoded as high/low components
uniform vec3 u_modelPositionHigh;
uniform vec3 u_modelPositionLow;

// View matrix with translation zeroed out (rotation only)
uniform mat4 viewMatrixRTE;
