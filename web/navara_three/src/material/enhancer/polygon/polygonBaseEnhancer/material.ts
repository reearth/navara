import type { MeshLambertMaterial, MeshPhongMaterial } from "three";

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
    // Only Lambert and Phong have reflectivity property
    if ("reflectivity" in material) {
      (material as MeshLambertMaterial | MeshPhongMaterial).reflectivity =
        props.reflectivity;
    }
  }

  // Material render state based on clampToGround and isTexturized
  // When clampToGround is true and not texturized, use stencil clipping
  if (props.clampToGround !== undefined || props.isTexturized !== undefined) {
    const clampToGround = props.clampToGround ?? false;
    const isTexturized = props.isTexturized ?? false;
    const shouldClipByStencil = !isTexturized && clampToGround;
    material.colorWrite = !shouldClipByStencil;
    material.depthWrite = !clampToGround;
    material.depthTest = !clampToGround;
  }
};
