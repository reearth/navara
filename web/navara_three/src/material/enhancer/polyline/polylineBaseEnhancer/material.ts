import { ShaderMaterial } from "three";

import type { ShaderName } from "../../MaterialEnhancer";

import type { PolylineBaseProps } from "./types";

/**
 * Shaders that the polyline base enhancer supports.
 * Polylines use ShaderMaterial with custom shaders, not built-in shaders like lambert or phong.
 */
export const AVAILABLE_SHADERS = ["shader"] satisfies ShaderName[];

/**
 * Material types that the polyline base enhancer supports.
 * Polylines use ShaderMaterial exclusively.
 */
export type SupportedMaterial = ShaderMaterial;

/**
 * Update material properties that affect the Three.js material directly.
 * These properties are not handled by shader uniforms.
 * @param material - The material to update
 * @param props - The props to apply
 */
export function updateMaterialProps(
  _material: SupportedMaterial,
  _props: PolylineBaseProps,
): void {}
