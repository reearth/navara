import type { MaterialsFromShaders, ShaderName } from "../../MaterialEnhancer";

import type { PntsProps } from "./types";

export const AVAILABLE_SHADERS = ["points"] satisfies ShaderName[];
export type SupportedMaterial = MaterialsFromShaders<typeof AVAILABLE_SHADERS>;

/**
 * Update Three.js PointsMaterial properties from props.
 */
export const updateMaterialProps = (
  material: SupportedMaterial,
  props: PntsProps,
): void => {
  if (props.color !== undefined) {
    material.color.set(props.color);
  }
  if (props.pointSize !== undefined) {
    material.size = props.pointSize;
  }
};
