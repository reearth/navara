/**
 * InstancedSprite Material Enhancer - Currently just the Base enhancer
 *
 * This module provides instancedSprite material functionality using the base enhancer.
 * Structured for future composition if additional enhancers are needed.
 */

import type { MaterialEnhancer } from "../MaterialEnhancer";

import {
  createInstancedSpriteBaseEnhancer,
  type InstancedSpriteBaseMutates,
  type InstancedSpriteBaseProps,
  type InstancedSpriteBaseState,
  type SupportedMaterial,
} from "./instancedSpriteBaseEnhancer";

/**
 * Props for the instancedSprite material enhancer.
 * Currently just wraps the base props, but structured for future composition.
 */
export type InstancedSpriteMaterialProps = {
  base?: InstancedSpriteBaseProps;
};

// Shaders this enhancer supports (custom ShaderMaterial via the "shader" shader name)
const AVAILABLE_SHADERS = ["shader"] as const;
type AVAILABLE_SHADERS = typeof AVAILABLE_SHADERS;

/**
 * Factory function to create the instancedSprite material enhancer.
 *
 * This creates a new enhancer instance with its own internal state.
 *
 * @param material - The Three.js ShaderMaterial to enhance
 *
 * @example
 * ```typescript
 * const material = new ShaderMaterial();
 * const enhancer = createInstancedSpriteMaterialEnhancer(material);
 *
 * // Mount with base props
 * enhancer.mount({
 *   base: { scale: 100, useRTE: true, billboard: true },
 * });
 *
 * // Get state directly via states() - refresh after updates
 * const state = enhancer.states();
 *
 * // Update RTE uniforms per-frame via mutates()
 * if (state.useRTE) {
 *   const mutates = enhancer.mutates();
 *   mutates.updateRteUniforms(camX, camY, camZ, state);
 * }
 *
 * // Update props (then call states() again to get fresh state)
 * enhancer.update({ base: { scale: 200 } });
 *
 * // Use transformShader for onBeforeCompile
 * material.onBeforeCompile = enhancer.transformShader;
 * ```
 */
export function createInstancedSpriteMaterialEnhancer(
  material: SupportedMaterial,
): MaterialEnhancer<
  SupportedMaterial,
  InstancedSpriteMaterialProps,
  InstancedSpriteBaseState,
  InstancedSpriteBaseMutates,
  AVAILABLE_SHADERS
> {
  const baseEnhancer = createInstancedSpriteBaseEnhancer(material);

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
export type {
  InstancedSpriteBaseMutates,
  InstancedSpriteBaseProps,
  InstancedSpriteBaseState,
};
