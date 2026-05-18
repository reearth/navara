// Slug-style curve text — vertex shader.
//
// Phase 4: stub. Reuses the SDF vertex shader's RTE/RTC + billboard math,
// but fetches each glyph's bbox from the shared `uGlyphHeaders` texture
// instead of receiving it as per-instance attributes. The fragment shader
// receives `vGlyphHeaderSlot` so it can fetch band tables and curve data
// from the other three textures during Phase 5.

#include "chunks/horizon_culling_pars_vertex.glsl"
#include "chunks/sprite_height_pars_vertex.glsl"
#include "chunks/pixelToWorld.glsl"

// Per-instance attribute: slot index into uGlyphHeaders.
attribute float aGlyphHeaderSlot;

// -- Shared GPU buffers (data textures populated by CurveTextureSet). --
uniform sampler2D uGlyphHeaders;       // RGBA32F, 3 texels per header
uniform float uGlyphHeadersWidth;      // texture width in texels

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

// Pass-through to fragment.
flat varying float vGlyphHeaderSlot;
varying vec2 vEmCoord;          // em-space position inside the glyph bbox
varying vec4 vBboxMinMax;       // (bbox_min.xy, bbox_max.xy), forwarded for Phase 5
varying float vFragDepth;

// Look up `slot`'s header texels. Header is 12 f32 = 3 RGBA32F texels.
// Layout (must match HEADER_F32_COUNT slots in Rust):
//   texel 0: bbox_min.xy, bbox_max.xy
//   texel 1: band_count, bands_offset, band_curves_offset, curves_offset
//   texel 2: flags, color_layer_start, color_layer_count, reserved
void fetchHeader(in float slot, out vec4 t0, out vec4 t1, out vec4 t2) {
    float baseTexel = slot * 3.0;
    float texW = uGlyphHeadersWidth;
    // Row-major addressing: y = floor(idx / width), x = idx - y*width
    float y0 = floor(baseTexel / texW);
    float x0 = baseTexel - y0 * texW;
    float y1 = floor((baseTexel + 1.0) / texW);
    float x1 = (baseTexel + 1.0) - y1 * texW;
    float y2 = floor((baseTexel + 2.0) / texW);
    float x2 = (baseTexel + 2.0) - y2 * texW;
    t0 = texelFetch(uGlyphHeaders, ivec2(int(x0), int(y0)), 0);
    t1 = texelFetch(uGlyphHeaders, ivec2(int(x1), int(y1)), 0);
    t2 = texelFetch(uGlyphHeaders, ivec2(int(x2), int(y2)), 0);
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
        scaleFactor = nvr_pxToWorld(uFontSize, uFovRad, uScreenHeightPx, vec3(0.0, 0.0, mvPosition.z), vec3(0.0, 0.0, 0.0));
    }

    vec2 center = clamp(uCenter, vec2(-0.5), vec2(0.5));

    // Fetch glyph header.
    vec4 hdr0, hdr1, hdr2;
    fetchHeader(aGlyphHeaderSlot, hdr0, hdr1, hdr2);
    vec2 bboxMin = hdr0.xy;
    vec2 bboxMax = hdr0.zw;
    vec2 bboxSize = bboxMax - bboxMin;

    // Map the unit quad [-0.5, 0.5] to the glyph's em-space bbox.
    vec2 emPos = (position.xy + vec2(0.5)) * bboxSize + bboxMin;
    // Shift by anchor point (Phase 4 stub: no per-text-width centering yet).
    vec2 localPos = emPos;
    localPos.x -= center.x;
    localPos.y -= center.y;

    vec4 delta = vec4(localPos * scaleFactor, 0.0, 0.0);
    vec4 newMvPosition = mvPosition + delta;
    gl_Position = projectionMatrix * newMvPosition;

    vGlyphHeaderSlot = aGlyphHeaderSlot;
    vEmCoord = emPos;
    vBboxMinMax = vec4(bboxMin, bboxMax);
    vFragDepth = gl_Position.w + 1.0;
}
