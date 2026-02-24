#include "chunks/horizon_culling_pars_vertex.glsl"
#include "chunks/sprite_height_pars_vertex.glsl"
#include "chunks/billboardMat.glsl"

// Per-instance attributes
attribute vec2 glyphOffset;  // Glyph position in normalized text space
attribute vec2 glyphSize;    // Glyph quad dimensions in normalized text space
attribute vec4 glyphUvRect;  // Atlas UV sub-rect: (u0, v0, u1, v1)

// Uniforms
uniform vec3 rtcPos;
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
    // --- RTC sprite positioning ---
    mat4 modelViewMatrixNoScale = nvr_removeScaleFromMat4(modelViewMatrix);
    vec4 posMv = modelViewMatrixNoScale * vec4(rtcPos, 1.0);

    // Reconstruct world position for horizon culling
    mat3 viewRotation = mat3(viewMatrix);
    vec3 absTransformed = transpose(viewRotation) * posMv.xyz + cameraPosition;

    // --- Horizon culling ---
    #include "chunks/horizon_culling_vertex.glsl"

    // --- Height offset ---
    posMv += mvr_getMvHeightOffset(absTransformed, uAddHeight);

    // --- Compute scale factor ---
    float scaleFactor = uFontSizePx;
    if (uScaleByDistance > 0.0) {
        scaleFactor = uFontSizePx * (1.0 + (length(posMv.xyz) / DISTANCE_SCALE_FACTOR));
    }

    // --- Per-glyph vertex position ---
    // position.xy is the unit quad [-0.5, 0.5]
    // Scale by glyph size and offset by glyph position
    vec2 localPos = position.xy * glyphSize + glyphOffset;

    // Apply centering: shift entire text block by anchor point
    localPos.x -= uCenter.x * uTextWidth;
    localPos.y -= (1.0 - uCenter.y) * uTextHeight;

    // Apply billboard transform (screen-aligned, scaled)
    vec4 delta = vec4(localPos * scaleFactor, 0.0, 0.0);
    vec4 newMvPosition = posMv + delta;

    gl_Position = projectionMatrix * newMvPosition;

    // --- Atlas UV interpolation ---
    // Map unit quad UV [0,1] to atlas sub-rect
    vAtlasUv = mix(glyphUvRect.xy, glyphUvRect.zw, uv);

    // --- Depth for logarithmic depth buffer ---
    vFragDepth = gl_Position.w + 1.0;
}
