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
