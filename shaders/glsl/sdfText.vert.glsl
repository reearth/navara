#include "chunks/horizon_culling_pars_vertex.glsl"
#include "chunks/sprite_height_pars_vertex.glsl"
#include "chunks/pixelToWorld.glsl"

// One draw call covers every label in a tile-layer batch. Instances are
// GLYPHS, not labels, so anything that varies per label is read from
// uLabelData through the per-instance `labelIndex` rather than being a
// uniform. See web/navara_three/src/mesh/sdfText/labelData.ts — LABEL_ROWS and
// the row indices below must match `LabelRow` there (LABEL_ROWS is injected as
// a define from that same constant).

// Per-instance attributes
attribute vec2 glyphOffset;  // Glyph position in normalized text space
attribute vec2 glyphSize;    // Glyph quad dimensions in normalized text space
attribute vec4 glyphUvRect;  // Atlas sub-rect in PIXEL space: (x0, y0, x1, y1)
attribute float glyphKind;   // See GLYPH_KIND_* below
attribute float labelIndex;  // Row block in uLabelData owning this instance

#define GLYPH_KIND_SDF        0.0
#define GLYPH_KIND_COLOR      1.0
#define GLYPH_KIND_BACKGROUND 2.0
// A slot inside a label's run that its current text doesn't use, or a hole
// left by a freed run. Culled outright.
#define GLYPH_KIND_EMPTY      3.0

#define LABEL_ROW_POSITION_HIGH_SIZE 0
#define LABEL_ROW_POSITION_LOW_HEIGHT 1
#define LABEL_ROW_COLOR_OPACITY 2
#define LABEL_ROW_BOX 3
#define LABEL_ROW_STATE 4

// Per-label data texture (RGBA32F, unfiltered).
uniform sampler2D uLabelData;
uniform ivec2 uLabelTexSize;

vec4 nvr_readLabel(int slot, int row) {
    int i = slot * LABEL_ROWS + row;
    return texelFetch(uLabelData, ivec2(i % uLabelTexSize.x, i / uLabelTexSize.x), 0);
}

// Uniforms — batch-wide only.
#ifdef USE_RTE
    uniform vec3 uEyeRTEHigh;
    uniform vec3 uEyeRTELow;
    // Always 1.0 — blocks fast-math reassociation of the high/low
    // recombination (see chunks/rte_pars_vertex.glsl).
    uniform float u_rteOne;
#else
    uniform vec3 uRTCCenter;
    // RTC center already transformed into view (eye) space on the CPU in
    // float64, to avoid the catastrophic float32 cancellation that
    // `viewMatrix * uRTCCenter` suffers from when both operands are ~6.4e6.
    uniform vec3 uRTCCenterView;
#endif

// Current atlas dimensions in pixels. Both update at runtime when the atlas
// grows on overflow, so per-instance pixel rects normalize to the right UV
// regardless of when the geometry was built.
uniform vec2 uSdfAtlasSize;
uniform vec2 uColorAtlasSize;
uniform bool uSizeInMeters;
uniform float uFovRad;
uniform float uScreenHeightPx;
uniform vec2 uCenter;
uniform bool uShowBackground;

// Varyings
varying vec2 vAtlasUv;
// Bounds of the current glyph's atlas rectangle. Small-text supersampling in
// the fragment shader clamps taps to these bounds so they cannot read a
// neighboring packed glyph.
flat varying vec2 vAtlasUvMin;
flat varying vec2 vAtlasUvMax;
varying float vFragDepth;
flat varying int vBackGroundSprite; // Whether this vertex belongs to the background sprite (1) or a glyph (0)
flat varying float vBackGroundRatio;
flat varying int vIsColor; // Per-instance flag: glyph is sampled from the color atlas
// Per-label style, resolved here so the fragment shader stays uniform-driven.
flat varying vec3 vColor;
// Style opacity already scaled by the declutter fade.
flat varying float vOpacity;
flat varying float vBatchID;

