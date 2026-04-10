#include "point.frag.glsl"
#include "chunks/pick.glsl"
#ifdef BILLBOARD
    precision highp sampler2DArray;
    uniform sampler2DArray uTexture;
    varying float vLayer;
#endif

#ifndef USE_SHADOWMAP_DEPTH
    layout(location = 1) out vec4 normalBuffer;
    layout(location = 2) out vec4 effectIdBuffer;
    layout(location = 3) out vec4 emissiveBuffer;

    #ifdef USE_SELECTIVE_EFFECT
        uniform float uEffectIdsMask;
        uniform vec3 uEmissiveColor;
        uniform float uEmissiveIntensity;
    #endif

    // Pack normal to vec2 for MRT
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

varying vec2 vUv;
varying vec3 vColor;
varying float vBatchID;
varying float vFragDepth;

uniform bool uOffsetDepth;
uniform float nvr_uPickable;
uniform float uAlphaTest;
uniform float uFarPlane;

void main() {
    // Logarithmic depth buffer
    gl_FragDepth = log(vFragDepth) / log(uFarPlane + 1.0);

    // Offset depth to make sure to be drawn over ellipsoid surface
    if (uOffsetDepth) { gl_FragDepth -= 0.2; }

    float alpha = 1.0;
    #ifdef BILLBOARD
        // Sample the specific layer from the Texture Array
        vec4 color = texture(uTexture, vec3(vUv, vLayer));
        vec4 tint = vec4(vColor, color.a);
        color *= tint ;
        alpha = color.a;
    #else
        alpha = nvr_circle_alpha(vUv - vec2(0.5));
        vec4 color = vec4(vColor, 1.0);
    #endif

    if (alpha <= uAlphaTest) { discard; };
    
    if (nvr_uPickable > 0.0 && alpha > 0.0) {
        vec3 pickColor = nvr_batchIdToColor(vBatchID);
        color = vec4(pickColor.xyz, 1.0);
    }

    gl_FragColor = color;

    #ifndef USE_SHADOWMAP_DEPTH
        // Calculate screen-space normal for MRT compatibility
        vec3 normal = screenSpaceNormal();
        normalBuffer = vec4(packNormalToVec2(normal), 0.0, 0.0);

        #ifdef USE_SELECTIVE_EFFECT
            effectIdBuffer = vec4(uEffectIdsMask, 0.0, 0.0, 1.0);
            emissiveBuffer = vec4(uEmissiveColor * uEmissiveIntensity, 1.0);
        #else
            effectIdBuffer = vec4(0.0);
            emissiveBuffer = vec4(0.0);
        #endif
    #endif
}