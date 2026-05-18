// Slug-style curve text — fragment shader (Phase 5).
//
// Per-pixel banded ray-cast against quadratic Bezier outlines.
//
// For each fragment we know:
//   - the glyph header slot (from a per-instance attribute, passed flat)
//   - the em-space position inside the glyph's bbox (vEmCoord)
//
// The header tells us where this glyph's band table and curve table live in
// the shared buffer textures. We pick the band by vEmCoord.y, walk that
// band's curves, and for each:
//   1. Solve the curve's y(t) = vEmCoord.y for t ∈ [0, 1].
//   2. For each root, evaluate x(t) and compare to vEmCoord.x — a crossing
//      to the right contributes +1 / -1 to the signed winding number
//      depending on whether the curve is going up or down at that t.
// AA uses screen-space derivatives: instead of an integer crossing count we
// accumulate a smooth contribution per crossing based on the horizontal
// distance to the ray, in pixel units (`fwidth(vEmCoord).x`).
//
// COLR path: if the header has FLAG_HAS_COLOR_LAYERS set, the same
// `coverageInGlyph` helper drives clip tests; per-layer paint evaluation
// (solid / linear / radial / sweep) writes to a SrcOver accumulator.
//
// Integer textures (`usampler2D`) require GLSL ES 3.0; the host material
// sets `glslVersion: THREE.GLSL3` to opt in.

precision highp float;
precision highp int;
precision highp sampler2D;
precision highp usampler2D;

// -- Shared buffer textures (same width for every buffer; see CurveTextureSet). --
uniform sampler2D uGlyphHeaders;     // 12 f32 / glyph, RGBA32F (3 texels)
uniform usampler2D uBandData;        // 1 u32 / band
uniform usampler2D uBandCurves;      // 1 u32 / band-curves entry
uniform sampler2D uCurveData;        // 6 f32 / curve, RG32F (3 texels)
uniform usampler2D uColorLayerHeaders;  // 12 u32 / color layer
uniform sampler2D uColorPaintParams;    // variable f32 blob, R32F
uniform usampler2D uColorClipRecords;   // 8 u32 / clip record

uniform float uCurveTexWidth;        // matches CURVE_TEX_WIDTH

uniform vec3 uColor;
uniform float uOpacity;
uniform float uFarPlane;

flat varying float vGlyphHeaderSlot;
varying vec2 vEmCoord;
varying vec4 vBboxMinMax;
varying float vFragDepth;

// Header layout (12 f32, see crates/navara_wasm_font_worker/src/curves/pack.rs):
//   texel 0: bbox_min.xy, bbox_max.xy
//   texel 1: band_count, bands_offset, band_curves_offset, curves_offset
//   texel 2: flags, color_layer_start, color_layer_count, reserved

const uint FLAG_HAS_COLOR_LAYERS = 1u;
const uint MISSING_CLIP_SLOT = 0xFFFFFFFFu;

// ---------------------------------------------------------------------------
// Texture addressing helpers
// ---------------------------------------------------------------------------

ivec2 idxTo2D(float idx) {
    float y = floor(idx / uCurveTexWidth);
    float x = idx - y * uCurveTexWidth;
    return ivec2(int(x), int(y));
}

ivec2 idxTo2Du(uint idx) {
    float i = float(idx);
    return idxTo2D(i);
}

void fetchHeader(uint slot, out vec4 t0, out vec4 t1, out vec4 t2) {
    float base = float(slot) * 3.0;
    t0 = texelFetch(uGlyphHeaders, idxTo2D(base + 0.0), 0);
    t1 = texelFetch(uGlyphHeaders, idxTo2D(base + 1.0), 0);
    t2 = texelFetch(uGlyphHeaders, idxTo2D(base + 2.0), 0);
}

// ---------------------------------------------------------------------------
// Quadratic Bezier helpers
// ---------------------------------------------------------------------------

float bezierX(vec2 p0, vec2 p1, vec2 p2, float t) {
    float omt = 1.0 - t;
    return omt * omt * p0.x + 2.0 * omt * t * p1.x + t * t * p2.x;
}

float bezierDy(vec2 p0, vec2 p1, vec2 p2, float t) {
    return 2.0 * ((1.0 - t) * (p1.y - p0.y) + t * (p2.y - p1.y));
}

