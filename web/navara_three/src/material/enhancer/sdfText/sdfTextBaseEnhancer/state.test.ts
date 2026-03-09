import { describe, expect, it } from "vitest";

import { DEFAULT_BASE_STATE, updateState } from "./state";
import { SDF_RADIUS } from "./types";

describe("sdfTextBaseEnhancer / state", () => {
  describe("updateState", () => {
    it("initializes state from props with defaults", () => {
      const state = updateState({ fontSize: 24 }, DEFAULT_BASE_STATE);
      expect(state.fontSize).toBe(24);
      expect(state.center).toEqual([0.5, 0.0]);
      expect(state.scaleByDistance).toBe(false);
    });

    it("preserves immutable fields (useRTE) from currentState", () => {
      const currentState = { ...DEFAULT_BASE_STATE, useRTE: true };
      const state = updateState({ useRTE: false }, currentState);
      expect(state.useRTE).toBe(true);
    });

    it("updates color from hex to RGB tuple", () => {
      const state = updateState({ color: 0xff0000 }, DEFAULT_BASE_STATE);
      expect(state.color[0]).toBeCloseTo(1.0);
      expect(state.color[1]).toBeCloseTo(0.0);
      expect(state.color[2]).toBeCloseTo(0.0);
    });

    it("updates fontSize", () => {
      const state = updateState({ fontSize: 32 }, DEFAULT_BASE_STATE);
      expect(state.fontSize).toBe(32);
    });

    it("updates center", () => {
      const state = updateState({ center: [0.0, 0.5] }, DEFAULT_BASE_STATE);
      expect(state.center).toEqual([0.0, 0.5]);
    });

    it("updates scaleByDistance", () => {
      const state = updateState({ scaleByDistance: true }, DEFAULT_BASE_STATE);
      expect(state.scaleByDistance).toBe(true);
    });

    it("updates addHeight", () => {
      const state = updateState({ addHeight: 100 }, DEFAULT_BASE_STATE);
      expect(state.addHeight).toBe(100);
    });

    it("updates offsetDepth", () => {
      const state = updateState({ offsetDepth: false }, DEFAULT_BASE_STATE);
      expect(state.offsetDepth).toBe(false);
    });

    it("converts outlineWidth using SDF_RADIUS", () => {
      const state = updateState({ outlineWidth: 2.0 }, DEFAULT_BASE_STATE);
      expect(state.outlineWidth).toBeCloseTo((2.0 * 0.5) / SDF_RADIUS);
    });

    it("updates outlineColor from hex", () => {
      const state = updateState({ outlineColor: 0x00ff00 }, DEFAULT_BASE_STATE);
      expect(state.outlineColor[0]).toBeCloseTo(0.0);
      expect(state.outlineColor[1]).toBeCloseTo(1.0);
      expect(state.outlineColor[2]).toBeCloseTo(0.0);
    });

    it("updates outlineOpacity", () => {
      const state = updateState({ outlineOpacity: 0.5 }, DEFAULT_BASE_STATE);
      expect(state.outlineOpacity).toBe(0.5);
    });

    it("updates showBackground", () => {
      const state = updateState({ showBackground: true }, DEFAULT_BASE_STATE);
      expect(state.showBackground).toBe(true);
    });

    it("updates backgroundColor from hex", () => {
      const state = updateState(
        { backgroundColor: 0x0000ff },
        DEFAULT_BASE_STATE,
      );
      expect(state.backgroundColor[0]).toBeCloseTo(0.0);
      expect(state.backgroundColor[1]).toBeCloseTo(0.0);
      expect(state.backgroundColor[2]).toBeCloseTo(1.0);
    });

    it("updates backgroundOutlineColor from hex", () => {
      const state = updateState(
        { backgroundOutlineColor: 0xffff00 },
        DEFAULT_BASE_STATE,
      );
      expect(state.backgroundOutlineColor[0]).toBeCloseTo(1.0);
      expect(state.backgroundOutlineColor[1]).toBeCloseTo(1.0);
      expect(state.backgroundOutlineColor[2]).toBeCloseTo(0.0);
    });

    it("updates backgroundOutlineWidth", () => {
      const state = updateState(
        { backgroundOutlineWidth: 0.5 },
        DEFAULT_BASE_STATE,
      );
      expect(state.backgroundOutlineWidth).toBe(0.5);
    });

    it("updates pickable", () => {
      const state = updateState({ pickable: true }, DEFAULT_BASE_STATE);
      expect(state.pickable).toBe(true);
    });

    it("updates depthTest", () => {
      const state = updateState({ depthTest: false }, DEFAULT_BASE_STATE);
      expect(state.depthTest).toBe(false);
    });

    it("falls back to currentState for missing props", () => {
      const currentState = {
        ...DEFAULT_BASE_STATE,
        fontSize: 42,
        center: [1, 2] as [number, number],
      };
      const state = updateState({}, currentState);
      expect(state.fontSize).toBe(42);
      expect(state.center).toEqual([1, 2]);
    });
  });
});
