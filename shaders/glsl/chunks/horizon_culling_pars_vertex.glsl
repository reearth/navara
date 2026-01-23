// reference: https://cesium.com/blog/2013/04/25/horizon-culling/
#include "ellipsoid.glsl"
/**
 * Determines if a point on the ellipsoid is hidden below the horizon from the camera.
 * Note: Does not account for the cone test.
 *
 * @name nvr_horizon_culled
 * @glslFunction
 *
 * param {vec3} targetPosition World position of the point in ECEF meters.
 * param {vec3} cameraPosition World position of the camera in the same space.
 * returns {bool} true if the point lies beyond the ellipsoidal horizon and can be culled.
 */
flat out int vHorizonCulled;

bool nvr_horizon_culled(vec3 targetPosition, vec3 cameraPosition) {
    vec3 cameraPositionScaled = cameraPosition * ONE_OVER_WGS84_RADII;
    vec3 targetPositionScaled = targetPosition * ONE_OVER_WGS84_RADII;

    vec3 vt = cameraPositionScaled - targetPositionScaled;
    vec3 vc = cameraPositionScaled;
    float a = dot(vc, vc) - 1.0;

    return dot(vt, vc) > a;
}