/// Solve B(t).y = py for t ∈ [0, 1]. Returns up to two roots in `ts`. The
/// `count` is the number of valid (in-range) roots. Tangent / linear / no-
/// solution cases are all clamped to "no contribution".
int solveQuadY(vec2 p0, vec2 p1, vec2 p2, float py, out vec2 ts) {
    float A = p0.y - 2.0 * p1.y + p2.y;
    float B = 2.0 * (p1.y - p0.y);
    float C = p0.y - py;
    ts = vec2(-1.0);

    if (abs(A) < 1e-7) {
        // Linear: B*t + C = 0
        if (abs(B) < 1e-7) return 0;
        float t = -C / B;
        if (t >= 0.0 && t <= 1.0) {
            ts.x = t;
            return 1;
        }
        return 0;
    }

    float disc = B * B - 4.0 * A * C;
    if (disc < 0.0) return 0;
    float sq = sqrt(disc);
    float inv2A = 1.0 / (2.0 * A);
    float r1 = (-B - sq) * inv2A;
    float r2 = (-B + sq) * inv2A;
    int count = 0;
    if (r1 >= 0.0 && r1 <= 1.0) { ts.x = r1; count = 1; }
    if (r2 >= 0.0 && r2 <= 1.0) {
        if (count == 0) ts.x = r2;
        else ts.y = r2;
        count++;
    }
    return count;
}

// ---------------------------------------------------------------------------
// Banded ray-cast: returns AA coverage in [0, 1] for `emCoord` against the
// glyph at `slot`. Uses non-zero winding fill.
// ---------------------------------------------------------------------------

float coverageInGlyph(uint slot, vec2 emCoord, vec2 pxEm) {
    vec4 hdr0, hdr1, hdr2;
    fetchHeader(slot, hdr0, hdr1, hdr2);
    vec2 bboxMin = hdr0.xy;
    vec2 bboxMax = hdr0.zw;
    float bandCountF = hdr1.x;
    uint bandsOffset = uint(hdr1.y);
    uint bandCurvesOffset = uint(hdr1.z);
    uint curvesOffset = uint(hdr1.w);

    int bandCount = int(bandCountF);
    if (bandCount <= 0) return 0.0;
    vec2 size = bboxMax - bboxMin;
    if (size.x <= 0.0 || size.y <= 0.0) return 0.0;

    // Slop ε in y so curves exactly grazing the bbox edges still register.
    float eps = max(pxEm.y, 1e-6);
    if (emCoord.y < bboxMin.y - eps || emCoord.y > bboxMax.y + eps) return 0.0;

    float yt = clamp((emCoord.y - bboxMin.y) / size.y, 0.0, 0.999999);
    int bandIdx = int(yt * float(bandCount));
    bandIdx = clamp(bandIdx, 0, bandCount - 1);

    uint bandEntry = texelFetch(uBandData, idxTo2Du(bandsOffset + uint(bandIdx)), 0).r;
    uint curveStart = bandEntry >> 16u;
    uint curveCount = bandEntry & 0xFFFFu;

    float winding = 0.0;

    for (uint i = 0u; i < curveCount; i++) {
        uint glyphCurveIdx = texelFetch(
            uBandCurves,
            idxTo2Du(bandCurvesOffset + curveStart + i),
            0
        ).r;
        float curveBase = float(curvesOffset + glyphCurveIdx * 3u);
        vec2 p0 = texelFetch(uCurveData, idxTo2D(curveBase + 0.0), 0).rg;
        vec2 p1 = texelFetch(uCurveData, idxTo2D(curveBase + 1.0), 0).rg;
        vec2 p2 = texelFetch(uCurveData, idxTo2D(curveBase + 2.0), 0).rg;

        vec2 ts;
        int n = solveQuadY(p0, p1, p2, emCoord.y, ts);
        for (int j = 0; j < 2; j++) {
            if (j >= n) break;
            float t = (j == 0) ? ts.x : ts.y;
            float bx = bezierX(p0, p1, p2, t);
            float dy = bezierDy(p0, p1, p2, t);
            float dir = (dy > 0.0) ? 1.0 : -1.0;
            // Smoothed crossing: full contribution if the curve crosses to
            // the right of the pixel, zero if to the left, linear ramp over
            // 1 pixel width centered on the ray.
            float xdiff = bx - emCoord.x;
            float c = smoothstep(-0.5 * pxEm.x, 0.5 * pxEm.x, xdiff);
            winding += dir * c;
        }
    }

    // Non-zero fill rule with soft clamp.
    return clamp(abs(winding), 0.0, 1.0);
}

// ---------------------------------------------------------------------------
// COLR paint evaluation
// ---------------------------------------------------------------------------

