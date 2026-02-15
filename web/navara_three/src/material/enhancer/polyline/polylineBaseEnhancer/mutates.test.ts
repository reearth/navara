import { Vector2 } from "three";
import { describe, expect, it } from "vitest";

import type { ShaderUniforms } from "../../MaterialEnhancer";

import { createBaseMutates } from "./mutates";
import { DEFAULT_BASE_STATE } from "./state";
import type { PolylineBaseState } from "./types";

describe("polylineBaseEnhancer/mutates", () => {
  describe("RTE uniforms", () => {
    it("should assign RTE refs to shader.uniforms when useRTE=true", () => {
      const state: PolylineBaseState = { ...DEFAULT_BASE_STATE, useRTE: true };
      const mutates = createBaseMutates(true);
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.modelViewMatrixRTE).toBeDefined();
      expect(uniforms.u_cameraPositionHigh).toBeDefined();
      expect(uniforms.u_cameraPositionLow).toBeDefined();
    });

    it("should not assign RTE refs to shader.uniforms when useRTE=false", () => {
      const state: PolylineBaseState = { ...DEFAULT_BASE_STATE, useRTE: false };
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
      const state: PolylineBaseState = {
        ...DEFAULT_BASE_STATE,
        useGroundNormals: true,
        pickable: true,
        minMaxHeight: [10, 100],
        width: 3,
      };
      const mutates = createBaseMutates(false);
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.minMaxHeightAndWidth?.value).toEqual([10, 100, 3]);
      expect(uniforms.useGroundNormals?.value).toBe(true);
      expect(uniforms.nvr_uPickable?.value).toBe(1);
    });
  });

  describe("setPickingCoord", () => {
    it("should update picking coordinate uniform", () => {
      const state: PolylineBaseState = { ...DEFAULT_BASE_STATE };
      const mutates = createBaseMutates(false);

      const pickingCoord = new Vector2(100, 200);
      mutates.update(state);
      mutates.setPickingCoord(pickingCoord);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      const coord = uniforms.nvr_uPickingCoord as { value: Vector2 };
      expect(coord.value.x).toBe(100);
      expect(coord.value.y).toBe(200);
    });
  });
});
