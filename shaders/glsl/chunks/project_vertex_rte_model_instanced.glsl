// RTE (Relative-To-Eye) Projection for INSTANCED GLTF Models
//
// Same contract as project_vertex_rte_model.glsl, but additionally applies the
// per-instance `instanceMatrix` that Three.js injects for InstancedMesh. The
// standard #include <project_vertex> handles USE_INSTANCING implicitly; when
// we replace that chunk with an RTE variant, we must preserve that behavior.
//
// The 'transformed' variable already contains local position after morph
// targets, skinning, and displacement.

// Camera-relative model center offset (high-precision)
vec3 modelHighDiff = rtePosHigh - u_cameraPositionHigh;
vec3 modelLowDiff = rtePosLow - u_cameraPositionLow;
vec3 modelCenterOffset = modelHighDiff + modelLowDiff;

// Apply per-instance + model transforms in view space
mat4 modelViewMatrixRTE_Local = modelViewMatrixRTE * modelMatrix;
#ifdef USE_INSTANCING
modelViewMatrixRTE_Local = modelViewMatrixRTE_Local * instanceMatrix;
#endif

vec4 mvLocalPosition = modelViewMatrixRTE_Local * vec4(transformed, 1.0);

vec4 mvCenterOffset = modelViewMatrixRTE * vec4(modelCenterOffset, 0.0);
vec4 mvPosition = mvLocalPosition + mvCenterOffset;

gl_Position = projectionMatrix * mvPosition;

// Absolute world position for downstream chunks that need it
#ifdef USE_INSTANCING
vec3 rotatedScaledLocal = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
vec3 rotatedScaledLocal = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
vec3 absTransformed = (rtePosHigh + rtePosLow) + rotatedScaledLocal;
