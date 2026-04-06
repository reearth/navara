import type { MaterialsFromShaders, ShaderName } from "../../MaterialEnhancer";

import type { ModelBaseProps } from "./types";

// Shaders this enhancer supports
export const AVAILABLE_SHADERS = [
  "standard",
  "physical",
] satisfies ShaderName[];
export type SupportedMaterial = MaterialsFromShaders<typeof AVAILABLE_SHADERS>;

/**
 * Update Three.js material properties from props.
 * Side effect function - mutates material directly.
 */
export const updateMaterialProps = (
  material: SupportedMaterial,
  props: ModelBaseProps,
): void => {
  if (props.color !== undefined) {
    material.color.set(props.color);
  }
  if (props.metalness !== undefined) {
    material.metalness = props.metalness;
  }
  if (props.roughness !== undefined) {
    material.roughness = props.roughness;
  }
  if (props.emissiveColor !== undefined) {
    material.emissive.set(props.emissiveColor);
  }
  if (props.emissiveIntensity !== undefined) {
    material.emissiveIntensity = props.emissiveIntensity;
  }
};
