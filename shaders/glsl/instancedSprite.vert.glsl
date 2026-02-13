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

attribute float instanceShow;
attribute float instanceHeight;
attribute vec3 instanceColor;
attribute float instanceBatchID;

uniform vec3 uRTCCenter;
uniform vec3 uEyeRTEHigh;
uniform vec3 uEyeRTELow;
uniform float uScale;
uniform bool uScaleByDistance;
uniform vec2 uCenter;
uniform float uAspect; // Aspect ratio of the billboard texture

// Normalization factor to keep sprite size consistent across globe-scale distances
const float DISTANCE_SCALE_FACTOR = 1000000.0;

varying vec2 vUv;
varying vec3 vColor;
varying float vBatchID;
varying float vFragDepth;

void main() {
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

    if (instanceShow <= 0.5) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // Cull the vertex by moving it outside of the clip space
        return;
    }

    vec4 mvPosition;
#ifdef USE_RTE
    vec3 highDiff = instancePositionHIGH - uEyeRTEHigh;
    vec3 lowDiff = instancePositionLOW - uEyeRTELow;
    vec3 resolvedPosition = highDiff + lowDiff;

    mat4 viewMatrixRTE = viewMatrix;
    viewMatrixRTE[3] = vec4(0.0, 0.0, 0.0, 1.0); // Remove translation
    mvPosition = viewMatrixRTE * vec4(resolvedPosition, 1.0);
#else
    // Adjust view matrix for RTC
    vec4 centerMV = viewMatrix * vec4(uRTCCenter, 1.0);
    mat4 viewMatrixRTC = viewMatrix;
    viewMatrixRTC[3] = vec4(centerMV.xyz, 1.0);

    mvPosition = viewMatrixRTC * vec4(instancePosition, 1.0);
#endif

    mvPosition += mvr_getMvHeightOffset(absTransformed, instanceHeight);
    // This makes it always face the camera
    if (uScaleByDistance) {
        float scale = uScale * length(mvPosition.xyz) / DISTANCE_SCALE_FACTOR;
        mvPosition.xy += (((position.xy - uCenter)) * vec2(uAspect, 1.0) * scale);
    } else {
        mvPosition.xy += (((position.xy - uCenter)) * vec2(uAspect, 1.0) * uScale);
    }
    gl_Position = projectionMatrix * mvPosition;
    vFragDepth = gl_Position.w + 1.0;

}
