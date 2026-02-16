import type {
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from "three";

import type { ShaderName } from "../../MaterialEnhancer";

/**
 * Material types that can be enhanced by this enhancer.
 * Supports all standard mesh materials for depth/shadow rendering.
 */
export type SupportedMaterial =
  | MeshBasicMaterial
  | MeshLambertMaterial
  | MeshPhongMaterial
  | MeshStandardMaterial
  | MeshPhysicalMaterial;

/**
 * Shader types that this enhancer can transform.
 */
export const AVAILABLE_SHADERS = [
  "basic",
  "lambert",
  "phong",
  "standard",
  "physical",
] satisfies ShaderName[];
