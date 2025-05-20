import { expect, test } from "vitest";

import { generateMixOverlaidTexturesMacro } from "./texture";

test("generateMixOverlaidTexturesMacro should return undefined for zero textures", () => {
  const result = generateMixOverlaidTexturesMacro(0);
  expect(result, "should return undefined for zero textures").toBeUndefined();
});

test("generateMixOverlaidTexturesMacro should generate correct GLSL code for a single texture", () => {
  const result = generateMixOverlaidTexturesMacro(1);

  // Check that the result contains key elements for the current implementation
  expect(result, "should initialize sampledDiffuseColor").toContain(
    "vec4 sampledDiffuseColor = diffuseColor",
  );
  expect(result, "should include texture 0 processing comment").toContain(
    "// Process texture 0",
  );
  expect(result, "should include show condition").toContain(
    "if (uShows[0] == 1)",
  );
  expect(result, "should initialize texColor0").toContain(
    "vec4 texColor0 = vec4(0.)",
  );
  expect(result, "should calculate alpha").toContain(
    "float alpha0 = texColor0.a * uOpacities[0]",
  );
  expect(result, "should include alpha threshold check").toContain(
    "if (alpha0 > 0.01)",
  );
  expect(result, "should include mix operation").toContain(
    "sampledDiffuseColor = mix(sampledDiffuseColor, vec4(texColor0.rgb, 1.0), alpha0)",
  );
});

test("generateMixOverlaidTexturesMacro should generate correct GLSL code for two textures", () => {
  const result = generateMixOverlaidTexturesMacro(2);

  // Check structure for multiple textures
  expect(result, "should initialize sampledDiffuseColor").toContain(
    "vec4 sampledDiffuseColor = diffuseColor",
  );
  expect(result, "should include texture 0 processing").toContain(
    "// Process texture 0",
  );
  expect(result, "should include texture 1 processing").toContain(
    "// Process texture 1",
  );
  expect(result, "should include show condition for texture 0").toContain(
    "if (uShows[0] == 1)",
  );
  expect(result, "should include show condition for texture 1").toContain(
    "if (uShows[1] == 1)",
  );
});

test("generateMixOverlaidTexturesMacro should handle multiple textures correctly", () => {
  const result = generateMixOverlaidTexturesMacro(3);

  // Verify all three textures are processed
  expect(result, "should include texture 0 processing").toContain(
    "// Process texture 0",
  );
  expect(result, "should include texture 1 processing").toContain(
    "// Process texture 1",
  );
  expect(result, "should include texture 2 processing").toContain(
    "// Process texture 2",
  );
});

test("generateMixOverlaidTexturesMacro should use custom insert function when provided", () => {
  const customInsert = (texColorVar: string, idx: number) => {
    return `${texColorVar} = texture2D(uTextures[${idx}], customUV) * vec4(uColors[${idx}], 1.0);`;
  };

  const result = generateMixOverlaidTexturesMacro(1, customInsert);

  expect(result, "should include custom insert code").toContain(
    "texture2D(uTextures[0], customUV)",
  );
});

test("generateMixOverlaidTexturesMacro should handle the insert function as used in tile.ts", () => {
  // Simplified version of how it's used in tile.ts
  const tileInsert = (texColorVar: string, idx: number) => {
    return `
    vec2 texUv = vUv;
    ${texColorVar} = texture2D(uTextures[${idx}], texUv) * vec4(uColors[${idx}], 1.0);
    `;
  };

  const result = generateMixOverlaidTexturesMacro(1, tileInsert);

  expect(result, "should include the custom UV logic").toContain(
    "vec2 texUv = vUv",
  );
  expect(result, "should use the custom UV in texture2D").toContain(
    "texture2D(uTextures[0], texUv)",
  );
});
