#include "core/packing"
#include "core/depth"
#include "core/transform"

uniform sampler2D uLightTex0; // color,intensity
uniform sampler2D uLightTex1; // position in world space (xyz), radius (w)
uniform sampler2D normalBuffer;
uniform sampler2D copiedDepthBuffer;
uniform bool useSurfaceLighting;
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
// Tiled culling
uniform sampler2D uLightGrid;      // per-tile: (offsetTexel, count)
uniform sampler2D uLightIndex;     // packed 4 indices per texel (RGBA)
uniform ivec2 uLightGridSize;      // gridW, gridH (tiles)
uniform ivec2 uLightIndexTexSize;  // width, height of index texture
uniform float uTileSizePx;         // tile size in pixels

vec4 readCI(int idx) {
  ivec2 tc = ivec2(idx % uLightTexSize.x, idx / uLightTexSize.x);
  return texelFetch(uLightTex0, tc, 0);
}

vec4 readPos(int idx) {
  ivec2 tc = ivec2(idx % uLightTexSize.x, idx / uLightTexSize.x);
  return texelFetch(uLightTex1, tc, 0);
}

// ref: https://ijdykeman.github.io/graphics/simple_fog_shader
vec3 calculateFogScattering(vec3 worldPos, vec3 lightPos, vec3 lightColor, vec3 normal, float intensity, float radius, vec3 albedo) {
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
    
    float R = max(radius, 0.0);

    float sMax = sqrt(max(R*R - h*h, 0.0));

    float aL = clamp(a, -sMax, sMax);
    float bL = clamp(b, -sMax, sMax);

    float integral = (atan(bL / h) - atan(aL / h)) / h;
    
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

float readDepth(const vec2 uv) {
  #if DEPTH_PACKING == 3201
  return unpackRGBAToDepth(texture2D(copiedDepthBuffer, uv));
  #else
  return texture2D(copiedDepthBuffer, uv).r;
  #endif // DEPTH_PACKING == 3201
}

float getViewZ(const float depth) {
  #ifdef PERSPECTIVE_CAMERA
  return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
  #else
  return orthographicDepthToViewZ(depth, cameraNear, cameraFar);
  #endif
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

    // Determine tile for this pixel
    ivec2 pixel = ivec2(uv * resolution);
    ivec2 tile = clamp(pixel / int(uTileSizePx), ivec2(0), uLightGridSize - ivec2(1));
    int tileIndex = tile.x + tile.y * uLightGridSize.x;
    ivec2 gridUv = ivec2(tileIndex % uLightGridSize.x, tileIndex / uLightGridSize.x);
    vec2 gridData = texelFetch(uLightGrid, gridUv, 0).rg;
    int offsetTexel = int(gridData.x + 0.5);
    int count = int(min(gridData.y + 0.5, float(MAX_LIGHTS_PER_TILE)));

    for (int j = 0; j < MAX_LIGHTS_PER_TILE; ++j) {
      if (j >= count) break;
      // RGBA‑packed (4 indices per texel)
      int texelIndex = offsetTexel + (j >> 2);
      int comp = j & 3;
      ivec2 idxUv = ivec2(texelIndex % uLightIndexTexSize.x, texelIndex / uLightIndexTexSize.x);
      vec4 packed = texelFetch(uLightIndex, idxUv, 0);
      float fidx = comp == 0 ? packed.r : (comp == 1 ? packed.g : (comp == 2 ? packed.b : packed.a));
      int i = int(floor(fidx + 0.5));
      if (i < 0) continue;

      vec4 ci = readCI(i); // color,intensity
      vec4 posData = readPos(i); // position in world space
      vec3 lightColor = ci.rgb;
      float intensity = ci.a;
      vec3 lightPos = posData.xyz;
      if (intensity > 0.0) {
        vec3 lightContribution = calculateFogScattering(
          worldPos,
          lightPos,
          lightColor,
          normal,
          intensity,
          posData.w,
          inputColor.rgb
        );
        fogColor += lightContribution;
      }
    }
    #ifdef DEBUG_SHOW_GRID
      // Visualize tile grid and occupancy.
      float occ = clamp(float(count) / float(MAX_LIGHTS_PER_TILE), 0.0, 1.0);

      vec2 pix = uv * resolution;
      vec2 tm = mod(pix, vec2(uTileSizePx));
      float left   = 1.0 - step(1.0, tm.x);
      float right  = step(uTileSizePx - 1.0, tm.x);
      float top    = 1.0 - step(1.0, tm.y);
      float bottom = step(uTileSizePx - 1.0, tm.y);
      float gridLine = clamp(left + right + top + bottom, 0.0, 1.0);

      vec3 gridFill = vec3(1.0) * occ * 0.05;
      vec3 gridLines = vec3(1.0) * gridLine;
      fogColor += gridFill + gridLines;
    #endif

    #ifdef FOG_ONLY_OUTPUT
      // When downsampling: output only the fog contribution. The host pass will composite over input.
      outputColor = vec4(fogColor, 1.0);
    #else
      vec3 finalColor = inputColor.rgb + fogColor;
      outputColor = vec4(finalColor, inputColor.a);
    #endif
}
