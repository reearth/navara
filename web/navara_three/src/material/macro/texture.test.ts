import { expect, describe, it } from "vitest";

import { generateMixOverlaidTexturesMacro } from "./texture";

describe("generateMixOverlaidTexturesMacro", () => {
  it("should generate correct GLSL code for a single texture", () => {
    const result = generateMixOverlaidTexturesMacro(1);

    expect(result).toBe(
      "vec4 sampledDiffuseColor = mix(diffuseColor, texture2D(uTextures[0], vUv) * vec4(uColors[0], 1.), float(uShows[0]) * uOpacities[0]);",
    );
  });

  it("should generate correct GLSL code for two textures", () => {
    const result = generateMixOverlaidTexturesMacro(2);

    expect(result).toBe(
      "vec4 sampledDiffuseColor = mix(mix(diffuseColor, texture2D(uTextures[0], vUv) * vec4(uColors[0], 1.), float(uShows[0]) * uOpacities[0]), texture2D(uTextures[1], vUv) * vec4(uColors[1], 1.), float(uShows[1]) * uOpacities[1]);",
    );
  });

  it("should handle hidden textures correctly", () => {
    const result = generateMixOverlaidTexturesMacro(3);

    expect(result).toBe(
      "vec4 sampledDiffuseColor = mix(mix(mix(diffuseColor, texture2D(uTextures[0], vUv) * vec4(uColors[0], 1.), float(uShows[0]) * uOpacities[0]), texture2D(uTextures[1], vUv) * vec4(uColors[1], 1.), float(uShows[1]) * uOpacities[1]), texture2D(uTextures[2], vUv) * vec4(uColors[2], 1.), float(uShows[2]) * uOpacities[2]);",
    );
  });

  it("should handle no textures correctly", () => {
    const result = generateMixOverlaidTexturesMacro(0);

    expect(result).toBeUndefined();
  });
});
