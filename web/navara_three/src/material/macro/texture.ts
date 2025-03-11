import type { Material } from "three";

export const generateMixOverlaidTexturesMacro = (
  m: Material,
  numTextures: number,
) => {
  const shows = m.userData.shows.value.map(Boolean);
  const result = mix(shows, numTextures);
  if (!result) return;
  return `vec4 sampledDiffuseColor = ${result};`;
};

const mix = (shows: boolean[], depth: number, i = 0): string | undefined => {
  if (i >= depth) {
    return;
  }
  const nextIdx = i + 1;
  const next = mix(shows, depth, nextIdx);

  let tex0 = `texture2D(uTextures[${i}], vUv) * vec4(uColors[${i}], 1.)`;
  if (i === 0) {
    tex0 = `mix(diffuseColor, ${tex0}, float(uShows[0]) * uOpacities[0])`;
  }

  if (!next) {
    return tex0;
  }
  return `mix(${tex0}, ${next}, float(uShows[${nextIdx}]) * uOpacities[${nextIdx}])`;
};
