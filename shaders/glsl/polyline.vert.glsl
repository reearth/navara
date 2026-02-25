// Ref: https://github.com/CesiumGS/cesium/blob/165e0fb4fcc9a448b15de6a2df46db23c71fffda/packages/engine/Source/Shaders/PolylineShadowVolumeVS.glsl

#include chunks/branchFreeTernary;
#include chunks/planeDistance;
#include chunks/metersPerPixel;

in float attrBatchId;

#include chunks/show_pars_vertex;

#ifdef USE_RTE
  #include chunks/rte_pars_vertex;
  attribute vec3 start_3d_high;
  attribute vec3 start_3d_low;
  attribute vec3 end_3d_high;
  attribute vec3 end_3d_low;
#else
  in vec3 start;
  in vec3 forward_offset;
#endif

in vec3 start_normal;
in vec4 end_normal_and_texture_coordinate_normalization_x;
in vec4 right_normal_and_texture_coordinate_normalization_y;

#include <common>
#include <color_pars_vertex>
#include <shadowmap_pars_vertex>
#include chunks/batch_texture_pars_vertex;

uniform vec3 minMaxHeightAndWidth;
uniform vec3 viewportAndPixelRatio;
uniform vec2 frustumNearFar;
uniform vec4 frustumRatio;

flat out vec4 v_startPlaneNormalEcAndHalfWidth;
flat out vec3 v_endPlaneNormalEc;
flat out vec4 v_rightPlaneEC;
flat out float v_startPlaneOffsetEc;
flat out float v_endPlaneOffsetEc;
out vec4 v_endEcAndStartEcX;
out vec4 v_texcoordNormalizationAndStartEcYZ;
out vec3 vViewPosition;
out float nvr_vBatchId;
out vec3 vNormal;