float readPaintF(uint base, uint offset) {
    return texelFetch(uColorPaintParams, idxTo2Du(base + offset), 0).r;
}

vec4 readStop(uint base, uint stopIdx) {
    uint o = base + stopIdx * 5u;
    return vec4(
        readPaintF(o, 1u),
        readPaintF(o, 2u),
        readPaintF(o, 3u),
        readPaintF(o, 4u)
    );
}

float readStopOffset(uint base, uint stopIdx) {
    return readPaintF(base + stopIdx * 5u, 0u);
}

float applyExtend(float t, uint extend) {
    // 0=Pad, 1=Repeat, 2=Reflect.
    if (extend == 0u) return clamp(t, 0.0, 1.0);
    if (extend == 1u) return fract(t);
    // Reflect: triangle wave with period 2.
    float u = mod(t, 2.0);
    return (u <= 1.0) ? u : (2.0 - u);
}

vec4 interpStops(uint stopsBase, uint numStops, float t) {
    if (numStops == 0u) return vec4(0.0);
    if (numStops == 1u) return readStop(stopsBase, 0u);

    float o0 = readStopOffset(stopsBase, 0u);
    if (t <= o0) return readStop(stopsBase, 0u);
    float oLast = readStopOffset(stopsBase, numStops - 1u);
    if (t >= oLast) return readStop(stopsBase, numStops - 1u);

    for (uint i = 0u; i < numStops - 1u; i++) {
        float a = readStopOffset(stopsBase, i);
        float b = readStopOffset(stopsBase, i + 1u);
        if (t >= a && t <= b) {
            float k = (b > a) ? (t - a) / (b - a) : 0.0;
            return mix(readStop(stopsBase, i), readStop(stopsBase, i + 1u), k);
        }
    }
    return readStop(stopsBase, numStops - 1u);
}

vec4 evaluatePaint(uint kind, uint paintOffset, vec2 pLocal) {
    if (kind == 0u) {
        // Solid: 4 floats RGBA at paintOffset.
        return vec4(
            readPaintF(paintOffset, 0u),
            readPaintF(paintOffset, 1u),
            readPaintF(paintOffset, 2u),
            readPaintF(paintOffset, 3u)
        );
    } else if (kind == 1u) {
        // Linear gradient. Layout: extend(1) numStops(1) p0.xy(2) p1.xy(2) stops*
        uint extend = floatBitsToUint(readPaintF(paintOffset, 0u));
        uint numStops = floatBitsToUint(readPaintF(paintOffset, 1u));
        vec2 p0 = vec2(readPaintF(paintOffset, 2u), readPaintF(paintOffset, 3u));
        vec2 p1 = vec2(readPaintF(paintOffset, 4u), readPaintF(paintOffset, 5u));
        vec2 d = p1 - p0;
        float denom = dot(d, d);
        float t = (denom > 1e-9) ? dot(pLocal - p0, d) / denom : 0.0;
        t = applyExtend(t, extend);
        return interpStops(paintOffset + 6u, numStops, t);
    } else if (kind == 2u) {
        // Radial gradient (two-circle, conical). Layout: extend(1) numStops(1)
        //   c0.xy(2) r0(1) c1.xy(2) r1(1) stops*
        // We solve the simpler degenerate case (c0 == c1): standard concentric
        // radial. For two-circle radials we fall back to the c1/r1 endpoint
        // (good enough for typical emoji glow / highlight passes; the full
        // quadratic conic solver lands in a follow-up).
        uint extend = floatBitsToUint(readPaintF(paintOffset, 0u));
        uint numStops = floatBitsToUint(readPaintF(paintOffset, 1u));
        vec2 c0 = vec2(readPaintF(paintOffset, 2u), readPaintF(paintOffset, 3u));
        float r0 = readPaintF(paintOffset, 4u);
        vec2 c1 = vec2(readPaintF(paintOffset, 5u), readPaintF(paintOffset, 6u));
        float r1 = readPaintF(paintOffset, 7u);
        float t;
        if (distance(c0, c1) < 1e-6) {
            // Concentric: t = (distance - r0) / (r1 - r0).
            float d = distance(pLocal, c0);
            float dr = r1 - r0;
            t = (abs(dr) > 1e-9) ? (d - r0) / dr : 0.0;
        } else {
            // Conical fallback — distance to c1, normalized by r1.
            t = (r1 > 1e-9) ? distance(pLocal, c1) / r1 : 0.0;
        }
        t = applyExtend(t, extend);
        return interpStops(paintOffset + 8u, numStops, t);
    } else {
        // Sweep gradient (kind 3) — TODO: real angular evaluator. Match the
        // existing tiny-skia behavior: fall back to the first color stop.
        uint numStops = floatBitsToUint(readPaintF(paintOffset, 1u));
        if (numStops == 0u) return vec4(0.0);
        return readStop(paintOffset + 6u, 0u);
    }
}

