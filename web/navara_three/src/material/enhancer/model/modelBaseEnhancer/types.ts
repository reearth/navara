import type { Texture } from "three";

import type { SelectiveEffectOcclusionValue } from "../../../../core";
import type { UniformValue } from "../../../types";
import type { BatchTextureFlags } from "../../batchTexture";
import type { Mutates } from "../../MaterialEnhancer";

/**
 * Props for the model base enhancer.
 */
export type ModelBaseProps = {
  // Basic material props
  color?: number;
  metalness?: number;
  roughness?: number;

  // Emissive (for selective effects)
  emissiveColor?: number;
  emissiveIntensity?: number;

  // Picking
  pickable?: boolean;

  // Batch texture
  batchDataTexture?: UniformValue<Texture | null>;

  // When batchColorEnabled is true, material.color is set to white and actual colors come from batch texture
  batchColorEnabled?: boolean;

  // Selective effects (bloom/outline mask pass)
  // Boolean props - converted to number (0/1) internally for uniforms
  bloom?: boolean;
  outline?: boolean;
  // When true, uses 1.0; when false, uses SELECTIVE_EFFECT_OCCLUSION_SKIP
  occlusion?: SelectiveEffectOcclusionValue;
} & BatchTextureFlags;

/**
 * Immutable state for the model base enhancer.
 * This state is always replaced as a whole (never mutated).
 * Returned directly via states() - refresh after updates.
 */
export type ModelBaseState = Readonly<{
  pickable: boolean;
  // Batch texture state - when true, material.color is white and colors come from batch texture
  batchColorEnabled: boolean;
  useBatchTexture: boolean;
  useBatchColorShow: boolean;
  useBatchHeight: boolean;
  useBatchExtrudedHeight: boolean;
  // Selective effects state - stored as boolean, converted to number in mutates
  bloom: boolean;
  outline: boolean;
  occlusion: SelectiveEffectOcclusionValue;
}>;

/**
 * Mutable references (uniforms) for the model base enhancer.
 *
 * These are shared references with shader.uniforms and can be mutated directly
 * for efficient GPU uniform updates without shader recompilation.
 * Internal type - not exposed externally.
 */
export type ModelBaseRefs = {
  nvr_uPickable: UniformValue<number>;
  uBloomMaskPass: UniformValue<number>;
  uOutlineMaskPass: UniformValue<number>;
  uSelectiveEffectOcclusion: UniformValue<SelectiveEffectOcclusionValue>;

  // Optional uniforms
  batchDataTexture?: UniformValue<Texture | null>;
};

export type ModelBaseUniforms = Partial<ModelBaseRefs>;

/**
 * Mutation functions for the model base enhancer.
 * Includes `update(state)` to sync refs from state, plus additional methods.
 */
export type ModelBaseMutates = Mutates<
  ModelBaseState,
  ModelBaseUniforms,
  {
    /**
     * Set the batch data texture ref.
     * This is needed because batchDataTexture is an external ref passed via props.
     */
    setBatchDataTexture: (texture: UniformValue<Texture | null>) => void;
  }
>;
