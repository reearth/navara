import { Texture } from "three";
import { describe, expect, it } from "vitest";

import { DEFAULT_WATER_STATE, updateWaterState } from "./state";
import type { ModelWaterState } from "./types";

/**
 * Helper to create expected water state by merging with defaults.
 */
const createExpectedState = (
  overrides: Partial<ModelWaterState> = {},
): ModelWaterState => ({
  ...DEFAULT_WATER_STATE,
  ...overrides,
});

describe("modelWaterEnhancer/state", () => {
  describe("updateWaterState", () => {
    it("returns default state when given empty props", () => {
      const result = updateWaterState({}, DEFAULT_WATER_STATE);
      expect(result).toEqual(createExpectedState());
    });

    it("applies all props", () => {
      const mockSkyEnvMap = new Texture();

      const result = updateWaterState(
        {
          water: true,
          waterScaleNormal: 0.5,
          waterSpeed: 1.0,
          shininess: 30,
          specularStrength: 0.8,
          applyWaterNormal: true,
          specular: true,
          ior: 1.5,
          reflectivity: 0.6,
          skyEnvMap: mockSkyEnvMap,
        },
        DEFAULT_WATER_STATE,
      );

      expect(result).toEqual(
        createExpectedState({
          useWater: true,
          waterScaleNormal: 0.5,
          waterSpeed: 1.0,
          shininess: 30,
          specularStrength: 0.8,
          applyWaterNormal: true,
          specular: true,
          ior: 1.5,
          reflectivity: 0.6,
          skyEnvMap: mockSkyEnvMap,
        }),
      );
    });

    it("falls back to currentState for missing props", () => {
      const currentState: ModelWaterState = {
        ...DEFAULT_WATER_STATE,
        useWater: true,
        waterScaleNormal: 0.3,
        shininess: 25,
      };

      const result = updateWaterState({ waterSpeed: 5.0 }, currentState);

      expect(result.useWater).toBe(true);
      expect(result.waterScaleNormal).toBe(0.3);
      expect(result.shininess).toBe(25);
      expect(result.waterSpeed).toBe(5.0);
    });

    it("keeps applyWaterNormal as boolean in state", () => {
      // Boolean values stay as boolean in state (cast to number only in refs)
      const result1 = updateWaterState(
        { applyWaterNormal: true },
        DEFAULT_WATER_STATE,
      );
      expect(result1.applyWaterNormal).toBe(true);

      const result2 = updateWaterState(
        { applyWaterNormal: false },
        DEFAULT_WATER_STATE,
      );
      expect(result2.applyWaterNormal).toBe(false);
    });

    it("converts numeric applyWaterNormal to boolean (truthy check)", () => {
      // Numeric values are converted to boolean via !!
      const result1 = updateWaterState(
        { applyWaterNormal: 0.5 },
        DEFAULT_WATER_STATE,
      );
      expect(result1.applyWaterNormal).toBe(true); // truthy → true

      const result2 = updateWaterState(
        { applyWaterNormal: 0 },
        DEFAULT_WATER_STATE,
      );
      expect(result2.applyWaterNormal).toBe(false); // falsy → false
    });
  });
});
