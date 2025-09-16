#include "core/packing"
#include "core/depth"
#include "core/transform"

uniform sampler2D uLightTex0; // color,intensity
uniform sampler2D uLightTex1; // position in world space, unused
uniform sampler2D normalBuffer;
uniform bool useSurfaceLighting;
uniform int uLightCount;
uniform ivec2 uLightTexSize;
uniform vec3 cameraPos;
uniform float fogDensity;
uniform vec2 resolution;
uniform float cameraNear;
uniform float cameraFar;
uniform mat4 projectionMatrix;
uniform mat4 invProjectionMatrix;
uniform mat4 invViewMatrix;
uniform mat4 viewMatrix;

vec4 readCI(int idx) {
  ivec2 tc = ivec2(idx % uLightTexSize.x, idx / uLightTexSize.x);
  return texelFetch(uLightTex0, tc, 0);
}

vec4 readPos(int idx) {
  ivec2 tc = ivec2(idx % uLightTexSize.x, idx / uLightTexSize.x);
  return texelFetch(uLightTex1, tc, 0);
}

// ref: https://ijdykeman.github.io/graphics/simple_fog_shader
vec3 calculateFogScattering(vec3 worldPos, vec3 lightPos, vec3 lightColor, vec3 normal, float intensity, vec3 albedo) {
    vec3 viewDir = worldPos - cameraPos;
    float viewDist = length(viewDir);
    viewDir = normalize(viewDir);
    
    vec3 lightToCamera = cameraPos - lightPos;
    float t = dot(lightToCamera, viewDir);
    vec3 closestPoint = cameraPos + viewDir * clamp(-t, 0.0, viewDist);
    
    float h = max(length(closestPoint - lightPos), 0.001);
    
    float a = length(cameraPos - closestPoint);
    float b = length(worldPos - closestPoint);
    
    float sign = t > 0.0 ? 1.0 : -1.0;
    a *= sign;
    b *= -sign;
    
    float integral = (atan(b / h) - atan(a / h)) / h;
    
    vec3 fogLight = lightColor * intensity * integral * fogDensity;

    fogLight = max(vec3(0.0), fogLight);

    if(useSurfaceLighting) {
      // Calculate point lighting on the surface. (Deferred lighting)
      vec3 L = lightPos - worldPos;
      float r2 = max(dot(L, L), 1e-4);
      float NdotL = max(dot(normal, normalize(L)), 0.0);

      fogLight += BRDF_Lambert(albedo) * lightColor * intensity * NdotL;
    }

    float attenuation = 1.0 / (1.0 + h * 0.1);
    fogLight *= attenuation;

    return fogLight;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    float depth = readDepth(uv);
    depth = reverseLogDepth(depth, cameraNear, cameraFar);

    float viewZ = getViewZ(depth);
    vec3 viewPos = screenToView(
      uv,
      depth,
      viewZ,
      projectionMatrix,
      invProjectionMatrix
    );
    vec3 worldPos = (invViewMatrix * vec4(viewPos, 1.0)).xyz;
    
    // Get surface normal if surface lighting is enabled
    vec3 normal = vec3(0.0);
    if (useSurfaceLighting && depth < 0.9999) {
        vec4 packedNormal = texture2D(normalBuffer, uv);
        normal = unpackVec2ToNormal(packedNormal.xy);
        // Transform normal from view space to world space
        normal = normalize((invViewMatrix * vec4(normal, 0.0)).xyz);
    }
    
    vec3 fogColor = vec3(0.0);
    
    // Loop through all lights using DataTexture
    for (int i = 0; i < uLightCount; ++i) {
        vec4 ci = readCI(i); // color,intensity
        vec4 posData = readPos(i); // position in world space
        
        vec3 lightColor = ci.rgb;
        float intensity = ci.a;
        vec3 lightPos = posData.xyz;
        
        if (intensity > 0.0) {
            // Use volumetric fog scattering only
            vec3 lightContribution = calculateFogScattering(
                worldPos, 
                lightPos, 
                lightColor, 
                normal,
                intensity,
                inputColor.rgb
            );

            fogColor += lightContribution;
        }
    }
    
    vec3 finalColor = inputColor.rgb + fogColor;
    
    outputColor = vec4(finalColor, inputColor.a);
}
