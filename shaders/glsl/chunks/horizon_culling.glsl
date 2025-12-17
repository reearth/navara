// reference: https://cesium.com/blog/2013/04/25/horizon-culling/

/**
 * Determines if a point on the ellipsoid is hidden below the horizon from the camera.
 *
 * @name nvr_horizon_culled
 * @glslFunction
 *
 * param {vec3} targetPosition World position of the point in ECEF meters.
 * param {vec3} cameraPosition World position of the camera in the same space.
 * returns {bool} true if the point lies beyond the ellipsoidal horizon and can be culled.
 */
bool nvr_horizon_culled(vec3 targetPosition, vec3 cameraPosition) {
    const vec3 EARTH_RADII_RECEP = 1.0 / vec3(6378137.0, 6378137.0, 6356752.3142451793);

    vec3 cameraPositionScaled = cameraPosition * EARTH_RADII_RECEP;
    vec3 targetPositionScaled = targetPosition * EARTH_RADII_RECEP;

    vec3 vt = cameraPositionScaled - targetPositionScaled;
    vec3 vc = cameraPositionScaled;
    float a = dot(vc, vc) - 1.0;

    return dot(vt, vc) > a;
}
