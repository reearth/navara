import type { Texture } from "three";

import type { UniformValue } from "../../../types";

import type { ModelBaseMutates, ModelBaseRefs } from "./types";

/**
 * Default refs with initial values.
 * These are cloned in createBaseMutates and synced from state via update().
 */
const DEFAULT_BASE_REFS: ModelBaseRefs = {
  nvr_uPickable: { value: 0 },
  uEffectIdsMask: { value: 0 },
};

/**
 * Create mutation functions for the model base enhancer.
 * Refs are created internally and captured via closure.
 */
export const createBaseMutates = (): ModelBaseMutates => {
  // Clone defaults so each enhancer instance gets independent ref objects
  const refs = structuredClone(DEFAULT_BASE_REFS) as ModelBaseRefs;

  return {
    update: (state) => {
      // Sync refs from state
      refs.nvr_uPickable.value = state.pickable ? 1 : 0;
      refs.uEffectIdsMask.value = state.effectIdsMask;
    },
    updateUniforms: (uniforms) => {
      // Assign core uniform refs to shader.uniforms
      uniforms.nvr_uPickable = refs.nvr_uPickable;
      uniforms.uEffectIdsMask = refs.uEffectIdsMask;

      // Batch texture
      if (refs.batchDataTexture) {
        uniforms.batchDataTexture = refs.batchDataTexture;
      }
    },
    setBatchDataTexture: (texture: UniformValue<Texture | null>): void => {
      refs.batchDataTexture = texture;
    },
  };
};
