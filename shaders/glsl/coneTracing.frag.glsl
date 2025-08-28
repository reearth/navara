#include <common>
#include <packing>

#include "core/packing"
#include "core/depth"
#include "core/transform"

uniform sampler2D uDepthBuffer;             // Depth buffer
uniform sampler2D inputBuffer;              // Input buffer
uniform sampler2D uColorBuffer;             // Color buffer (mipmapped, pre-convolved)
uniform sampler2D uRayTracingBuffer;        // Ray tracing results from SSR pass
uniform sampler2D uNormalBuffer;            // View-space normals
uniform sampler2D uSpecularBuffer;          // rgb=F0 (or IOR-converted), a=roughness
uniform sampler2D uIndirectSpecularBuffer;  // Fallback indirect specular

uniform vec2  uBufferSize;          // (width, height) of buffers in pixels
uniform int   uNumMips;             // total mip levels in uColorBuffer
uniform float uFadeStart;           // cb_fadeStart
uniform float uFadeEnd;             // cb_fadeEnd
uniform float uMaxDistance;         // cb_maxDistance
uniform float cameraNear;
uniform float cameraFar;
uniform mat4  inverseProjectionMatrix; // inverse of projection matrix
uniform mat4  projectionMatrix; // inverse of projection matrix

in vec2 vUv;

// --- constants / helpers ---
const float XI = 0.244;                          // used in cone angle

float readDepth(const vec2 uv) {
  #if DEPTH_PACKING == 3201
  return unpackRGBAToDepth(texture2D(uDepthBuffer, uv));
  #else
  return texture2D(uDepthBuffer, uv).r;
  #endif // DEPTH_PACKING == 3201
}

float getViewZ(const float depth) {
  #ifdef PERSPECTIVE_CAMERA
  return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
  #else
  return orthographicDepthToViewZ(depth, cameraNear, cameraFar);
  #endif
}

// Ref: https://graphicrants.blogspot.com/2013/08/specular-brdf-reference.html
float roughnessToSpecularPower( float r ) {
    float a = r * r;
    return max(2.0 / (a * a) - 2.0, 0.0);
}

// Constant normal incidence Fresnel factor for all dielectrics.
const vec3 Fdielectric = vec3(0.04);

vec3 fresnelSchlick( vec3 F0, float cosTheta ) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

float specularPowerToConeAngle( float specularPower ) {
    float exponent = 1.0 / (specularPower + 1.0);
    return acos(pow(XI, exponent));
}

float isoscelesTriangleOpposite( float adjacentLength, float coneTheta ) {
    return 2.0 * tan(coneTheta) * adjacentLength;
}

float isoscelesTriangleInRadius( float a, float h ) {
    float a2 = a * a;
    float fh2 = 4.0 * h * h;
    return (a * (sqrt(a2 + fh2) - a)) / (4.0 * h);
}

vec4 coneSampleWeightedColor( vec2 samplePos, float mipLevel, float gloss ) {
    // Sample with LOD
    vec3 sampleColor = textureLod(uColorBuffer, samplePos, mipLevel).rgb;
    return vec4(sampleColor * gloss, gloss);
}

float isoscelesTriangleNextAdjacent( float adjacentLength, float incircleRadius ) {
    return adjacentLength - (incircleRadius * 2.0);
}

