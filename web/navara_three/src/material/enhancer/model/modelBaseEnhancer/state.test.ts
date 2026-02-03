import { describe, expect, it } from "vitest";

import { DEFAULT_BASE_STATE, updateState } from "./state";
import type { ModelBaseProps, ModelBaseState } from "./types";

/**
 * Helper to create expected base state by merging with defaults.
 */
const createExpectedState = (
  overrides: Partial<ModelBaseState> = {},
): ModelBaseState => ({
  ...DEFAULT_BASE_STATE,
  ...overrides,
});

describe("modelBaseEnhancer/state", () => {
  describe("updateState", () => {
    type TestCase = {
      name: string;
      props: ModelBaseProps;
      currentState: ModelBaseState;
      expected: ModelBaseState;
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
          pickable: true,
          batchColorEnabled: true,
          useBatchTexture: true,
          useBatchColorShow: true,
          useBatchHeight: true,
        },
        currentState: DEFAULT_BASE_STATE,
        expected: createExpectedState({
          pickable: true,
          batchColorEnabled: true,
          useBatchTexture: true,
          useBatchColorShow: true,
          useBatchHeight: true,
        }),
      },
      {
        name: "applies pickable only",
        props: {
          pickable: true,
        },
        currentState: DEFAULT_BASE_STATE,
        expected: createExpectedState({
          pickable: true,
        }),
      },
      {
        name: "applies batch flags only",
        props: {
          useBatchTexture: true,
          useBatchColorShow: true,
        },
        currentState: DEFAULT_BASE_STATE,
        expected: createExpectedState({
          useBatchTexture: true,
          useBatchColorShow: true,
        }),
      },
      {
        name: "applies selective effect flags",
        props: {
          bloom: true,
          outline: true,
          occlusion: true,
        },
        currentState: DEFAULT_BASE_STATE,
        expected: createExpectedState({
          bloom: true,
          outline: true,
          occlusion: true,
        }),
      },
      {
        name: "applies bloom only",
        props: {
          bloom: true,
        },
        currentState: DEFAULT_BASE_STATE,
        expected: createExpectedState({
          bloom: true,
        }),
      },
    ];

    it.each(testCases)("$name", ({ props, currentState, expected }) => {
      const result = updateState(props, currentState);
      expect(result).toEqual(expected);
    });

    it("falls back to currentState for missing props", () => {
      const currentState: ModelBaseState = {
        ...DEFAULT_BASE_STATE,
        pickable: true,
        useBatchTexture: true,
      };
      const result = updateState({ batchColorEnabled: true }, currentState);
      expect(result.pickable).toBe(true);
      expect(result.useBatchTexture).toBe(true);
      expect(result.batchColorEnabled).toBe(true);
    });
  });
});
