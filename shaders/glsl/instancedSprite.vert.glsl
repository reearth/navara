#include "chunks/horizon_culling_pars_vertex.glsl"
#include "chunks/sprite_height_pars_vertex.glsl"

#ifdef USE_RTE
    attribute vec3 instancePositionLOW; 
    attribute vec3 instancePositionHIGH; 
#else
    attribute vec3 instancePosition; 
#endif

#ifdef BILLBOARD
    attribute float instanceLayer; // Which texture layer to use
    varying float vLayer;
#endif

// attribute float instanceScale;
attribute vec3 instanceColor;
attribute float instanceBatchID;

uniform vec3 uRTCCenter;
uniform vec3 uEyeRTEHigh;
uniform vec3 uEyeRTELow;
uniform float uScale;
uniform float uHeightOffset;
uniform bool uScaleByDistance;

varying vec2 vUv;
varying vec3 vColor;
varying float vBatchID;

void main() {
int id = gl_InstanceID;
#ifdef USE_RTE
    vec3 absTransformed = instancePositionHIGH + instancePositionLOW;
#else
    vec3 absTransformed = instancePosition + uRTCCenter;
#endif
    #include "chunks/horizon_culling_vertex.glsl"

#ifdef BILLBOARD
    vLayer = instanceLayer;
#endif

    vUv = uv;
    vBatchID = instanceBatchID;
    vColor = instanceColor;

    vec4 mvPosition;
#ifdef USE_RTE
    vec3 highDiff = instancePositionHIGH - uEyeRTEHigh;
    vec3 lowDiff = instancePositionLOW - uEyeRTELow;
    vec3 instancePosition = highDiff + lowDiff;

    mat4 viewMatrixRTE = viewMatrix;
    viewMatrixRTE[3] = vec4(0.0, 0.0, 0.0, 1.0); // Remove translation
    mvPosition = viewMatrixRTE * vec4(instancePosition, 1.0);
#else
    // Adjust view matrix for RTC
    vec4 centerMV = viewMatrix * vec4(uRTCCenter, 1.0);
    mat4 viewMatrixRTC = viewMatrix;
    viewMatrixRTC[3] = vec4(centerMV.xyz, 1.0);

    mvPosition = viewMatrixRTC * vec4(instancePosition, 1.0);
#endif

    mvPosition += mvr_getMvHeightOffset(absTransformed, uHeightOffset);
    // This makes it always face the camera
    if (uScaleByDistance) {
        float scale = uScale * length(mvPosition.xyz) / 1000000.0; // Scale by distance (1 unit = 1km)
        mvPosition.xy += (position.xy * scale);
    } else {
        mvPosition.xy += (position.xy * uScale);
    }
    gl_Position = projectionMatrix * mvPosition;

}
