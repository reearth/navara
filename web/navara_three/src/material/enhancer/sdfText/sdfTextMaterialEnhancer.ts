/**
 * SdfText Material Enhancer - Currently just the Base enhancer
 *
 * This module provides sdfText material functionality using the base enhancer.
 * Structured for future composition if additional enhancers are needed.
 */

import type { MaterialEnhancer } from "../MaterialEnhancer";

import {
  createSdfTextBaseEnhancer,
  type SdfTextBaseMutates,
  type SdfTextBaseProps,
  type SdfTextBaseState,
  type SupportedMaterial,
} from "./sdfTextBaseEnhancer";

/**
 * Props for the sdfText material enhancer.
 * Currently just wraps the base props, but structured for future composition.
 */
export type SdfTextMaterialProps = {
  base?: SdfTextBaseProps;
};

// Shaders this enhancer supports (custom ShaderMaterial via the "shader" shader name)
const AVAILABLE_SHADERS = ["shader"] as const;
type AVAILABLE_SHADERS = typeof AVAILABLE_SHADERS;

/**
 * Factory function to create the sdfText material enhancer.
 *
 * This creates a new enhancer instance with its own internal state.
 *
 * @param material - The Three.js ShaderMaterial to enhance
 *
 * @example
 * ```typescript
 * const material = new ShaderMaterial({ transparent: true });
 * const enhancer = createSdfTextMaterialEnhancer(material);
 *
 * // Mount with base props
 * enhancer.mount({
 *   base: { color: 0xffffff, fontSize: 16, useRTE: true },
 * });
 *
 * // Get state directly via states() - refresh after updates
 * const state = enhancer.states();
 *
 * // Update per-frame via mutates()
 * const mutates = enhancer.mutates();
 * mutates.updatePerFrame(fov, screenHeight, farPlane, camX, camY, camZ, state);
 *
 * // Update props (then call states() again to get fresh state)
 * enhancer.update({ base: { color: 0xff0000 } });
 *
 * // Use transformShader for onBeforeCompile
 * material.onBeforeCompile = enhancer.transformShader;
 * material.customProgramCacheKey = enhancer.programCacheKey;
 * ```
 */
export function createSdfTextMaterialEnhancer(
  material: SupportedMaterial,
): MaterialEnhancer<
  SupportedMaterial,
  SdfTextMaterialProps,
  SdfTextBaseState,
  SdfTextBaseMutates,
  AVAILABLE_SHADERS
> {
  const baseEnhancer = createSdfTextBaseEnhancer(material);

  return {
    material,
    availableShaders: AVAILABLE_SHADERS,

    transformShader: (shader) => {
      baseEnhancer.transformShader(shader);
    },

    mount: (props) => {
      baseEnhancer.mount(props.base ?? {});
    },

    update: (props) => {
      if (props.base) {
        baseEnhancer.update(props.base);
      }
    },

    states: () => baseEnhancer.states(),

    mutates: () => baseEnhancer.mutates(),

    programCacheKey: () => baseEnhancer.programCacheKey(),
  };
}

// Re-export types for convenience
export type { SdfTextBaseMutates, SdfTextBaseProps, SdfTextBaseState };
