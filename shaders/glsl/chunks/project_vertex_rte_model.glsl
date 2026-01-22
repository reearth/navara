// RTE (Relative-To-Eye) Projection for GLTF Models
//
// This chunk performs the projection transformation for RTE-encoded GLTF models.
// It replaces Three.js's standard #include <project_vertex>.
//
// The 'transformed' variable should already contain the local position after
// morph targets, skinning, and displacement have been applied.
//
// This approach maintains precision by:
// 1. Applying model transforms to small local coordinates first
// 2. Adding the high-precision camera-relative offset in view space
// 3. Keeping all intermediate values in manageable ranges

// Calculate camera-relative model center offset (high-precision)
vec3 modelHighDiff = rtePosHigh - u_cameraPositionHigh;
vec3 modelLowDiff = rtePosLow - u_cameraPositionLow;
vec3 modelCenterOffset = modelHighDiff + modelLowDiff;

// Apply model's rotation and scale in view space to maintain precision
// modelMatrix has translation=0 in RTE mode, only contains rotation/scale
mat4 modelViewMatrixRTE_Local = modelViewMatrixRTE * modelMatrix;

// Transform local position (small coordinates) to view space
vec4 mvLocalPosition = modelViewMatrixRTE_Local * vec4(transformed, 1.0);

// Add model center offset in view space (after view rotation)
vec4 mvCenterOffset = modelViewMatrixRTE * vec4(modelCenterOffset, 0.0);
vec4 mvPosition = mvLocalPosition + mvCenterOffset;

// Final projection
gl_Position = projectionMatrix * mvPosition;

// Calculate absolute world position for effects that need it (transmission, etc)
vec3 rotatedScaledLocal = (modelMatrix * vec4(transformed, 1.0)).xyz;
vec3 absTransformed = (rtePosHigh + rtePosLow) + rotatedScaledLocal;