// ---------------------------------------------------------------------------
// Clip evaluation for a COLR layer
// ---------------------------------------------------------------------------

mat2 inv2(mat2 m, out bool ok) {
    float det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    ok = abs(det) > 1e-9;
    if (!ok) return mat2(1.0, 0.0, 0.0, 1.0);
    float inv = 1.0 / det;
    return mat2(m[1][1] * inv, -m[0][1] * inv, -m[1][0] * inv, m[0][0] * inv);
}

/// Logical-AND every clip in the layer's range. `vEmCoord` is the root
/// glyph's em-space coord; each clip carries its own transform that maps
/// clip-local em-space → root em-space.
float clipCoverage(
    uint clipOffset,
    uint clipCount,
    vec2 emCoord,
    vec2 pxEm
) {
    if (clipCount == 0u) return 1.0;
    float cov = 1.0;
    for (uint i = 0u; i < clipCount; i++) {
        float clipBase = float((clipOffset + i) * 8u);
        uint tag = texelFetch(uColorClipRecords, idxTo2D(clipBase + 0.0), 0).r;
        if (tag == 0u) {
            // Glyph clip: slot (already translated from gid on the CPU),
            // then 6 transform floats.
            uint clipSlot = texelFetch(uColorClipRecords, idxTo2D(clipBase + 1.0), 0).r;
            if (clipSlot == MISSING_CLIP_SLOT) continue;
            mat2 lin = mat2(
                uintBitsToFloat(texelFetch(uColorClipRecords, idxTo2D(clipBase + 2.0), 0).r),
                uintBitsToFloat(texelFetch(uColorClipRecords, idxTo2D(clipBase + 3.0), 0).r),
                uintBitsToFloat(texelFetch(uColorClipRecords, idxTo2D(clipBase + 4.0), 0).r),
                uintBitsToFloat(texelFetch(uColorClipRecords, idxTo2D(clipBase + 5.0), 0).r)
            );
            vec2 tr = vec2(
                uintBitsToFloat(texelFetch(uColorClipRecords, idxTo2D(clipBase + 6.0), 0).r),
                uintBitsToFloat(texelFetch(uColorClipRecords, idxTo2D(clipBase + 7.0), 0).r)
            );
            bool ok;
            mat2 inv = inv2(lin, ok);
            if (!ok) continue;
            vec2 clipLocal = inv * (emCoord - tr);
            // Transform fwidth too: pxEm in clip-local is |J^-1| * pxEm_root,
            // approximated by the inverse's column magnitudes.
            vec2 pxClip = abs(inv * pxEm);
            cov = min(cov, coverageInGlyph(clipSlot, clipLocal, pxClip));
        } else {
            // Rect clip: min.xy, max.xy in root em-space.
            vec2 rMin = vec2(
                uintBitsToFloat(texelFetch(uColorClipRecords, idxTo2D(clipBase + 1.0), 0).r),
                uintBitsToFloat(texelFetch(uColorClipRecords, idxTo2D(clipBase + 2.0), 0).r)
            );
            vec2 rMax = vec2(
                uintBitsToFloat(texelFetch(uColorClipRecords, idxTo2D(clipBase + 3.0), 0).r),
                uintBitsToFloat(texelFetch(uColorClipRecords, idxTo2D(clipBase + 4.0), 0).r)
            );
            // Soft rect: AA on all four edges via smoothstep.
            vec2 lo = smoothstep(rMin - 0.5 * pxEm, rMin + 0.5 * pxEm, emCoord);
            vec2 hi = smoothstep(-rMax - 0.5 * pxEm, -rMax + 0.5 * pxEm, -emCoord);
            float inRect = lo.x * lo.y * hi.x * hi.y;
            cov = min(cov, inRect);
        }
        if (cov < 0.001) return 0.0;
    }
    return cov;
}

// ---------------------------------------------------------------------------
// Blend modes
// ---------------------------------------------------------------------------

