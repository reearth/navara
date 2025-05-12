import { expect, describe, it } from "vitest";

import { generateMixOverlaidTexturesMacro } from "./texture";

describe("generateMixOverlaidTexturesMacro", () => {
  it("should generate correct GLSL code for a single texture", () => {
    const result = generateMixOverlaidTexturesMacro(1);

    // Check that the result contains key elements for the new implementation
    expect(result).toContain("vec4 sampledDiffuseColor = diffuseColor");
    expect(result).toContain("// Process texture 0");
    expect(result).toContain("vec4 texColor0 = texture2D(uTextures[0], vUv) * vec4(uColors[0], 1.0)");
    expect(result).toContain("float alpha0 = texColor0.a * uOpacities[0]");
    expect(result).toContain("sampledDiffuseColor = mix(sampledDiffuseColor, vec4(texColor0.rgb, 1.0), alpha0)");
  });

  it("should generate correct GLSL code for two textures", () => {
    const result = generateMixOverlaidTexturesMacro(2);

    // Check that the result contains key elements for the new implementation
    expect(result).toContain("vec4 sampledDiffuseColor = diffuseColor");
    expect(result).toContain("// Process texture 0");
    expect(result).toContain("vec4 texColor0 = texture2D(uTextures[0], vUv) * vec4(uColors[0], 1.0)");
    expect(result).toContain("float alpha0 = texColor0.a * uOpacities[0]");
    expect(result).toContain("// Process texture 1");
    expect(result).toContain("vec4 texColor1 = texture2D(uTextures[1], vUv) * vec4(uColors[1], 1.0)");
    expect(result).toContain("float alpha1 = texColor1.a * uOpacities[1]");
  });

  it("should handle multiple textures correctly", () => {
    const result = generateMixOverlaidTexturesMacro(3);

    // Check that the result contains key elements for the new implementation
    expect(result).toContain("vec4 sampledDiffuseColor = diffuseColor");
    expect(result).toContain("// Process texture 0");
    expect(result).toContain("vec4 texColor0 = texture2D(uTextures[0], vUv) * vec4(uColors[0], 1.0)");
    expect(result).toContain("float alpha0 = texColor0.a * uOpacities[0]");
    expect(result).toContain("// Process texture 1");
    expect(result).toContain("// Process texture 2");
  });

  it("should handle no textures correctly", () => {
    const result = generateMixOverlaidTexturesMacro(0);

    expect(result).toBeUndefined();
  });
});
