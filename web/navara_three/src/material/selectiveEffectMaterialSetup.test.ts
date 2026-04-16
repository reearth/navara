import { MeshLambertMaterial } from "three";
import { describe, expect, it } from "vitest";

import { setupSelectiveEffectUniforms } from "./selectiveEffectMaterialSetup";

describe("setupSelectiveEffectUniforms", () => {
  it("should link uEmissiveIntensity that auto-syncs with material.emissiveIntensity", () => {
    const material = new MeshLambertMaterial();
    material.emissiveIntensity = 0.5;
    setupSelectiveEffectUniforms(material);

    // Initial value should match material.emissiveIntensity
    expect(material.userData.uEmissiveIntensity.value).toBe(0.5);

    // Changing material.emissiveIntensity should be reflected via getter
    material.emissiveIntensity = 0.8;
    expect(material.userData.uEmissiveIntensity.value).toBe(0.8);
  });

  it("should link uEffectIdsMask uniform", () => {
    const material = new MeshLambertMaterial();
    setupSelectiveEffectUniforms(material);

    expect(material.userData.uEffectIdsMask).toBeDefined();
    expect(material.userData.uEffectIdsMask.value).toBe(0);
  });

  it("should set USE_SELECTIVE_EFFECT define", () => {
    const material = new MeshLambertMaterial();
    setupSelectiveEffectUniforms(material);

    expect(material.defines?.USE_SELECTIVE_EFFECT).toBe(1);
  });

  it("should include SelectiveEffect in program cache key", () => {
    const material = new MeshLambertMaterial();
    setupSelectiveEffectUniforms(material);

    const cacheKey = material.customProgramCacheKey();
    expect(cacheKey).toContain("SelectiveEffect");
  });

  it("should be idempotent — second call is a no-op", () => {
    const material = new MeshLambertMaterial();
    setupSelectiveEffectUniforms(material);

    const firstRef = material.userData.uEffectIdsMask;
    setupSelectiveEffectUniforms(material);

    expect(material.userData.uEffectIdsMask).toBe(firstRef);
  });
});
