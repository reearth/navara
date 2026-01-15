/**
 * RTC (Relative-To-Center) sprite vertex positioning code snippet.
 * Transforms RTC local coordinates to view space while maintaining precision by avoiding
 * large world-space coordinates that cause floating-point precision loss.
 *
 * This approach directly computes model-view space coordinates using
 * modelViewMatrix * rtcPos, then reconstructs world position only when needed
 * for horizon culling and scale calculations.
 *
 * Prerequisites:
 * - Uniform 'rtcPos' (vec3) must be defined as local position relative to RTC center
 * - Function nvr_removeScaleFromMat4() must be available
 *
 * Outputs:
 * - posMv (vec4): View-space position of the sprite anchor
 * - absTransformed (vec3): Reconstructed world position for culling/scaling
 */

mat4 modelViewMatrixNoScale = nvr_removeScaleFromMat4(modelViewMatrix);
vec4 posMv = modelViewMatrixNoScale * vec4(rtcPos, 1.0);

// Reconstruct world position for horizon culling and scale calculation
mat3 viewRotation = mat3(viewMatrix);
vec3 absTransformed = transpose(viewRotation) * posMv.xyz + cameraPosition;