import { describe, expect, it } from "vitest";

import type { ShaderUniforms } from "../../MaterialEnhancer";

import { createPntsMutates } from "./mutates";
import { DEFAULT_PNTS_STATE } from "./state";
import type { PntsState } from "./types";

describe("pntsEnhancer/mutates", () => {
  describe("update syncs refs from state", () => {
    it("should sync uAddHeight from state.height", () => {
      const state: PntsState = { ...DEFAULT_PNTS_STATE, height: 100 };
      const mutates = createPntsMutates();
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uAddHeight?.value).toBe(100);
    });

    it("should sync uGeodeticNormal from state.geodeticNormal", () => {
      const state: PntsState = {
        ...DEFAULT_PNTS_STATE,
        geodeticNormal: { x: 0.1, y: 0.2, z: 0.3 },
      };
      const mutates = createPntsMutates();
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      expect(uniforms.uGeodeticNormal?.value).toEqual([0.1, 0.2, 0.3]);
    });

    it("should default to zero values", () => {
      const mutates = createPntsMutates();
      mutates.update(DEFAULT_PNTS_STATE);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, DEFAULT_PNTS_STATE);

      expect(uniforms.uAddHeight?.value).toBe(0);
      expect(uniforms.uGeodeticNormal?.value).toEqual([0, 0, 0]);
    });

    it("should update refs when state changes", () => {
      const mutates = createPntsMutates();

      const state1: PntsState = { ...DEFAULT_PNTS_STATE, height: 50 };
      mutates.update(state1);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state1);
      expect(uniforms.uAddHeight?.value).toBe(50);

      const state2: PntsState = { ...DEFAULT_PNTS_STATE, height: 200 };
      mutates.update(state2);
      // Ref should be updated in place
      expect(uniforms.uAddHeight?.value).toBe(200);
    });
  });

  describe("updateUniforms assigns refs", () => {
    it("should assign ref objects (not copies) to uniforms", () => {
      const mutates = createPntsMutates();
      mutates.update(DEFAULT_PNTS_STATE);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, DEFAULT_PNTS_STATE);

      const heightRef = uniforms.uAddHeight;
      expect(heightRef).toBeDefined();

      // Update state and verify the same ref object is updated
      mutates.update({ ...DEFAULT_PNTS_STATE, height: 999 });
      expect(heightRef?.value).toBe(999);
    });
  });
});