// Ref: https://willpgfx.com/2015/07/screen-space-glossy-reflections/
void main() {
    vec2 pixel = vUv;

    // get screen-space ray intersection point
    vec4 raySS = texture2D(uRayTracingBuffer, pixel);

    // either means no hit or the ray faces back towards the camera
    if (raySS.w <= 0.0) {
        return;
    }

    vec3 fallbackColor = texture2D(inputBuffer, pixel).rgb;

    float depth = readDepth(vUv);
    depth = reverseLogDepth(depth, cameraNear, cameraFar);
    float viewZ = getViewZ(depth);
    vec3 viewPosition = screenToView(
        vUv,
        depth,
        viewZ,
        projectionMatrix,
        inverseProjectionMatrix
    );

    vec4 packedNormal = texture2D(uNormalBuffer, pixel); // xy: compressed normal, z: metalness, w: roughness

    vec3 normalVS = unpackVec2ToNormal(packedNormal.xy);

    vec3 F0 = mix(Fdielectric, fallbackColor, packedNormal.z);
    vec4 specularAll = vec4(F0, packedNormal.w);

    float linearDepth = linearizeDepth(depth, cameraNear, cameraFar);
    vec3 toViewPosition = normalize(viewPosition);

    float gloss = 1.0 - specularAll.a;
    float specularPower = roughnessToSpecularPower(specularAll.a);
    float coneTheta = specularPowerToConeAngle(specularPower) * 0.5;

    // P1 = current uv, P2 = raySS.xy (hit point)
    vec2 deltaP = raySS.xy - vUv;
    float adjacentLength = length(deltaP);
    vec2 adjacentUnit = (adjacentLength > 0.0) ? (deltaP / adjacentLength) : vec2(0.0);

    vec4 totalColor = vec4(0.0);
    float remainingAlpha = 1.0;
    float maxMipLevel = float(uNumMips) - 1.0;
    float glossMult = gloss;

    // Approximate cone tracing in screen space with isosceles triangle
    for (int i = 0; i < ITERATION; ++i) {
        float oppositeLength = isoscelesTriangleOpposite(adjacentLength, coneTheta);
        float incircleSize = isoscelesTriangleInRadius(oppositeLength, adjacentLength);

        vec2 samplePos = vUv + adjacentUnit * (adjacentLength - incircleSize);

        float pxRadius = incircleSize * max(uBufferSize.x, uBufferSize.y);
        float mipChannel = clamp(log2(pxRadius), 0.0, maxMipLevel);

        vec4 newColor = coneSampleWeightedColor(samplePos, mipChannel, glossMult);

        remainingAlpha -= newColor.a;
        if (remainingAlpha < 0.0) {
            newColor.rgb *= (1.0 - abs(remainingAlpha));
        }
        totalColor += newColor;

        if (totalColor.a >= 1.0) {
            break;
        }

        adjacentLength = isoscelesTriangleNextAdjacent(adjacentLength, incircleSize);
        glossMult *= gloss;
    }

    vec3 toEye = -toViewPosition;
    float ndotV = clamp(abs(dot(normalVS, toEye)), 0.0, 1.0);
    vec3 specularF = F_Schlick(specularAll.rgb, 1.0, ndotV);

    // fades
    vec2 boundary = abs(raySS.xy - vec2(0.5)) * 2.0;
    float fadeDiffRcp = 1.0 / (uFadeEnd - uFadeStart);
    float fadeOnBorder = 1.0 - clamp((boundary.x - uFadeStart) * fadeDiffRcp, 0.0, 1.0);
    fadeOnBorder *= 1.0 - clamp((boundary.y - uFadeStart) * fadeDiffRcp, 0.0, 1.0);
    fadeOnBorder = smoothstep(0.0, 1.0, fadeOnBorder);

    float rayDepth = reverseLogDepth(raySS.z, cameraNear, cameraFar);

    vec3 rayHitViewPosition = screenToView(
        raySS.xy,
        rayDepth,
        getViewZ(rayDepth),
        projectionMatrix,
        inverseProjectionMatrix
    );
    float fadeOnDistance = 1.0 - clamp(distance(rayHitViewPosition, viewPosition) / uMaxDistance, 0.0, 1.0);

    float fadeOnPerpendicular = clamp(mix(0.0, 1.0, clamp(raySS.w * 4.0, 0.0, 1.0)), 0.0, 1.0);
    float fadeOnRoughness    = clamp(mix(0.0, 1.0, clamp(gloss * 4.0, 0.0, 1.0)), 0.0, 1.0);
    float totalFade = fadeOnBorder * fadeOnDistance * fadeOnPerpendicular * fadeOnRoughness * (1.0 - clamp(remainingAlpha, 0.0, 1.0));

    vec3 result = mix(fallbackColor, totalColor.rgb, totalFade);
    gl_FragColor = vec4(result, 1.0);
}