void main() {
    // Cull unused run slots before any texture reads.
    if (glyphKind == GLYPH_KIND_EMPTY) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // Outside clip space
        return;
    }

    bool isBackground = glyphKind == GLYPH_KIND_BACKGROUND;
    if (isBackground && !uShowBackground) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        return;
    }

    int slot = int(labelIndex);
    vec4 state = nvr_readLabel(slot, LABEL_ROW_STATE);
    float declutterHide = state.x;
    float show = state.z;

    // Hidden by the evaluator's `show`, or fully faded out by declutter.
    if (show < 0.5 || declutterHide >= 0.999) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        return;
    }
    vBatchID = state.y;

    vec4 posSize = nvr_readLabel(slot, LABEL_ROW_POSITION_HIGH_SIZE);
    vec4 posHeight = nvr_readLabel(slot, LABEL_ROW_POSITION_LOW_HEIGHT);
    vec4 colorOpacity = nvr_readLabel(slot, LABEL_ROW_COLOR_OPACITY);
    vec4 box = nvr_readLabel(slot, LABEL_ROW_BOX);

    float fontSize = posSize.w;
    float addHeight = posHeight.w;
    float textWidth = box.x;
    float textHeight = box.y;
    vec2 bgYBounds = box.zw;

    vColor = colorOpacity.rgb;
    vOpacity = colorOpacity.a * (1.0 - declutterHide);

#ifdef USE_RTE
    vec3 positionHigh = posSize.xyz;
    vec3 positionLow = posHeight.xyz;
    vec3 absTransformed = positionHigh + positionLow;
#else
    vec3 rtcPosition = posSize.xyz;
    vec3 absTransformed = rtcPosition + uRTCCenter;
#endif
    #include "chunks/horizon_culling_vertex.glsl"

    vec4 mvPosition;
#ifdef USE_RTE
    // The u_rteOne (== 1.0) factor is load-bearing: see chunks/rte_pars_vertex.glsl.
    vec3 highDiff = (positionHigh - uEyeRTEHigh) * u_rteOne;
    vec3 lowDiff = positionLow - uEyeRTELow;
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

    mvPosition = viewMatrixRTC * vec4(rtcPosition, 1.0);
#endif

    mvPosition += mvr_getMvHeightOffset(absTransformed, addHeight);

    // Compute scale factor: when sizeInMeters is off, convert pixel size to
    // world units so text maintains constant screen-pixel size at any distance.
    // Normalized text height is 1.0, so no fontSizeWorld division is needed.
    float scaleFactor = fontSize;
    if (!uSizeInMeters) {
        scaleFactor = nvr_pxToWorld(fontSize, uFovRad, uScreenHeightPx, vec3(0.0, 0.0, mvPosition.z), vec3(0.0, 0.0, 0.0));
    }

    vec2 center = clamp(uCenter, vec2(-0.5), vec2(0.5)); // Ensure center is within the bounds of the sprite

    vIsColor = glyphKind == GLYPH_KIND_COLOR ? 1 : 0;

    if (isBackground) {
        vBackGroundSprite = 1;

        float bgHeight = bgYBounds.y - bgYBounds.x;
        vec2 bgLocalPos = (position.xy + vec2(0.5)) * vec2(textWidth, bgHeight) + vec2(0.0, bgYBounds.x);
        bgLocalPos.x -= center.x * textWidth;
        bgLocalPos.y -= center.y * textHeight;

        vec4 newMvPosition = mvPosition + vec4(bgLocalPos * scaleFactor, 0.0, 0.0);

        gl_Position = projectionMatrix * newMvPosition;

        vAtlasUv = uv;
        vBackGroundRatio = textWidth / bgHeight; // Pass the aspect ratio of the background sprite to the fragment shader for proper corner radius scaling
    } else {
        vBackGroundSprite = 0;
        // --- Per-glyph vertex position ---
        // position.xy is the unit quad [-0.5, 0.5].
        // glyphOffset is the glyph bbox min corner (left/bottom), so remap
        // the centered quad to [0,1] before applying glyph size/offset.
        vec2 localPos = (position.xy + vec2(0.5)) * glyphSize + glyphOffset;

        // Apply centering: shift entire text block by anchor point
        localPos.x -= center.x * textWidth;
        localPos.y -= center.y * textHeight;

        // Apply billboard transform (screen-aligned, scaled)
        vec4 delta = vec4(localPos * scaleFactor, 0.0, 0.0);
        vec4 newMvPosition = mvPosition + delta;

        gl_Position = projectionMatrix * newMvPosition;

        // Atlas UV interpolation: glyphUvRect carries pixel-space corners so
        // resizing the atlas only requires updating the size uniform — geometry
        // attributes stay valid.
        vec2 atlasSize = vIsColor == 1 ? uColorAtlasSize : uSdfAtlasSize;
        vAtlasUvMin = glyphUvRect.xy / atlasSize;
        vAtlasUvMax = glyphUvRect.zw / atlasSize;
        vAtlasUv = mix(vAtlasUvMin, vAtlasUvMax, uv);
    }

    vFragDepth = gl_Position.w + 1.0;
}