void main() {
    #ifdef USE_RTE
        #include chunks/rte_vertex;
        // Now 'transformed' contains camera-relative position
    #else
        #include <begin_vertex>
    #endif

    #include <color_vertex>

    #include chunks/batch_texture_vertex;

    vec3 ecStart;
    vec3 ecEnd;
    vec3 offset;

    #ifdef USE_RTE
        vec3 startHighDiff = start_3d_high - u_cameraPositionHigh;
        vec3 startLowDiff = start_3d_low - u_cameraPositionLow;
        vec3 startCameraRelative = startHighDiff + startLowDiff;

        vec3 endHighDiff = end_3d_high - u_cameraPositionHigh;
        vec3 endLowDiff = end_3d_low - u_cameraPositionLow;
        vec3 endCameraRelative = endHighDiff + endLowDiff;

        ecStart = (modelViewMatrixRTE * vec4(startCameraRelative, 1.0)).xyz;
        ecEnd = (modelViewMatrixRTE * vec4(endCameraRelative, 1.0)).xyz;
        offset = ecEnd - ecStart;
    #else
        ecStart = (modelViewMatrix * vec4(start, 1.0)).xyz;
        offset = normalMatrix * forward_offset;
        ecEnd = ecStart + offset;
    #endif

    nvr_vBatchId = attrBatchId;

    vec3 forwardDirectionEC = normalize(offset);

    // start plane
    vec4 startPlaneEC;
    #ifdef USE_RTE
        startPlaneEC.xyz = mat3(modelViewMatrixRTE) * start_normal;
    #else
        startPlaneEC.xyz = normalMatrix * start_normal;
    #endif
    startPlaneEC.w = -dot(startPlaneEC.xyz, ecStart);

    // end plane
    vec4 endPlaneEC;
    #ifdef USE_RTE
        endPlaneEC.xyz = mat3(modelViewMatrixRTE) * end_normal_and_texture_coordinate_normalization_x.xyz;
    #else
        endPlaneEC.xyz = normalMatrix * end_normal_and_texture_coordinate_normalization_x.xyz;
    #endif
    endPlaneEC.w = -dot(endPlaneEC.xyz, ecEnd);

    // Right plane
    #ifdef USE_RTE
        v_rightPlaneEC.xyz = mat3(modelViewMatrixRTE) * right_normal_and_texture_coordinate_normalization_y.xyz;
    #else
        v_rightPlaneEC.xyz = normalMatrix * right_normal_and_texture_coordinate_normalization_y.xyz;
    #endif
    v_rightPlaneEC.w = -dot(v_rightPlaneEC.xyz, ecStart);

    v_texcoordNormalizationAndStartEcYZ.x = abs(end_normal_and_texture_coordinate_normalization_x.w);
    v_texcoordNormalizationAndStartEcYZ.y = right_normal_and_texture_coordinate_normalization_y.w;

    v_endEcAndStartEcX.xyz = ecEnd;
    v_endEcAndStartEcX.w = ecStart.x;
    v_texcoordNormalizationAndStartEcYZ.zw = ecStart.yz;

    #ifdef USE_RTE
        vec4 positionEC = modelViewMatrixRTE * vec4(transformed, 1.0);
    #else
        vec4 positionEC = modelViewMatrix * vec4(position, 1.0);
    #endif

    float absStartPlaneDistance = abs(nvr_planeDistance(startPlaneEC, positionEC.xyz));
    float absEndPlaneDistance = abs(nvr_planeDistance(endPlaneEC, positionEC.xyz));

    vec3 planeDirection = nvr_branchFreeTernary(absStartPlaneDistance < absEndPlaneDistance, startPlaneEC.xyz, endPlaneEC.xyz);
    vec3 upOrDown = normalize(cross(v_rightPlaneEC.xyz, planeDirection)); // Points "up" for start plane, "down" at end plane.
    vec3 normalEC = normalize(cross(planeDirection, upOrDown));           // In practice, the opposite seems to work too.

    // Extrudes height
    vec3 heightNormal = normalize(nvr_branchFreeTernary(absStartPlaneDistance < absEndPlaneDistance, cross(v_rightPlaneEC.xyz, startPlaneEC.xyz), cross(endPlaneEC.xyz, v_rightPlaneEC.xyz)));
    #ifdef USE_RTE
        // RTE mode: vertices contain WALL_INITIAL heights (bottom=0m, top=1000m)
        // Need to adjust to actual heights by:
        // 1. Determining if vertex is top or bottom based on distance from ecStart/ecEnd
        // 2. For top vertices: subtract 1000m and add minMaxHeightAndWidth.y
        // 3. For bottom vertices: add minMaxHeightAndWidth.x

        // Calculate distance from reference points to determine vertex type
        vec3 ecCurPoint = nvr_branchFreeTernary(absStartPlaneDistance < absEndPlaneDistance, ecStart, ecEnd);
        float distToRef = length(positionEC.xyz - ecCurPoint);

        // Top vertices are ~1000m away from bottom reference point, bottom vertices are ~0m away
        // Use threshold at midpoint to determine vertex type
        const float WALL_INITIAL_MAX_HEIGHT = 1000.0;
        const float THRESHOLD = 500.0;

        // Use mix for branchless selection: mix(bottom, top, step(threshold, distance))
        // step(THRESHOLD, distToRef) returns 0.0 for bottom vertices, 1.0 for top vertices
        float heightAdjustment = mix(
            minMaxHeightAndWidth.x,  // Bottom vertex: add minHeight
            minMaxHeightAndWidth.y - WALL_INITIAL_MAX_HEIGHT,  // Top vertex: remove 1000m, add maxHeight
            step(THRESHOLD, distToRef)
        );
        positionEC.xyz += heightNormal * heightAdjustment;
    #else
        vec3 cur_point = nvr_branchFreeTernary(absStartPlaneDistance < absEndPlaneDistance, start, start + forward_offset);
        vec3 diff = normalize(position - cur_point);
        vec3 height = heightNormal * nvr_branchFreeTernary(dot(diff, heightNormal) > 0., minMaxHeightAndWidth.y, minMaxHeightAndWidth.x);
        positionEC.xyz += height;
    #endif

    vec3 transformedNormal = vec3( heightNormal );

	#include <normal_vertex>

    // upOrDown = cross(forwardDirectionEC, normalEC);
    // upOrDown = float(v_texcoordNormalizationAndStartEcYZ.y > 1.0 || v_texcoordNormalizationAndStartEcYZ.y < 0.0) * upOrDown;
    // positionEC.xyz += upOrDown;
 
    v_texcoordNormalizationAndStartEcYZ.y = nvr_branchFreeTernary(v_texcoordNormalizationAndStartEcYZ.y > 1.0, 0.0, abs(v_texcoordNormalizationAndStartEcYZ.y));

    float lineWidth = minMaxHeightAndWidth.z;

    v_startPlaneNormalEcAndHalfWidth.xyz = startPlaneEC.xyz;
    v_startPlaneNormalEcAndHalfWidth.w = lineWidth * 0.5;

    v_endPlaneNormalEc.xyz = endPlaneEC.xyz;

    // Pass pre-computed plane offsets to avoid recomputation error in fragment shader
    v_startPlaneOffsetEc = startPlaneEC.w;
    v_endPlaneOffsetEc = endPlaneEC.w;

    lineWidth = lineWidth * max(0.0, nvr_metersPerPixel(positionEC, viewportAndPixelRatio, frustumNearFar, frustumRatio)); // lineWidth = distance to push along R
    lineWidth = lineWidth / dot(normalEC, v_rightPlaneEC.xyz); // lineWidth = distance to push along N

    normalEC *= sign(end_normal_and_texture_coordinate_normalization_x.w);

    positionEC.xyz += lineWidth * normalEC;
    gl_Position = projectionMatrix * positionEC;
    vViewPosition = -positionEC.xyz;

    #include <worldpos_vertex>
    #include <shadowmap_vertex>
}
