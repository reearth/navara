import { describe, expect, it } from "vitest";

import type { ShaderUniforms } from "../../MaterialEnhancer";

import { createBaseMutates } from "./mutates";
import { DEFAULT_BASE_STATE } from "./state";
import type { PolygonBaseState } from "./types";

describe("polygonBaseEnhancer/mutates", () => {
  describe("RTE uniforms", () => {
    it("should assign RTE refs to shader.uniforms when useRTE=true", () => {
      const state: PolygonBaseState = { ...DEFAULT_BASE_STATE, useRTE: true };
      const mutates = createBaseMutates(true);
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.modelViewMatrixRTE).toBeDefined();
      expect(uniforms.u_cameraPositionHigh).toBeDefined();
      expect(uniforms.u_cameraPositionLow).toBeDefined();
    });

    it("should not assign RTE refs to shader.uniforms when useRTE=false", () => {
      const state: PolygonBaseState = { ...DEFAULT_BASE_STATE, useRTE: false };
      const mutates = createBaseMutates(false);
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.modelViewMatrixRTE).toBeUndefined();
      expect(uniforms.u_cameraPositionHigh).toBeUndefined();
      expect(uniforms.u_cameraPositionLow).toBeUndefined();
    });
  });

  describe("update syncs refs from state", () => {
    it("should sync core refs from state", () => {
      const state: PolygonBaseState = {
        ...DEFAULT_BASE_STATE,
        pickable: true,
        clampToGround: true,
        addHeight: 10,
        addExtrudedHeight: 20,
        minMaxHeight: [5, 50],
      };
      const mutates = createBaseMutates(false);
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.nvr_uPickable?.value).toBe(1);
      expect(uniforms.uClampToGround?.value).toBe(true);
      expect(uniforms.uAddHeight?.value).toBe(10);
      expect(uniforms.uAddExtrudedHeight?.value).toBe(20);
      expect(uniforms.uMinMaxHeight?.value).toEqual([5, 50]);
    });
  });
});
