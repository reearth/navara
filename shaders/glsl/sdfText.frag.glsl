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
flat varying int vBackGroundSprite;
flat varying float vBackGroundRatio;

// Uniforms
uniform sampler2D uAtlas;
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

    // Sample SDF value from atlas (R channel)
    float dist = texture2D(uAtlas, vAtlasUv).r;
    float edgeWidth = fwidth(dist);

    float outlineWidth = clamp(uOutlineWidth, 0.0, 0.4);

    if (outlineWidth > 0.0) {
        // Glyph fill alpha (smooth transition at glyph edge)
        float fillAlpha = smoothstep(uSdfThreshold - edgeWidth,
                                     uSdfThreshold + edgeWidth,
                                     dist);

        // Outline alpha (smooth transition at outer outline edge)
        float outerEdge = uSdfThreshold - outlineWidth;
        float outlineAlpha = smoothstep(outerEdge - edgeWidth,
                                        outerEdge + edgeWidth,
                                        dist);

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
        outputBuffer1 = vec4(packNormalToVec2(normal), 0.0, 0.0);
    #endif
}
