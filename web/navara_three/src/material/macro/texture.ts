export const generateMixOverlaidTexturesMacro = (numTextures: number) => {
  if (numTextures === 0) {
    return;
  }

  const tex0 = `texture2D(uTextures[0], vUv) * vec4(uColors[0], 1.)`;
  const alpha0 = `float(uShows[0]) * uOpacities[0]`;
  let result = `mix(diffuseColor, ${tex0}, ${alpha0})`;

  for (let i = 1; i < numTextures; i++) {
    const tex = `texture2D(uTextures[${i}], vUv) * vec4(uColors[${i}], 1.)`;
    const alpha = `float(uShows[${i}]) * uOpacities[${i}]`;
    result = `mix(${result}, ${tex}, ${alpha})`;
  }

  return `vec4 sampledDiffuseColor = ${result};`;
};
