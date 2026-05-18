// Slug-style curve text — fragment shader (Phase 4 stub).
//
// Phase 5 will replace this with the actual banded ray-cast curve
// evaluator. For now this is a debug placeholder that just hatches each
// glyph's bbox so the wiring (header texture sampling, instance attribute,
// per-frame uniform updates) can be visually verified end-to-end.

flat varying float vGlyphHeaderSlot;
varying vec2 vEmCoord;
varying vec4 vBboxMinMax;
varying float vFragDepth;

uniform vec3 uColor;
uniform float uOpacity;
uniform float uFarPlane;

void main() {
    // Map vEmCoord to [0, 1] inside the glyph bbox for the debug hatch.
    vec2 bboxMin = vBboxMinMax.xy;
    vec2 bboxMax = vBboxMinMax.zw;
    vec2 t = (vEmCoord - bboxMin) / max(bboxMax - bboxMin, vec2(1e-6));

    // Stripe pattern proves vEmCoord interpolates correctly across the quad.
    float stripe = step(0.5, fract((t.x + t.y) * 4.0));
    vec3 col = mix(uColor * 0.4, uColor, stripe);

    gl_FragColor = vec4(col, uOpacity);
    gl_FragDepth = log(vFragDepth) / log(uFarPlane + 1.0);
}
