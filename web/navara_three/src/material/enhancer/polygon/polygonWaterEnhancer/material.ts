import { AddOperation } from "three";

import type { MaterialsFromShaders, ShaderName } from "../../MaterialEnhancer";

import type { PolygonWaterState } from "./types";

// Shaders this enhancer supports
export const AVAILABLE_SHADERS = ["lambert"] satisfies ShaderName[];
export type SupportedMaterial = MaterialsFromShaders<typeof AVAILABLE_SHADERS>;

/**
 * Apply water-related material configuration.
 * Side effect function - mutates material directly.
 */
export const applyWaterMaterialConfig = (
  material: SupportedMaterial,
  state: PolygonWaterState,
  isTexturized: boolean,
  prevUseWater: boolean,
): void => {
  // Trigger shader recompilation if water flag changed
  if (state.useWater !== prevUseWater) {
    material.needsUpdate = true;
  }

  // Update envMap based on water state
  if (!isTexturized && state.useWater) {
    material.envMap = state.skyEnvMap;
    if ("combine" in material) {
      material.combine = AddOperation;
    }
  } else {
    material.envMap = null;
  }
};
