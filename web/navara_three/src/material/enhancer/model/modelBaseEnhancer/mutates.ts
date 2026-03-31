import type { Texture } from "three";
import { Color as ThreeColor } from "three";

import { SELECTIVE_EFFECT_OCCLUSION_SKIP } from "../../../../core/SelectiveEffectHelper";
import type { UniformValue } from "../../../types";

import type { ModelBaseMutates, ModelBaseRefs } from "./types";

/**
 * Default refs with initial values.
 * These are cloned in createBaseMutates and synced from state via update().
 */
const DEFAULT_BASE_REFS: Omit<
  ModelBaseRefs,
  "uEmissiveColor" | "uEmissiveIntensity"
> = {
  nvr_uPickable: { value: 0 },
  uEmissiveOnly: { value: 0 },
  uBloomMaskPass: { value: 0 },
  uOutlineMaskPass: { value: 0 },
  uSelectiveEffectOcclusion: { value: SELECTIVE_EFFECT_OCCLUSION_SKIP },
};

/**
 * Create mutation functions for the model base enhancer.
 * Refs are created internally and captured via closure.
 */
export const createBaseMutates = (): ModelBaseMutates => {
  // Clone defaults so each enhancer instance gets independent ref objects
  const refs = structuredClone(DEFAULT_BASE_REFS) as ModelBaseRefs;

  // Emissive refs (Color can't be structuredClone'd)
  refs.uEmissiveColor = { value: new ThreeColor(0, 0, 0) };
  refs.uEmissiveIntensity = { value: 0 };

  return {
    update: (state) => {
      // Sync refs from state
      refs.nvr_uPickable.value = state.pickable ? 1 : 0;
      refs.uEmissiveOnly.value = state.emissiveOnly ? 1 : 0;
      refs.uEmissiveColor.value.set(state.emissiveColor);
      refs.uEmissiveIntensity.value = state.emissiveIntensity;
      // Selective effects - convert boolean to number
      refs.uBloomMaskPass.value = state.bloom ? 1 : 0;
      refs.uOutlineMaskPass.value = state.outline ? 1 : 0;
      refs.uSelectiveEffectOcclusion.value = state.occlusion;
    },
    updateUniforms: (uniforms) => {
      // Assign core uniform refs to shader.uniforms
      uniforms.nvr_uPickable = refs.nvr_uPickable;
      uniforms.uEmissiveOnly = refs.uEmissiveOnly;
      uniforms.uEmissiveColor = refs.uEmissiveColor;
      uniforms.uEmissiveIntensity = refs.uEmissiveIntensity;
      uniforms.uBloomMaskPass = refs.uBloomMaskPass;
      uniforms.uOutlineMaskPass = refs.uOutlineMaskPass;
      uniforms.uSelectiveEffectOcclusion = refs.uSelectiveEffectOcclusion;

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
