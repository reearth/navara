import { describe, expect, it } from "vitest";

import { DEFAULT_BASE_STATE, updateState } from "./state";
import type { PolygonBaseProps, PolygonBaseState } from "./types";

/**
 * Helper to create expected base state by merging with defaults.
 */
const createExpectedState = (
  overrides: Partial<PolygonBaseState> = {},
): PolygonBaseState => ({
  ...DEFAULT_BASE_STATE,
  ...overrides,
});

describe("polygonBaseEnhancer/state", () => {
  describe("updateState", () => {
    type TestCase = {
      name: string;
      props: PolygonBaseProps;
      currentState: PolygonBaseState;
      expected: PolygonBaseState;
    };

    const testCases: TestCase[] = [
      {
        name: "returns default state when given empty props",
        props: {},
        currentState: DEFAULT_BASE_STATE,
        expected: createExpectedState(),
      },
      {
        name: "applies all props",
        props: {
          useRTE: true, // ignored - useRTE preserves currentState
          isTexturized: true,
          clampToGround: true,
          pickable: true,
          minMaxHeight: [10, 100],
          addExtrudedHeight: 50,
          addHeight: 20,
          reflectivity: 0.5,
          roughness: 0.3,
        },
        currentState: DEFAULT_BASE_STATE,
        expected: createExpectedState({
          // useRTE stays false because updateState preserves currentState.useRTE
          isTexturized: true,
          clampToGround: true,
          pickable: true,
          minMaxHeight: [10, 100],
          addExtrudedHeight: 50,
          addHeight: 20,
          reflectivity: 0.5,
          roughness: 0.3,
        }),
      },
      {
        name: "applies height props only",
        props: {
          minMaxHeight: [0, 50],
          addExtrudedHeight: 25,
          addHeight: 10,
        },
        currentState: DEFAULT_BASE_STATE,
        expected: createExpectedState({
          minMaxHeight: [0, 50],
          addExtrudedHeight: 25,
          addHeight: 10,
        }),
      },
    ];

    it.each(testCases)("$name", ({ props, currentState, expected }) => {
      const result = updateState(props, currentState);
      expect(result).toEqual(expected);
    });

    it("preserves useRTE from currentState (immutable after mount)", () => {
      const stateWithRTE: PolygonBaseState = {
        ...DEFAULT_BASE_STATE,
        useRTE: true,
      };
      const result = updateState({ useRTE: false }, stateWithRTE);
      expect(result.useRTE).toBe(true);
    });

    it("falls back to currentState for missing props", () => {
      const currentState: PolygonBaseState = {
        ...DEFAULT_BASE_STATE,
        clampToGround: true,
        pickable: true,
        addHeight: 42,
      };
      const result = updateState({ addExtrudedHeight: 10 }, currentState);
      expect(result.clampToGround).toBe(true);
      expect(result.pickable).toBe(true);
      expect(result.addHeight).toBe(42);
      expect(result.addExtrudedHeight).toBe(10);
    });
  });
});
