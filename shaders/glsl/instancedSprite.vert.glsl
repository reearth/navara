// NOTE: Coupled with crates/navara_feature/src/geometry/point.rs::pixel_to_world
#include "chunks/horizon_culling_pars_vertex.glsl"
#include "chunks/sprite_height_pars_vertex.glsl"
#include "chunks/pixelToWorld.glsl"

#ifdef USE_RTE
    attribute vec3 instancePositionLOW; 
    attribute vec3 instancePositionHIGH; 
#else
    attribute vec3 instancePosition; 
#endif

#ifdef BILLBOARD
    // Atlas sub-rect in pixels: x, y, width, height. Normalized by uAtlasSize
    // here (not baked into the attribute) so rects stay valid when the atlas
    // grows — growth only updates the uniform.
    attribute vec4 instanceUvRect;
    uniform vec2 uAtlasSize;
#endif

attribute vec4 instanceParams; // x=height, y=size, z=show, w=opacity
attribute vec3 instanceColor;
attribute float instanceBatchID;
// Animated hide factor from the screen-space declutter pass (0 = shown,
// 1 = hidden); opacity is scaled by (1.0 - instanceDeclutterHide) and the
// instance is only hard-culled once the fade completes. Kept separate from
// instanceParams.z (show) so user visibility and declutter results compose.
attribute float instanceDeclutterHide;

uniform vec3 uRTCCenter;
// RTC center already transformed into view (eye) space on the CPU in float64.
// Computed there to avoid the catastrophic float32 cancellation that
// `viewMatrix * uRTCCenter` suffers from when both operands are ~6.4e6 (ECEF).
uniform vec3 uRTCCenterView;
uniform vec3 uEyeRTEHigh;
uniform vec3 uEyeRTELow;
// Always 1.0 — blocks fast-math reassociation of the high/low recombination
// (see chunks/rte_pars_vertex.glsl).
uniform float u_rteOne;
uniform float uScale;
uniform bool uSizeInMeters;
uniform vec2 uCenter;
uniform float uFovRad;
uniform float uScreenHeightPx;

varying vec2 vUv;
varying vec3 vColor;
varying float vBatchID;
varying float vFragDepth;
varying float vOpacity; // Pass opacity to fragment shader

void main() {
    float instanceHeight = instanceParams.x;
    float instanceSize = instanceParams.y;
    float instanceShow = instanceParams.z;
    vOpacity = instanceParams.w * (1.0 - instanceDeclutterHide);

#ifdef USE_RTE
    vec3 absTransformed = instancePositionHIGH + instancePositionLOW;
#else
    vec3 absTransformed = instancePosition + uRTCCenter;
#endif
    #include "chunks/horizon_culling_vertex.glsl"

#ifdef BILLBOARD
    vUv = (instanceUvRect.xy + uv * instanceUvRect.zw) / uAtlasSize;
#else
    vUv = uv;
#endif
    vBatchID = instanceBatchID;
    vColor = instanceColor;

    if (instanceShow <= 0.5 || instanceDeclutterHide >= 0.999) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // Cull the vertex by moving it outside of the clip space
        return;
    }

    vec4 mvPosition;
#ifdef USE_RTE
    // The u_rteOne (== 1.0) factor is load-bearing: see chunks/rte_pars_vertex.glsl.
    vec3 highDiff = (instancePositionHIGH - uEyeRTEHigh) * u_rteOne;
    vec3 lowDiff = instancePositionLOW - uEyeRTELow;
    vec3 resolvedPosition = highDiff + lowDiff;

    mat4 viewMatrixRTE = viewMatrix;
    viewMatrixRTE[3] = vec4(0.0, 0.0, 0.0, 1.0); // Remove translation
    mvPosition = viewMatrixRTE * vec4(resolvedPosition, 1.0);
#else
    // Adjust view matrix for RTC. uRTCCenterView is the RTC center already in
    // view space (computed on the CPU in float64), so no large-coordinate
    // float32 subtraction happens here — this is what removes the jitter.
    mat4 viewMatrixRTC = viewMatrix;
    viewMatrixRTC[3] = vec4(uRTCCenterView, 1.0);

    mvPosition = viewMatrixRTC * vec4(instancePosition, 1.0);
#endif

    mvPosition += mvr_getMvHeightOffset(absTransformed, instanceHeight);
    vec2 center = clamp(uCenter, vec2(-0.5), vec2(0.5)); // Ensure center is within the bounds of the sprite

    // Use per-instance size when set (>= 0.0). A negative value means "use uScale".
    float scale = instanceSize >= 0.0 ? instanceSize : uScale;
    float clampedScale = max(0.0, scale); // Prevent negative scaling
#ifdef BILLBOARD
    // Per-instance image aspect from the atlas rect (guard empty rects).
    float aspect = instanceUvRect.w > 0.0 ? instanceUvRect.z / instanceUvRect.w : 1.0;
#else
    float aspect = 1.0;
#endif
    // This makes it always face the camera
    if (!uSizeInMeters) {
        clampedScale = nvr_pxToWorld(clampedScale, uFovRad, uScreenHeightPx, vec3(0.0, 0.0, mvPosition.z), vec3(0.0, 0.0, 0.0));
        mvPosition.xy += (((position.xy - center)) * vec2(aspect, 1.0) * clampedScale);
    } else {
        mvPosition.xy += (((position.xy - center)) * vec2(aspect, 1.0) * clampedScale);
    }

    gl_Position = projectionMatrix * mvPosition;
    vFragDepth = gl_Position.w + 1.0;
}
