import { describe, expect, it } from "vitest";

import type { ShaderUniforms } from "../../MaterialEnhancer";

import { createBaseMutates } from "./mutates";
import { DEFAULT_BASE_STATE } from "./state";
import type { ModelBaseState } from "./types";

describe("modelBaseEnhancer/mutates", () => {
  describe("update syncs refs from state", () => {
    it("should sync pickable ref from state", () => {
      const state: ModelBaseState = {
        ...DEFAULT_BASE_STATE,
        pickable: true,
      };
      const mutates = createBaseMutates();
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.nvr_uPickable?.value).toBe(1);
    });

    it("should set pickable to 0 when false", () => {
      const state: ModelBaseState = {
        ...DEFAULT_BASE_STATE,
        pickable: false,
      };
      const mutates = createBaseMutates();
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.nvr_uPickable?.value).toBe(0);
    });
  });

  describe("update syncs selective effect uniforms from state", () => {
    it("should sync effectIdsMask ref from state", () => {
      const state: ModelBaseState = {
        ...DEFAULT_BASE_STATE,
        effectIdsMask: 5, // bits 0 and 2
      };
      const mutates = createBaseMutates();
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uEffectIdsMask?.value).toBe(5);
    });
  });

  describe("setBatchDataTexture", () => {
    it("should assign batch data texture ref", () => {
      const mutates = createBaseMutates();
      mutates.update(DEFAULT_BASE_STATE);

      const textureRef = { value: null };
      mutates.setBatchDataTexture(textureRef);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, DEFAULT_BASE_STATE);

      expect(uniforms.batchDataTexture).toBe(textureRef);
    });
  });
});
