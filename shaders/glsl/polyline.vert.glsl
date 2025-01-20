// Ref: https://github.com/CesiumGS/cesium/blob/165e0fb4fcc9a448b15de6a2df46db23c71fffda/packages/engine/Source/Shaders/PolylineShadowVolumeVS.glsl

#include chunks/branchFreeTernary;
#include chunks/planeDistance;
#include chunks/metersPerPixel;

attribute float batchId;
attribute float isPicked;

in vec3 start;
in vec3 forward_offset;
in vec3 start_normal;
in vec4 end_normal_and_texture_coordinate_normalization_x;
in vec4 right_normal_and_texture_coordinate_normalization_y;

uniform vec3 minMaxHeightAndWidth;
uniform vec3 viewportAndPixelRatio;
uniform vec2 frustumNearFar;
uniform vec4 frustumRatio;

out vec4 v_startPlaneNormalEcAndHalfWidth;
out vec3 v_endPlaneNormalEc;
out vec4 v_rightPlaneEC;
out vec4 v_endEcAndStartEcX;
out vec4 v_texcoordNormalizationAndStartEcYZ;
out vec3 vViewPosition;
out float v_batchId;
out float v_IsPicked;


void main() {
    vec3 ecStart = (modelViewMatrix * vec4(start, 1.0)).xyz;
    vec3 offset = normalMatrix * forward_offset;
    vec3 ecEnd = ecStart + offset;

    v_batchId = batchId;
    v_IsPicked = isPicked;

    vec3 forwardDirectionEC = normalize(offset);

    // start plane
    vec4 startPlaneEC;
    startPlaneEC.xyz = normalMatrix * start_normal;
    startPlaneEC.w = -dot(startPlaneEC.xyz, ecStart);

    // end plane
    vec4 endPlaneEC;
    endPlaneEC.xyz = normalMatrix * end_normal_and_texture_coordinate_normalization_x.xyz;
    endPlaneEC.w = -dot(endPlaneEC.xyz, ecEnd);

    // Right plane
    v_rightPlaneEC.xyz = normalMatrix * right_normal_and_texture_coordinate_normalization_y.xyz;
    v_rightPlaneEC.w = -dot(v_rightPlaneEC.xyz, ecStart);

    v_texcoordNormalizationAndStartEcYZ.x = abs(end_normal_and_texture_coordinate_normalization_x.w);
    v_texcoordNormalizationAndStartEcYZ.y = right_normal_and_texture_coordinate_normalization_y.w;

    v_endEcAndStartEcX.xyz = ecEnd;
    v_endEcAndStartEcX.w = ecStart.x;
    v_texcoordNormalizationAndStartEcYZ.zw = ecStart.yz;

    vec4 positionEC = modelViewMatrix * vec4(position, 1.0);

    float absStartPlaneDistance = abs(nvr_planeDistance(startPlaneEC, positionEC.xyz));
    float absEndPlaneDistance = abs(nvr_planeDistance(endPlaneEC, positionEC.xyz));
    vec3 planeDirection = nvr_branchFreeTernary(absStartPlaneDistance < absEndPlaneDistance, startPlaneEC.xyz, endPlaneEC.xyz);
    vec3 upOrDown = normalize(cross(v_rightPlaneEC.xyz, planeDirection)); // Points "up" for start plane, "down" at end plane.
    vec3 normalEC = normalize(cross(planeDirection, upOrDown));           // In practice, the opposite seems to work too.

    // Extrudes height
    vec3 heightNormal = normalize(nvr_branchFreeTernary(absStartPlaneDistance < absEndPlaneDistance, cross(v_rightPlaneEC.xyz, startPlaneEC.xyz), cross(endPlaneEC.xyz, v_rightPlaneEC.xyz)));
    vec3 cur_point = nvr_branchFreeTernary(absStartPlaneDistance < absEndPlaneDistance, start, start + forward_offset);
    vec3 diff = normalize(position - cur_point);
    vec3 height = heightNormal * nvr_branchFreeTernary(dot(diff, heightNormal) > 0., minMaxHeightAndWidth.y, minMaxHeightAndWidth.x);
    positionEC.xyz += height;

    // upOrDown = cross(forwardDirectionEC, normalEC);
    // upOrDown = float(v_texcoordNormalizationAndStartEcYZ.y > 1.0 || v_texcoordNormalizationAndStartEcYZ.y < 0.0) * upOrDown;
    // positionEC.xyz += upOrDown;
 
    v_texcoordNormalizationAndStartEcYZ.y = nvr_branchFreeTernary(v_texcoordNormalizationAndStartEcYZ.y > 1.0, 0.0, abs(v_texcoordNormalizationAndStartEcYZ.y));

    float lineWidth = minMaxHeightAndWidth.z;

    v_startPlaneNormalEcAndHalfWidth.xyz = startPlaneEC.xyz;
    v_startPlaneNormalEcAndHalfWidth.w = lineWidth * 0.5;

    v_endPlaneNormalEc.xyz = endPlaneEC.xyz;

    lineWidth = lineWidth * max(0.0, nvr_metersPerPixel(positionEC, viewportAndPixelRatio, frustumNearFar, frustumRatio)); // lineWidth = distance to push along R
    lineWidth = lineWidth / dot(normalEC, v_rightPlaneEC.xyz); // lineWidth = distance to push along N

    normalEC *= sign(end_normal_and_texture_coordinate_normalization_x.w);

    positionEC.xyz += lineWidth * normalEC;
    gl_Position = projectionMatrix * positionEC;
    vViewPosition = -positionEC.xyz;
}
