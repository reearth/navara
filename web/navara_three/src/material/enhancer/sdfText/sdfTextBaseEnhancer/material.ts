import { ShaderMaterial } from "three";

import type { ShaderName } from "../../MaterialEnhancer";

import type { SdfTextBaseProps } from "./types";

/**
 * Shaders that the sdfText base enhancer supports.
 * SdfText uses ShaderMaterial with custom shaders.
 */
export const AVAILABLE_SHADERS = ["shader"] satisfies ShaderName[];

/**
 * Material types that the sdfText base enhancer supports.
 */
export type SupportedMaterial = ShaderMaterial;

/**
 * Update material properties that affect the Three.js material directly.
 * These properties are not handled by shader uniforms.
 */
export function updateMaterialProps(
  material: SupportedMaterial,
  props: SdfTextBaseProps,
): void {
  if (props.depthTest !== undefined) {
    material.depthTest = props.depthTest;
  }
}
