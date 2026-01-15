/**
 * Horizon culling vertex shader code snippet.
 * Culls vertices that are hidden below the ellipsoidal horizon from the camera's perspective.
 *
 * Prerequisites:
 * - Include horizon_culling_pars_vertex.glsl for function declarations
 * - Variable 'absTransformed' must be defined as the world position in ECEF meters
 * - Sets vHorizonCulled output variable: 1 if culled, 0 if visible
 *
 * @reference https://cesium.com/blog/2013/04/25/horizon-culling/
 */

bool horizonCulled = nvr_horizon_culled(absTransformed, cameraPosition);
if (horizonCulled) {
  vHorizonCulled = 1;
  gl_Position = vec4(0.0);
  return;
}
vHorizonCulled = 0;