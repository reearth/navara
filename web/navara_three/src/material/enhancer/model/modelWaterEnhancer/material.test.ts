import { MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";

import { applyWaterMaterialConfig } from "./material";
import { DEFAULT_WATER_STATE } from "./state";
import type { ModelWaterState } from "./types";

describe("modelWaterEnhancer/material", () => {
  describe("applyWaterMaterialConfig", () => {
    it("should trigger material.needsUpdate when water flag changes", () => {
      const material = new MeshStandardMaterial();
      const state: ModelWaterState = {
        ...DEFAULT_WATER_STATE,
        useWater: true,
      };

      let needsUpdateCalled = false;
      Object.defineProperty(material, "needsUpdate", {
        set: (value: boolean) => {
          if (value) needsUpdateCalled = true;
        },
        configurable: true,
      });

      applyWaterMaterialConfig(material, state, false);
      expect(needsUpdateCalled).toBe(true);
    });

    it("should not trigger material.needsUpdate when water flag stays the same", () => {
      const material = new MeshStandardMaterial();
      const state: ModelWaterState = {
        ...DEFAULT_WATER_STATE,
        useWater: true,
      };

      let needsUpdateCalled = false;
      Object.defineProperty(material, "needsUpdate", {
        set: (value: boolean) => {
          if (value) needsUpdateCalled = true;
        },
        configurable: true,
      });

      applyWaterMaterialConfig(material, state, true);
      expect(needsUpdateCalled).toBe(false);
    });
  });
});
