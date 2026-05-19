// Slug-style curve text -- vertex shader (Phase 5).
//
// Fetches each glyph's bbox from the shared uGlyphHeaders texture and
// emits a quad in em-space. The fragment shader receives the header slot
// and the interpolated em-space position; everything else (band table,
// curves, COLR layers) is fetched at fragment time.
//
// Coordinate flow:
//   position.xy  in [-0.5, 0.5]  (unit quad attribute)
//   emPos        = remap to glyph bbox in em-space (per-glyph)
//   localPos     = emPos - anchor                  (after uCenter)
//   worldPos     = mvPosition + scaleFactor * localPos  (billboard quad)
//
// Same RTE/RTC + billboard math as the legacy SDF vertex shader.

#include "chunks/horizon_culling_pars_vertex.glsl"
#include "chunks/sprite_height_pars_vertex.glsl"
#include "chunks/pixelToWorld.glsl"

// Per-instance attributes:
//   aGlyphHeaderSlot -- slot index into uGlyphHeaders
//   aGlyphCursor     -- em-space origin for this glyph (accumulated xAdvance
//                       + xOffset from shaping), so successive glyphs lay out
//                       left-to-right
attribute float aGlyphHeaderSlot;
attribute vec2 aGlyphCursor;

// -- Shared GPU buffers (data textures populated by CurveTextureSet). --
uniform sampler2D uGlyphHeaders;
/** All curve-pipeline data textures share this width (CURVE_TEX_WIDTH). */
uniform float uCurveTexWidth;

#ifdef USE_RTE
    uniform vec3 uRTEPositionLOW;
    uniform vec3 uRTEPositionHIGH;
    uniform vec3 uEyeRTEHigh;
    uniform vec3 uEyeRTELow;
#else
    uniform vec3 uRTCPosition;
    uniform vec3 uRTCCenter;
#endif

uniform float uFontSize;
uniform bool uSizeInMeters;
uniform float uFovRad;
uniform float uScreenHeightPx;
uniform vec2 uCenter;
uniform float uAddHeight;
// Em-space dimensions of the whole text run (set by CurveTextMesh after
// shaping). Used to resolve `uCenter` against the label as a whole rather
// than each glyph in isolation.
uniform float uTextWidthEm;
uniform float uTextHeightEm;

// Pass-through to fragment.
flat varying float vGlyphHeaderSlot;
varying vec2 vEmCoord;
varying vec4 vBboxMinMax;
varying float vFragDepth;
// vHorizonCulled is declared by chunks/horizon_culling_pars_vertex.glsl.

ivec2 _idxTo2D(float idx) {
    float y = floor(idx / uCurveTexWidth);
    float x = idx - y * uCurveTexWidth;
    return ivec2(int(x), int(y));
}

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
    viewMatrixRTE[3] = vec4(0.0, 0.0, 0.0, 1.0);
    mvPosition = viewMatrixRTE * vec4(resolvedPosition, 1.0);
#else
    vec4 centerMV = viewMatrix * vec4(uRTCCenter, 1.0);
    mat4 viewMatrixRTC = viewMatrix;
    viewMatrixRTC[3] = vec4(centerMV.xyz, 1.0);

    mvPosition = viewMatrixRTC * vec4(uRTCPosition, 1.0);
#endif

    mvPosition += mvr_getMvHeightOffset(absTransformed, uAddHeight);

    float scaleFactor = uFontSize;
    if (!uSizeInMeters) {
        scaleFactor = nvr_pxToWorld(
            uFontSize, uFovRad, uScreenHeightPx,
            vec3(0.0, 0.0, mvPosition.z),
            vec3(0.0, 0.0, 0.0)
        );
    }

    vec2 anchor = clamp(uCenter, vec2(-0.5), vec2(0.5));

    // Fetch only the first header texel; bbox lives in (.xy = bboxMin, .zw = bboxMax).
    float baseTexel = aGlyphHeaderSlot * 3.0;
    vec4 hdr0 = texelFetch(uGlyphHeaders, _idxTo2D(baseTexel), 0);
    vec2 bboxMin = hdr0.xy;
    vec2 bboxMax = hdr0.zw;
    vec2 bboxSize = bboxMax - bboxMin;

    // Map unit quad [-0.5, 0.5] -> this glyph's em-space bbox + its cursor
    // position in the run. emPos is the glyph-LOCAL coord (relative to its
    // own bbox) — the fragment shader needs it that way for band lookup —
    // while localPos is the run-space coord used to position the quad.
    vec2 emPos = (position.xy + vec2(0.5)) * bboxSize + bboxMin;
    vec2 localPos = emPos + aGlyphCursor;
    localPos.x -= anchor.x * uTextWidthEm;
    localPos.y -= anchor.y * uTextHeightEm;

    vec4 delta = vec4(localPos * scaleFactor, 0.0, 0.0);
    vec4 newMvPosition = mvPosition + delta;
    gl_Position = projectionMatrix * newMvPosition;

    vGlyphHeaderSlot = aGlyphHeaderSlot;
    vEmCoord = emPos;
    vBboxMinMax = vec4(bboxMin, bboxMax);
    vFragDepth = gl_Position.w + 1.0;
}
