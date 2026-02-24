#include "chunks/batch_definition.glsl"
#include "chunks/pick.glsl"

#ifndef USE_SHADOWMAP_DEPTH
    layout(location = 1) out vec4 outputBuffer1;

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

// Uniforms
uniform sampler2D uAtlas;
uniform float uSdfThreshold;
uniform vec3 uColor;
uniform float uOpacity;
uniform bool uOffsetDepth;
uniform float uFarPlane;

void main() {
    // Horizon culling discard
    if (vHorizonCulled == 1) discard;

    // Sample SDF value from atlas (R channel)
    float dist = texture2D(uAtlas, vAtlasUv).r;

    // Anti-aliased edge using screen-space derivatives of the SDF distance.
    // fwidth gives resolution-independent smoothing width.
    float edgeWidth = fwidth(dist) * 0.5;
    float alpha = smoothstep(uSdfThreshold - edgeWidth, uSdfThreshold + edgeWidth, dist);

    if (alpha < 0.01) discard;

    alpha *= uOpacity;

    // Logarithmic depth buffer
    gl_FragDepth = log(vFragDepth) / log(uFarPlane + 1.0);
    if (uOffsetDepth) { gl_FragDepth -= 0.2; }

    // Picking mode
    if (nvr_uPickable > 0.0) {
        gl_FragColor = vec4(nvr_batchIdToColor(nvr_uBatchId), 1.0);
    } else {
        gl_FragColor = vec4(uColor, alpha);
    }

    #ifndef USE_SHADOWMAP_DEPTH
        vec3 normal = screenSpaceNormal();
        outputBuffer1 = vec4(packNormalToVec2(normal), 0.0, 0.0);
    #endif
}
