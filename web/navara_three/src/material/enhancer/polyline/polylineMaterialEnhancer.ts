/**
 * Polyline Material Enhancer - Currently just the Base enhancer
 *
 * This module provides polyline material functionality using the base enhancer.
 * Unlike polygon materials which have water effects, polyline materials currently
 * only need the base functionality.
 */

import type { MaterialEnhancer } from "../MaterialEnhancer";

import {
  createPolylineBaseEnhancer,
  type PolylineBaseMutates,
  type PolylineBaseProps,
  type PolylineBaseState,
  type SupportedMaterial,
} from "./polylineBaseEnhancer";

/**
 * Props for the polyline material enhancer.
 * Currently just wraps the base props, but structured for future composition.
 */
export type PolylineMaterialProps = {
  base?: PolylineBaseProps;
};

// Shaders this enhancer supports (custom ShaderMaterial via the "shader" shader name)
const AVAILABLE_SHADERS = ["shader"] as const;
type AVAILABLE_SHADERS = typeof AVAILABLE_SHADERS;

/**
 * Factory function to create the polyline material enhancer.
 *
 * This creates a new enhancer instance with its own internal state.
 *
 * @param material - The Three.js ShaderMaterial to enhance
 *
 * @example
 * ```typescript
 * const material = new ShaderMaterial();
 * const enhancer = createPolylineMaterialEnhancer(material);
 *
 * // Mount with base props
 * enhancer.mount({
 *   base: { color: 0xff0000, width: 2, useRTE: true },
 * });
 *
 * // Get state directly via states() - refresh after updates
 * const state = enhancer.states();
 *
 * // Update RTE uniforms per-frame via mutates()
 * if (state.useRTE) {
 *   const mutates = enhancer.mutates();
 *   mutates.updateRteUniforms(modelViewMatrix, cameraHigh, cameraLow, state);
 * }
 *
 * // Update props (then call states() again to get fresh state)
 * enhancer.update({ base: { width: 3 } });
 *
 * // Use transformShader for onBeforeCompile
 * material.onBeforeCompile = enhancer.transformShader;
 * ```
 */
export function createPolylineMaterialEnhancer(
  material: SupportedMaterial,
): MaterialEnhancer<
  SupportedMaterial,
  PolylineMaterialProps,
  PolylineBaseState,
  PolylineBaseMutates,
  AVAILABLE_SHADERS
> {
  const baseEnhancer = createPolylineBaseEnhancer(material);

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
export type { PolylineBaseMutates, PolylineBaseProps, PolylineBaseState };
