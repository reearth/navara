import type { MaterialsFromShaders, ShaderName } from "../../MaterialEnhancer";

import type { ModelWaterState } from "./types";

// Shaders this enhancer supports
export const AVAILABLE_SHADERS = [
  "standard",
  "physical",
] satisfies ShaderName[];
export type SupportedMaterial = MaterialsFromShaders<typeof AVAILABLE_SHADERS>;

/**
 * Apply water-related material configuration.
 * Side effect function - mutates material directly.
 */
export const applyWaterMaterialConfig = (
  material: SupportedMaterial,
  state: ModelWaterState,
  prevUseWater: boolean,
): void => {
  // Trigger shader recompilation if water flag changed
  if (state.useWater !== prevUseWater) {
    material.needsUpdate = true;
  }
};
