import type { Material } from "three";
import { expect, describe, it } from "vitest";

import { generateMixOverlaidTexturesMacro } from "./texture";

describe("generateMixOverlaidTexturesMacro", () => {
  const createMockMaterial = (shows: number[]) => {
    return {
      userData: {
        shows: {
          value: shows,
        },
      },
    } as unknown as Material;
  };

  it("should generate correct GLSL code for a single texture", () => {
    const mockMaterial = createMockMaterial([1]);
    const result = generateMixOverlaidTexturesMacro(mockMaterial, 1);

    expect(result).toBe(
      "vec4 sampledDiffuseColor = mix(diffuseColor, texture2D(uTextures[0], vUv) * vec4(uColors[0], 1.), float(uShows[0]) * uOpacities[0]);",
    );
  });

  it("should generate correct GLSL code for two textures", () => {
    const mockMaterial = createMockMaterial([1, 1]);
    const result = generateMixOverlaidTexturesMacro(mockMaterial, 2);

    expect(result).toBe(
      "vec4 sampledDiffuseColor = mix(mix(diffuseColor, texture2D(uTextures[0], vUv) * vec4(uColors[0], 1.), float(uShows[0]) * uOpacities[0]), texture2D(uTextures[1], vUv) * vec4(uColors[1], 1.), float(uShows[1]) * uOpacities[1]);",
    );
  });

  it("should handle hidden textures correctly", () => {
    const mockMaterial = createMockMaterial([1, 0, 1]);
    const result = generateMixOverlaidTexturesMacro(mockMaterial, 3);

    expect(result).toBe(
      "vec4 sampledDiffuseColor = mix(mix(diffuseColor, texture2D(uTextures[0], vUv) * vec4(uColors[0], 1.), float(uShows[0]) * uOpacities[0]), mix(texture2D(uTextures[1], vUv) * vec4(uColors[1], 1.), texture2D(uTextures[2], vUv) * vec4(uColors[2], 1.), float(uShows[2]) * uOpacities[2]), float(uShows[1]) * uOpacities[1]);",
    );
  });

  it("should handle no textures correctly", () => {
    const mockMaterial = createMockMaterial([]);
    const result = generateMixOverlaidTexturesMacro(mockMaterial, 0);

    expect(result).toBeUndefined();
  });
});
