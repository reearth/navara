import type { MaterialsFromShaders, ShaderName } from "../../MaterialEnhancer";

import type { PolygonBaseProps } from "./types";

// Shaders this enhancer supports
export const AVAILABLE_SHADERS = ["lambert"] satisfies ShaderName[];
export type SupportedMaterial = MaterialsFromShaders<typeof AVAILABLE_SHADERS>;

/**
 * Update Three.js material properties from props and state.
 * Side effect function - mutates material directly.
 */
export const updateMaterialProps = (
  material: SupportedMaterial,
  props: PolygonBaseProps,
): void => {
  if (props.color !== undefined) {
    material.color.set(props.color);
  }
  if (props.opacity !== undefined) {
    material.opacity = props.opacity;
  }
  if (props.transparent !== undefined) {
    material.transparent = props.transparent;
  }
  if (props.wireframe !== undefined) {
    material.wireframe = props.wireframe;
  }
  if (props.emissiveColor !== undefined) {
    material.emissive.set(props.emissiveColor);
  }
  if (props.emissiveIntensity !== undefined) {
    material.emissiveIntensity = props.emissiveIntensity;
  }
  if (props.reflectivity !== undefined) {
    material.reflectivity = props.reflectivity;
  }
};
