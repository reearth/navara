import { Texture } from "three";
import { describe, expect, it } from "vitest";

import { DEFAULT_WATER_STATE, updateWaterState } from "./state";
import type { PolygonWaterState } from "./types";

/**
 * Helper to create expected water state by merging with defaults.
 */
const createExpectedState = (
  overrides: Partial<PolygonWaterState> = {},
): PolygonWaterState => ({
  ...DEFAULT_WATER_STATE,
  ...overrides,
});

describe("polygonWaterEnhancer/state", () => {
  describe("updateWaterState", () => {
    it("returns default state when given empty props", () => {
      const result = updateWaterState({}, DEFAULT_WATER_STATE);
      expect(result).toEqual(createExpectedState());
    });

    it("applies all props", () => {
      const mockTexture = new Texture();
      const mockSkyEnvMap = new Texture();

      const result = updateWaterState(
        {
          water: true,
          waterNormalMap: mockTexture,
          waterScaleNormal: 0.5,
          waterSpeed: 1.0,
          shininess: 30,
          specularStrength: 0.8,
          applyWaterNormal: 1,
          specular: true,
          ior: 1.5,
          skyEnvMap: mockSkyEnvMap,
        },
        DEFAULT_WATER_STATE,
      );

      expect(result).toEqual(
        createExpectedState({
          useWater: true,
          waterNormalMap: mockTexture,
          waterScaleNormal: 0.5,
          waterSpeed: 1.0,
          shininess: 30,
          specularStrength: 0.8,
          applyWaterNormal: 1,
          specular: true,
          ior: 1.5,
          skyEnvMap: mockSkyEnvMap,
        }),
      );
    });

    it("falls back to currentState for missing props", () => {
      const currentState: PolygonWaterState = {
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

    it("preserves waterNormalMap when not provided in props", () => {
      const mockTexture = new Texture();
      const currentState: PolygonWaterState = {
        ...DEFAULT_WATER_STATE,
        waterNormalMap: mockTexture,
      };

      const result = updateWaterState({ waterSpeed: 2.0 }, currentState);
      expect(result.waterNormalMap).toBe(mockTexture);
    });

    it("sets waterNormalMap to null when explicitly set to null", () => {
      const mockTexture = new Texture();
      const currentState: PolygonWaterState = {
        ...DEFAULT_WATER_STATE,
        waterNormalMap: mockTexture,
      };

      const result = updateWaterState({ waterNormalMap: null }, currentState);
      expect(result.waterNormalMap).toBeNull();
    });
  });
});
