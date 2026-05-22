#include "chunks/horizon_culling_pars_vertex.glsl"
#include "chunks/sprite_height_pars_vertex.glsl"
#include "chunks/pixelToWorld.glsl"

// Per-instance attributes
attribute vec2 glyphOffset;  // Glyph position in normalized text space
attribute vec2 glyphSize;    // Glyph quad dimensions in normalized text space
attribute vec4 glyphUvRect;  // Atlas sub-rect in PIXEL space: (x0, y0, x1, y1)
attribute float glyphIsColor; // 1.0 = sample COLRv1 color atlas, 0.0 = sample SDF atlas

// Uniforms
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
// Current atlas dimensions in pixels. Both update at runtime when the atlas
// grows on overflow, so per-instance pixel rects normalize to the right UV
// regardless of when the geometry was built.
uniform vec2 uSdfAtlasSize;
uniform vec2 uColorAtlasSize;
uniform bool uSizeInMeters;
uniform float uFovRad;
uniform float uScreenHeightPx;
uniform float uTextWidth;
uniform float uTextHeight;
uniform vec2 uCenter;
uniform float uAddHeight;
// Instance 0 is reserved for the background quad.
uniform vec2 uBgYBounds; // (minY, maxY) of actual glyph bounding box in normalized text space
uniform bool uShowBackground;

// Varyings
varying vec2 vAtlasUv;
varying float vFragDepth;
flat varying int vBackGroundSprite; // Whether this vertex belongs to the background sprite (1) or a glyph (0)
flat varying float vBackGroundRatio;
flat varying int vIsColor; // Per-instance flag: glyph is sampled from the color atlas

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

    // Compute scale factor: when sizeInMeters is off, convert pixel size to
    // world units so text maintains constant screen-pixel size at any distance.
    // Normalized text height is 1.0, so no fontSizeWorld division is needed.
    float scaleFactor = uFontSize;
    if (!uSizeInMeters) {
        scaleFactor = nvr_pxToWorld(uFontSize, uFovRad, uScreenHeightPx, vec3(0.0, 0.0, mvPosition.z), vec3(0.0, 0.0, 0.0));
    }

    vec2 center = clamp(uCenter, vec2(-0.5), vec2(0.5)); // Ensure center is within the bounds of the sprite

    vIsColor = glyphIsColor > 0.5 ? 1 : 0;

    if (uShowBackground && gl_InstanceID == 0) {
        vBackGroundSprite = 1;

        float bgHeight = uBgYBounds.y - uBgYBounds.x;
        vec2 bgLocalPos = (position.xy + vec2(0.5)) * vec2(uTextWidth, bgHeight) + vec2(0.0, uBgYBounds.x);
        bgLocalPos.x -= center.x * uTextWidth;
        bgLocalPos.y -= center.y * uTextHeight;

        vec4 newMvPosition = mvPosition + vec4(bgLocalPos * scaleFactor, 0.0, 0.0);

        gl_Position = projectionMatrix * newMvPosition;

        vAtlasUv = uv;
        vBackGroundRatio = uTextWidth / bgHeight; // Pass the aspect ratio of the background sprite to the fragment shader for proper corner radius scaling
    } else {
        vBackGroundSprite = 0;
        // --- Per-glyph vertex position ---
        // position.xy is the unit quad [-0.5, 0.5].
        // glyphOffset is the glyph bbox min corner (left/bottom), so remap
        // the centered quad to [0,1] before applying glyph size/offset.
        vec2 localPos = (position.xy + vec2(0.5)) * glyphSize + glyphOffset;

        // Apply centering: shift entire text block by anchor point
        localPos.x -= center.x * uTextWidth;
        localPos.y -= center.y * uTextHeight;

        // Apply billboard transform (screen-aligned, scaled)
        vec4 delta = vec4(localPos * scaleFactor, 0.0, 0.0);
        vec4 newMvPosition = mvPosition + delta;

        gl_Position = projectionMatrix * newMvPosition;

        // Atlas UV interpolation: glyphUvRect carries pixel-space corners so
        // resizing the atlas only requires updating the size uniform — geometry
        // attributes stay valid.
        vec2 atlasSize = glyphIsColor > 0.5 ? uColorAtlasSize : uSdfAtlasSize;
        vAtlasUv = mix(glyphUvRect.xy, glyphUvRect.zw, uv) / atlasSize;
    }

    vFragDepth = gl_Position.w + 1.0;
}
