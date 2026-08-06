import { MeshLambertMaterial, ShaderLib, type WebGLRenderer } from "three";
import { describe, expect, it } from "vitest";

import { overrideMaterialsForMRT } from "../material";

import { setupMaterialForDrape } from "./DrapedMesh";

type ShaderStub = Parameters<MeshLambertMaterial["onBeforeCompile"]>[0];

const compile = (material: MeshLambertMaterial): ShaderStub => {
  const shader = {
    name: "",
    uniforms: {},
    vertexShader: ShaderLib.lambert.vertexShader,
    fragmentShader: ShaderLib.lambert.fragmentShader,
    defines: {},
  } as unknown as ShaderStub;
  material.onBeforeCompile(shader, null as unknown as WebGLRenderer);
  return shader;
};

describe("setupMaterialForDrape", () => {
  it("substitutes the globe normal ahead of the lighting", () => {
    overrideMaterialsForMRT();
    const material = new MeshLambertMaterial();
    const globeNormal = { value: null };

    setupMaterialForDrape(material, globeNormal);
    const shader = compile(material);

    expect(shader.fragmentShader).toContain("nvrDrapeUv");
    expect(shader.uniforms.uGlobeNormal).toBe(globeNormal);
    expect(shader.fragmentShader.indexOf("nvrDrapeUv")).toBeLessThan(
      shader.fragmentShader.indexOf("#include <lights_fragment_begin>"),
    );
  });

  it("injects even when an earlier handler consumes the anchor", () => {
    // navara_three_csm swaps `#include <lights_fragment_begin>` for its
    // cascaded-lights chunk. Delegating to it first left nothing to anchor to,
    // so the substitution silently never happened.
    overrideMaterialsForMRT();
    const material = new MeshLambertMaterial();
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_fragment_begin>",
        "// cascaded lights",
      );
    };

    setupMaterialForDrape(material, { value: null });
    const shader = compile(material);

    expect(shader.fragmentShader).toContain("nvrDrapeUv");
    expect(shader.fragmentShader).toContain("// cascaded lights");
  });
});