// All inputs unpremultiplied (RGB, A separate). Returns unpremultiplied.
// We only implement the few common ones; everything else falls back to
// SrcOver — matches the project's current rendering of complex emojis.
vec4 composite(vec4 dst, vec4 src, uint blend) {
    // Tags: 3 = SrcOver, 23 = Multiply, 13 = Screen.
    // Other tags fall through to SrcOver.
    if (blend == 23u) {
        // Multiply: result = dst * src; alpha = dst + src - dst*src
        vec3 rgb = dst.rgb * src.rgb;
        float a = src.a + dst.a * (1.0 - src.a);
        return vec4(mix(dst.rgb, rgb, src.a), a);
    }
    if (blend == 13u) {
        // Screen: 1 - (1-dst)*(1-src)
        vec3 rgb = 1.0 - (1.0 - dst.rgb) * (1.0 - src.rgb);
        float a = src.a + dst.a * (1.0 - src.a);
        return vec4(mix(dst.rgb, rgb, src.a), a);
    }
    // SrcOver (default).
    float outA = src.a + dst.a * (1.0 - src.a);
    vec3 outRGB = (outA > 1e-6)
        ? (src.rgb * src.a + dst.rgb * dst.a * (1.0 - src.a)) / outA
        : vec3(0.0);
    return vec4(outRGB, outA);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

vec4 colrRender(uint colorLayerStart, uint colorLayerCount, vec2 emCoord, vec2 pxEm) {
    vec4 dst = vec4(0.0);
    for (uint i = 0u; i < colorLayerCount; i++) {
        float layerBase = float((colorLayerStart + i) * 12u);
        // Read transform (6 floats as bits) + kindBlend + paint range + clip range.
        mat2 lin = mat2(
            uintBitsToFloat(texelFetch(uColorLayerHeaders, idxTo2D(layerBase + 0.0), 0).r),
            uintBitsToFloat(texelFetch(uColorLayerHeaders, idxTo2D(layerBase + 1.0), 0).r),
            uintBitsToFloat(texelFetch(uColorLayerHeaders, idxTo2D(layerBase + 2.0), 0).r),
            uintBitsToFloat(texelFetch(uColorLayerHeaders, idxTo2D(layerBase + 3.0), 0).r)
        );
        vec2 tr = vec2(
            uintBitsToFloat(texelFetch(uColorLayerHeaders, idxTo2D(layerBase + 4.0), 0).r),
            uintBitsToFloat(texelFetch(uColorLayerHeaders, idxTo2D(layerBase + 5.0), 0).r)
        );
        uint kindBlend = texelFetch(uColorLayerHeaders, idxTo2D(layerBase + 6.0), 0).r;
        uint kind = kindBlend >> 16u;
        uint blend = kindBlend & 0xFFFFu;
        uint paintOffset = texelFetch(uColorLayerHeaders, idxTo2D(layerBase + 7.0), 0).r;
        // paint_count is at +8; we don't need it (each paint type knows its layout).
        uint clipOffset = texelFetch(uColorLayerHeaders, idxTo2D(layerBase + 9.0), 0).r;
        uint clipCount  = texelFetch(uColorLayerHeaders, idxTo2D(layerBase + 10.0), 0).r;

        float cov = clipCoverage(clipOffset, clipCount, emCoord, pxEm);
        if (cov < 0.001) continue;

        bool ok;
        mat2 inv = inv2(lin, ok);
        if (!ok) continue;
        vec2 pLocal = inv * (emCoord - tr);

        vec4 src = evaluatePaint(kind, paintOffset, pLocal);
        src.a *= cov;
        dst = composite(dst, src, blend);
    }
    return dst;
}

void main() {
    uint slot = uint(vGlyphHeaderSlot);
    vec4 hdr0, hdr1, hdr2;
    fetchHeader(slot, hdr0, hdr1, hdr2);
    uint flags = uint(hdr2.x);
    uint colorLayerStart = uint(hdr2.y);
    uint colorLayerCount = uint(hdr2.z);

    // Screen-space derivative of em-space gives us the local pixel size.
    vec2 pxEm = max(abs(fwidth(vEmCoord)), vec2(1e-9));

    vec4 outColor;
    if ((flags & FLAG_HAS_COLOR_LAYERS) != 0u && colorLayerCount > 0u) {
        outColor = colrRender(colorLayerStart, colorLayerCount, vEmCoord, pxEm);
        outColor.a *= uOpacity;
    } else {
        float cov = coverageInGlyph(slot, vEmCoord, pxEm);
        outColor = vec4(uColor, uOpacity * cov);
    }
    gl_FragColor = outColor;
    gl_FragDepth = log(vFragDepth) / log(uFarPlane + 1.0);
}
