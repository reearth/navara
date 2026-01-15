/**
 * Calculate view-space height offset for sprites/billboards on an ellipsoid surface.
 * Computes an offset along the ellipsoid surface normal to elevate sprites above
 * or below the surface by a specified height in meters.
 *
 * @name mvr_getMvHeightOffset
 * @glslFunction
 *
 * param {vec3} worldPos3 - World position in ECEF meters, used to determine surface normal direction.
 * param {float} addHight - Height offset in meters (positive = above surface, negative = below).
 * returns {vec4} View-space offset vector to be added to the sprite's model-view position.
 */

vec4 mvr_getMvHeightOffset(vec3 worldPos3, float addHight) {
  if (addHight != 0.0) {
    vec3 globeNormal = normalize(worldPos3);
    vec3 heightOffset = globeNormal * addHight;
    vec4 mvHeightOffset = viewMatrix * vec4(heightOffset, 0.0);
    return mvHeightOffset;
  }
  else {
    return vec4(0.0);
  }
}