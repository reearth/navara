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
bool nvr_horizon_culled(vec3 targetPosition, vec3 cameraPosition) {
    vec3 cameraPositionScaled = cameraPosition * ONE_OVER_WGS84_RADII;
    vec3 targetPositionScaled = targetPosition * ONE_OVER_WGS84_RADII;

    vec3 vt = cameraPositionScaled - targetPositionScaled;
    vec3 vc = cameraPositionScaled;
    float a = dot(vc, vc) - 1.0;

    return dot(vt, vc) > a;
}

/**
 * Determines if a point on the ellipsoid is hidden below the horizon from the camera,
 * using both the horizon and cone tests.
 *
 * @name nvr_horizon_culled_cone
 * @glslFunction
 *
 * param {vec3} targetPosition World position of the point in ECEF meters.
 * param {vec3} cameraPosition World position of the camera in the same space.
 * returns {bool} true if the point lies beyond the ellipsoidal horizon and within the cone and can be culled.
 */
bool nvr_horizon_culled_cone(vec3 targetPosition, vec3 cameraPosition) {
    vec3 cameraPositionScaled = cameraPosition * ONE_OVER_WGS84_RADII;
    vec3 targetPositionScaled = targetPosition * ONE_OVER_WGS84_RADII;

    vec3 vt = cameraPositionScaled - targetPositionScaled;
    vec3 vc = cameraPositionScaled;
    float vcDotVc = dot(vc, vc);
    float vtDotVc = dot(vt, vc);
    float a = vcDotVc - 1.0;
    
    bool beyondHorizon = vtDotVc > a;
    bool inCone = ((vtDotVc * vtDotVc) / dot(vt, vt)) > (vcDotVc - 1.0);

    return beyondHorizon && inCone;
}

// bool nvr_horizon_culled_cone(vec3 targetPosition, vec3 cameraPosition) {
//     vec3 vc = cameraPosition * ONE_OVER_RADII;
//     vec3 vt = vc - (targetPosition * ONE_OVER_RADII);

//     float vc2 = dot(vc, vc);
//     float vt2 = dot(vt, vt);
//     float vtDotVc = dot(vt, vc);
    
//     // 1. Safety check: Camera must be above surface
//     if (vc2 <= 1.0) return false; 
    
//     // 2. Safety check: Avoid NaN if camera is at target
//     if (vt2 < 1e-12) return false;

//     float a = vc2 - 1.0;
    
//     bool beyondHorizon = vtDotVc > a;
//     // Rearrange the inCone formula to avoid division (multiplication is safer/faster)
//     bool inCone = (vtDotVc * vtDotVc) > (a * vt2);

//     return beyondHorizon && inCone;
// }

// vec3 nvr_horizon_point(vec3 cameraPosition) {
//     vec3 vc = cameraPosition * ONE_OVER_RADII;
//     float vc2 = dot(vc, vc);
//     float vh2 = vc2 - 1.0;
//     float theta = asin(1.0 / sqrt(vc2));
//     // rotate 


// }

vec3 nvr_horizon_point(vec3 cameraPosition, vec3 cameraUp) {
    vec3 vc = cameraPosition * ONE_OVER_WGS84_RADII;
    float vcLength = length(vc);
    float pc = 1.0 / vcLength;
    float ph = sqrt(1.0 -  pc * pc); // horizon circle radius in scaled space
    vec3 horizonCircleCenter = vc + (vcLength - pc) * normalize(-vc); // center of horizon circle in scaled space

    // using the camera up vector is not perfect but good enough for our use case
    vec3 horizonPointScaled = horizonCircleCenter + ph * normalize(cameraUp * ONE_OVER_WGS84_RADII);
    
    return horizonPointScaled * WGS84_RADII; // convert back to world space
}

vec3 nvr_horizon_point_2(vec3 cameraPosition, vec3 cameraUp) {
    vec3 vc = cameraPosition * ONE_OVER_WGS84_RADII;
    float vcLength = length(vc);
    if (vcLength <= 1.0) {
        return cameraPosition; // avoid NaNs when camera is on/inside the ellipsoid
    }

    vec3 vcDir = vc / vcLength;
    vec3 upScaled = cameraUp * ONE_OVER_WGS84_RADII;
    vec3 upTangent = upScaled - vcDir * dot(upScaled, vcDir);
    float upLen = length(upTangent);
    if (upLen < 1e-6) {
        vec3 fallback = abs(vcDir.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
        upTangent = normalize(cross(fallback, vcDir));
    } else {
        upTangent /= upLen;
    }

    float pc = 1.0 / vcLength;
    float ph2 = 1.0 - pc * pc;
    if (ph2 <= 0.0) {
        return cameraPosition;
    }
    float ph = sqrt(ph2);
    vec3 horizonCircleCenter = vc + (vcLength - pc) * (-vcDir);
    vec3 horizonPointScaled = horizonCircleCenter + ph * upTangent;

    return horizonPointScaled * WGS84_RADII;
}
