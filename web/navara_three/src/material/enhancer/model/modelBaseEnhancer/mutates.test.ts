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

  describe("update syncs selective effect refs from state", () => {
    type TestCase = {
      name: string;
      stateOverride: Partial<ModelBaseState>;
      uniformKey: keyof ShaderUniforms;
      expected: number | ((v: number) => boolean);
    };

    const testCases: TestCase[] = [
      {
        name: "seBufferMode true → uSEBufferMode = 1",
        stateOverride: { seBufferMode: true },
        uniformKey: "uSEBufferMode",
        expected: 1,
      },
      {
        name: "seBufferMode false → uSEBufferMode = 0",
        stateOverride: { seBufferMode: false },
        uniformKey: "uSEBufferMode",
        expected: 0,
      },
    ];

    it.each(testCases)("$name", ({ stateOverride, uniformKey, expected }) => {
      const state: ModelBaseState = { ...DEFAULT_BASE_STATE, ...stateOverride };
      const mutates = createBaseMutates();
      mutates.update(state);

      const uniforms: ShaderUniforms = {};
      mutates.updateUniforms(uniforms, state);

      const value = uniforms[uniformKey]?.value as number;
      expect(value).toBe(expected);
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
