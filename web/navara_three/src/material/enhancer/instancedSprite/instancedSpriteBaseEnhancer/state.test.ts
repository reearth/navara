import { describe, expect, it } from "vitest";

import { DEFAULT_BASE_STATE, updateState } from "./state";

describe("instancedSpriteBaseEnhancer / state", () => {
  describe("updateState", () => {
    it("initializes state from props with defaults", () => {
      const state = updateState({ scale: 50 }, DEFAULT_BASE_STATE);
      expect(state.scale).toBe(50);
      expect(state.center).toEqual([0.0, 0.0]);
      expect(state.scaleByDistance).toBe(true);
    });

    it("preserves immutable fields (useRTE) from currentState", () => {
      const currentState = { ...DEFAULT_BASE_STATE, useRTE: true };
      const state = updateState({ useRTE: false }, currentState);
      expect(state.useRTE).toBe(true);
    });

    it("preserves immutable fields (billboard) from currentState", () => {
      const currentState = { ...DEFAULT_BASE_STATE, billboard: true };
      const state = updateState({ billboard: false }, currentState);
      expect(state.billboard).toBe(true);
    });

    it("updates scale", () => {
      const state = updateState({ scale: 200 }, DEFAULT_BASE_STATE);
      expect(state.scale).toBe(200);
    });

    it("updates center", () => {
      const state = updateState({ center: [0.5, 0.5] }, DEFAULT_BASE_STATE);
      expect(state.center).toEqual([0.5, 0.5]);
    });

    it("updates scaleByDistance", () => {
      const state = updateState({ scaleByDistance: false }, DEFAULT_BASE_STATE);
      expect(state.scaleByDistance).toBe(false);
    });

    it("updates offsetDepth", () => {
      const state = updateState({ offsetDepth: false }, DEFAULT_BASE_STATE);
      expect(state.offsetDepth).toBe(false);
    });

    it("updates alphaTest", () => {
      const state = updateState({ alphaTest: 0.5 }, DEFAULT_BASE_STATE);
      expect(state.alphaTest).toBe(0.5);
    });

    it("updates pickable", () => {
      const state = updateState({ pickable: true }, DEFAULT_BASE_STATE);
      expect(state.pickable).toBe(true);
    });

    it("updates transparent", () => {
      const state = updateState({ transparent: false }, DEFAULT_BASE_STATE);
      expect(state.transparent).toBe(false);
    });

    it("updates depthTest", () => {
      const state = updateState({ depthTest: false }, DEFAULT_BASE_STATE);
      expect(state.depthTest).toBe(false);
    });

    it("updates aspect", () => {
      const state = updateState({ aspect: 1.5 }, DEFAULT_BASE_STATE);
      expect(state.aspect).toBe(1.5);
    });

    it("falls back to currentState for missing props", () => {
      const currentState = {
        ...DEFAULT_BASE_STATE,
        scale: 42,
        center: [1, 2] as [number, number],
      };
      const state = updateState({}, currentState);
      expect(state.scale).toBe(42);
      expect(state.center).toEqual([1, 2]);
    });
  });
});
