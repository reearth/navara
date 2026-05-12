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
 * This replaces vertex normals with pre-computed normals from hillshade normal data textures.
 * The hillshade textures in uTextures[] are generated offline from DEM data and store
 * precomputed normal information for shader sampling. This avoids expensive per-fragment
 * height sampling and normal computation.
 */
export function generateHillshadeNormalShader(maxTextures: number): string {
  return `
  #if USE_HILLSHADE
    // Override normal with pre-computed normals for hillshade layers
    ${Array.from(
      { length: maxTextures },
      (_, i) => `
    if (uIsHillshades[${i}]) {
      // Check if there's a valid texture bound (size > 2 to avoid 1×1 placeholders)
      ivec2 normalMapSize = textureSize(uTextures[${i}], 0);

      if (normalMapSize.x > 2) {
        // Apply per-layer UV transform for hillshade parent texture reuse
        vec2 hillshadeUv = vOrigUv * uHillshadeUvScale[${i}] + uHillshadeUvOffset[${i}];

        // Clamp UV to [0,1] to prevent out-of-bounds sampling at tile borders
        hillshadeUv = clamp(hillshadeUv, vec2(0.0), vec2(1.0));

        // [0,1] -> [-1,1] to get normal vector from texture
        vec3 demNormal = texture2D(uTextures[${i}], hillshadeUv).rgb * 2.0 - 1.0;
        demNormal = normalize(demNormal);

        // Apply exaggeration to slope components (xy) before normalization
        demNormal.xy *= uHillshadeExaggeration;
        demNormal = normalize(demNormal);

        // Transform from tangent space to world space
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
    }`,
    ).join("\n")}
  #endif
`;
}
