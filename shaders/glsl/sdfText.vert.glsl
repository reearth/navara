#include "chunks/horizon_culling_pars_vertex.glsl"
#include "chunks/sprite_height_pars_vertex.glsl"

// Per-instance attributes
attribute vec2 glyphOffset;  // Glyph position in normalized text space
attribute vec2 glyphSize;    // Glyph quad dimensions in normalized text space
attribute vec4 glyphUvRect;  // Atlas UV sub-rect: (u0, v0, u1, v1)

// Uniforms
#ifdef USE_RTE
    // TODO: do the calculation on CPU and just pass in the final position as a single attribute
    uniform vec3 uRTEPositionLOW; 
    uniform vec3 uRTEPositionHIGH;
    uniform vec3 uEyeRTEHigh;
    uniform vec3 uEyeRTELow;
#else
    uniform vec3 uRTCPosition; 
    uniform vec3 uRTCCenter;
#endif

uniform float uFontSizePx;
uniform float uScaleByDistance;
uniform float uTextWidth;
uniform float uTextHeight;
uniform vec2 uCenter;
uniform float uAddHeight;

// Varyings
varying vec2 vAtlasUv;
varying float vFragDepth;

// Distance scaling normalization factor (matches instancedSprite convention)
const float DISTANCE_SCALE_FACTOR = 100000.0;

void main() {
#ifdef USE_RTE
    vec3 absTransformed = uRTEPositionHIGH + uRTEPositionLOW;
#else
    vec3 absTransformed = uRTCPosition + uRTCCenter;
#endif
    #include "chunks/horizon_culling_vertex.glsl"

    vec4 mvPosition;
#ifdef USE_RTE
    vec3 highDiff = uRTEPositionHIGH - uEyeRTEHigh;
    vec3 lowDiff = uRTEPositionLOW - uEyeRTELow;
    vec3 resolvedPosition = highDiff + lowDiff;

    mat4 viewMatrixRTE = viewMatrix;
    viewMatrixRTE[3] = vec4(0.0, 0.0, 0.0, 1.0); // Remove translation
    mvPosition = viewMatrixRTE * vec4(resolvedPosition, 1.0);
#else
    // Adjust view matrix for RTC
    vec4 centerMV = viewMatrix * vec4(uRTCCenter, 1.0);
    mat4 viewMatrixRTC = viewMatrix;
    viewMatrixRTC[3] = vec4(centerMV.xyz, 1.0);

    mvPosition = viewMatrixRTC * vec4(uRTCPosition, 1.0);
#endif

    mvPosition += mvr_getMvHeightOffset(absTransformed, uAddHeight);

    vec2 center = clamp(uCenter, vec2(-0.5), vec2(0.5)); // Ensure center is within the bounds of the sprite

    // --- Per-glyph vertex position ---
    // position.xy is the unit quad [-0.5, 0.5].
    // glyphOffset is the glyph bbox min corner (left/bottom), so remap
    // the centered quad to [0,1] before applying glyph size/offset.
    vec2 localPos = (position.xy + vec2(0.5)) * glyphSize + glyphOffset;

    // Apply centering: shift entire text block by anchor point
    localPos.x -= center.x * uTextWidth;
    localPos.y -= (1.0 - center.y) * uTextHeight;

    float scaleFactor = uFontSizePx;

    // Apply billboard transform (screen-aligned, scaled)
    vec4 delta = vec4(localPos * scaleFactor, 0.0, 0.0);
    vec4 newMvPosition = mvPosition + delta;

    gl_Position = projectionMatrix * newMvPosition;

    // Atlas UV interpolation: map unit quad UV [0,1] to atlas sub-rect
    vAtlasUv = mix(glyphUvRect.xy, glyphUvRect.zw, uv);

    vFragDepth = gl_Position.w + 1.0;
}