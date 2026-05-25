#include "chunks/batch_definition.glsl"
#include "chunks/pick.glsl"

#ifndef USE_SHADOWMAP_DEPTH
    layout(location = 1) out vec4 normalBuffer;
    layout(location = 2) out vec4 effectIdBuffer;
    layout(location = 3) out vec4 emissiveBuffer;

    vec2 packNormalToVec2(vec3 normal) {
        return normal.xy * 0.5 + 0.5;
    }

    vec3 screenSpaceNormal() {
        vec3 fdx = dFdx(gl_FragCoord.xyz);
        vec3 fdy = dFdy(gl_FragCoord.xyz);
        vec3 normal = normalize(cross(fdx, fdy));
        if (normal.z < 0.0) normal = -normal;
        return normal;
    }
#endif

// Varyings
varying vec2 vAtlasUv;
varying float vFragDepth;
flat varying int vHorizonCulled;
flat varying int vBackGroundSprite;
flat varying float vBackGroundRatio;
flat varying int vIsColor;

// Uniforms
uniform sampler2D uAtlas;
uniform sampler2D uColorAtlas;
uniform float uSdfThreshold;
uniform vec3 uColor;
uniform vec3 uOutlineColor;
uniform float uOutlineWidth;
uniform float uOutlineOpacity;
uniform bool uOffsetDepth;
uniform float uFarPlane;
uniform vec3 uBackgroundColor;
uniform float uBackgroundOutlineWidth;
uniform vec3 uBackgroundOutlineColor;

void main() {
    // Horizon culling discard
    if (vHorizonCulled == 1) discard;

    // Logarithmic depth buffer
    // When offsetDepth is enabled, multiply input by 0.8 to shift depth slightly
    // closer to camera.
    float depthInput = uOffsetDepth ? vFragDepth * 0.8 : vFragDepth;
    gl_FragDepth = log(depthInput) / log(uFarPlane + 1.0);

    // Picking mode
    if (nvr_uPickable > 0.0) {
        gl_FragColor = vec4(nvr_batchIdToColor(nvr_uBatchId), 1.0);
        return;
    }
    
    if (vBackGroundSprite == 1) {
        vec2 p = abs(vAtlasUv - vec2(0.5));

        if ((p.x > (0.5 - uBackgroundOutlineWidth / vBackGroundRatio)) ||
            (p.y > (0.5 - uBackgroundOutlineWidth))) {
            gl_FragColor = vec4(uBackgroundOutlineColor, 1.0);
        } else {
            gl_FragColor = vec4(uBackgroundColor, 1.0);
        }

        return;
    }

    // Color glyph path: sample the COLRv1 RGBA atlas directly. The pre-rasterized
    // bitmap already encodes shape, anti-aliasing, gradients and palette colors —
    // SDF math, outline, and uColor are all bypassed.
    if (vIsColor == 1) {
        vec4 c = texture2D(uColorAtlas, vAtlasUv);
        if (c.a <= 0.0) discard;
        gl_FragColor = c;

        #ifndef USE_SHADOWMAP_DEPTH
            vec3 normal = screenSpaceNormal();
            normalBuffer = vec4(packNormalToVec2(normal), 0.0, 0.0);
            effectIdBuffer = vec4(0.0);
            emissiveBuffer = vec4(0.0);
        #endif
        return;
    }

    // Sample distance value from atlas.
    // - SDF path: single R8 channel.
    // - MTSDF path: median of the 3 MSDF channels preserves sharp corners
    //   at normal scale; alpha holds a true single-channel SDF used to
    //   stabilize the field at small render sizes.
    //
    // Why mix at small sizes: under heavy minification each fragment
    // averages many atlas texels. The three MSDF channels each encode a
    // different subset of edges, so the median of bilinearly-averaged
    // channels can pick a value well below 0.5 even when the actual field
    // is solid — producing the "tiny text isn't filled" artifact. The true
    // SDF in alpha averages cleanly, so we lean on it as fwidth grows.
    #ifdef USE_MSDF
        vec4 s = texture2D(uAtlas, vAtlasUv);
        float msdf = max(min(s.r, s.g), min(max(s.r, s.g), s.b));
        float trueSdf = s.a;
        // fwidth(msdf) in distance-value units. Threshold tuned so the
        // transition starts a bit below "one full distance range per pixel"
        // (= 0.5 in distance-value units) and completes by 0.5. Above 0.5
        // we're sampling more than the entire ramp per pixel — useless for
        // edge detection, fall fully back to the smooth SDF.
        float w = fwidth(msdf);
        float dist = mix(msdf, trueSdf, smoothstep(0.25, 0.5, w));
    #else
        float trueSdf = texture2D(uAtlas, vAtlasUv).r;
        float dist = trueSdf;
    #endif
    float edgeWidth = fwidth(dist);

    float outlineWidth = clamp(uOutlineWidth, 0.0, 0.4);

    if (outlineWidth > 0.0) {
        // Glyph fill alpha (smooth transition at glyph edge)
        float fillAlpha = smoothstep(uSdfThreshold - edgeWidth,
                                     uSdfThreshold + edgeWidth,
                                     dist);

        // Outline alpha (smooth transition at outer outline edge).
        // Use the true single-channel SDF here: median(rgb) can spike well
        // above 0 in regions outside the glyph where the three channels
        // disagree (classic MSDF artifact). Those spikes are harmless near
        // the contour but become visible "outline freckles" once
        // outlineWidth pushes the threshold close to 0. trueSdf is smooth
        // everywhere and free of that artifact.
        float outerEdge = uSdfThreshold - outlineWidth;
        float outlineEdgeWidth = fwidth(trueSdf);
        float outlineAlpha = smoothstep(outerEdge - outlineEdgeWidth,
                                        outerEdge + outlineEdgeWidth,
                                        trueSdf);

        if (outlineAlpha <= 0.0) discard;

        // Blend: fill on top of outline
        vec3 color = mix(uOutlineColor, uColor, fillAlpha);
        float alpha = mix(outlineAlpha * uOutlineOpacity, 1.0, fillAlpha);
        gl_FragColor = vec4(color, alpha);
    } else {
        float alpha = smoothstep(uSdfThreshold - edgeWidth,
                                 uSdfThreshold + edgeWidth,
                                 dist);
        if (alpha <= 0.0) discard;
        gl_FragColor = vec4(uColor, alpha);
    }

    #ifndef USE_SHADOWMAP_DEPTH
        vec3 normal = screenSpaceNormal();
        normalBuffer = vec4(packNormalToVec2(normal), 0.0, 0.0);
        effectIdBuffer = vec4(0.0);
        emissiveBuffer = vec4(0.0);
    #endif
}
