import type { Texture } from "three";
import { describe, expect, it } from "vitest";

import type { ShaderUniforms } from "../../MaterialEnhancer";

import { createWaterMutates } from "./mutates";
import { DEFAULT_WATER_STATE } from "./state";
import type { ModelWaterState } from "./types";

describe("modelWaterEnhancer/mutates", () => {
  describe("setWaterNormalMap", () => {
    it("should set uWaterNormalMap when useWater is true", () => {
      const mutates = createWaterMutates();
      const mockTexture = {} as Texture;
      const waterNormalMapUniform = { value: mockTexture };
      const state: ModelWaterState = { ...DEFAULT_WATER_STATE, useWater: true };

      mutates.setWaterNormalMap(waterNormalMapUniform, true);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uWaterNormalMap?.value).toBe(mockTexture);
    });

    it("should set uWaterNormalMap to null when useWater is false", () => {
      const mutates = createWaterMutates();
      const mockTexture = {} as Texture;
      const waterNormalMapUniform = { value: mockTexture };
      const state: ModelWaterState = {
        ...DEFAULT_WATER_STATE,
        useWater: false,
      };

      mutates.setWaterNormalMap(waterNormalMapUniform, false);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uWaterNormalMap?.value).toBe(null);
    });
  });

  describe("update", () => {
    it("should keep uWaterNormalMap when useWater is true", () => {
      const mutates = createWaterMutates();
      const mockTexture = {} as Texture;
      const waterNormalMapUniform = { value: mockTexture };

      // First set the water normal map with useWater false
      mutates.setWaterNormalMap(waterNormalMapUniform, false);

      // Then update with useWater true
      const state: ModelWaterState = {
        ...DEFAULT_WATER_STATE,
        useWater: true,
      };

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      mutates.update(state);

      expect(uniforms.uWaterNormalMap?.value).toBe(mockTexture);
    });

    it("should clear uWaterNormalMap when useWater becomes false", () => {
      const mutates = createWaterMutates();
      const mockTexture = {} as Texture;
      const waterNormalMapUniform = { value: mockTexture };

      // First set the water normal map with useWater true
      mutates.setWaterNormalMap(waterNormalMapUniform, true);

      // Then update with useWater false
      const state: ModelWaterState = {
        ...DEFAULT_WATER_STATE,
        useWater: false,
      };

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      mutates.update(state);

      expect(uniforms.uWaterNormalMap?.value).toBe(null);
    });
  });
});
