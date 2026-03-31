export const generateMixOverlaidTexturesMacro = (
  numTextures: number,
  insert?: (texColorVar: string, idx: number) => string,
) => {
  if (numTextures === 0) {
    return;
  }

  // Initialize with default diffuse color
  let result = `vec4 sampledDiffuseColor = diffuseColor;\n`;

  // Process textures from back to front (lowest index to highest)
  // We need to unroll the loop because GLSL requires constant indices for samplers
  for (let i = 0; i < numTextures; i++) {
    result += `
  // Process texture ${i}
  if (uShows[${i}] == 1) {
    vec4 texColor${i} = vec4(0.);
    
    ${insert?.(`texColor${i}`, i) ?? ""}
    float alpha${i} = texColor${i}.a * uOpacities[${i}];
    
    if (alpha${i} > 0.01) {
      // Blend based on alpha value
      sampledDiffuseColor = mix(sampledDiffuseColor, vec4(texColor${i}.rgb, 1.0), alpha${i});
    }
  }`;
  }

  return `${result}`;
};

/**
 * Generate hillshade normal override shader code for each texture slot
 * This replaces vertex normals with DEM-derived normals for hillshade layers
 */
export function generateHillshadeNormalShader(maxTextures: number): string {
  return `
  #if USE_HILLSHADE
    // Override normal with DEM-derived normal for hillshade layers
    ${Array.from(
      { length: maxTextures },
      (_, i) => `
    if (uIsHillshades[${i}]) {
      // Check if there's a valid texture bound (size > 2 to avoid 1×1 placeholders)
      ivec2 actualTexSize = textureSize(uTextures[${i}], 0);

      if (actualTexSize.x > 2) {
        // Calculate texelSize based on content size
        // Standard UV mapping: UV [0,1] maps to pixel centers [first, last]
        // So texelSize (UV distance between adjacent pixels) = 1 / (N - 1)
        // For 258x258 padded texture with 256 content pixels: texelSize = 1/255
        ivec2 contentSize = isPowerOfTwo(actualTexSize.x) ? actualTexSize : actualTexSize - ivec2(2);
        vec2 texelSize = vec2(1.0) / (vec2(contentSize) - vec2(1.0));

        // Second check: Is this valid land data (not ocean/no-data)?
        float testHeight = sampleHeightBilinear(uTextures[${i}], vUv, actualTexSize);

        // This preserves original vertex normals for ocean/no-data areas
        if (isValidHeight(testHeight)) {
          vec3 demNormal = computeNormalFromDEM(uTextures[${i}], vUv, texelSize, uMetersPerTexel[${i}]);

          vec3 up = vec3(0.0, 0.0, 1.0);  // World up
          vec3 T = normalize(cross(up, N));

          // Handle poles where N is parallel to up
          if (length(T) < 0.001) {
            T = vec3(1.0, 0.0, 0.0);  // Fallback for poles
          }

          vec3 B = normalize(cross(N, T));

          // Construct TBN matrix (tangent space to world space)
          mat3 TBN = mat3(T, B, N);

          // Transform DEM normal from tangent space to world space
          vec3 worldDemNormal = normalize(TBN * demNormal);

          // Transform to view space
          normal = normalize(mat3(viewMatrix) * worldDemNormal);
        }
      }
    }`,
    ).join("\n")}
  #endif
`;
}
